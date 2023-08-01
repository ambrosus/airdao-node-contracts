// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./IStakeManager.sol";
import "../consensus/IValidatorSet.sol";
import {IOnBlockListener} from "../consensus/OnBlockNotifier.sol";
import "../LockKeeper.sol";
import "../funds/RewardsBank.sol";

// Manager, that allows users to register their nodes in validator set

contract ServerNodes_Manager is UUPSUpgradeable, IStakeManager, IOnBlockListener, AccessControlUpgradeable, PausableUpgradeable {

    struct Stake {
        uint stake;
        uint timestampStake;
        address ownerAddress;
        address rewardsAddress;  // address to send rewards. address(0) means that rewards will be added to stake
    }

    IValidatorSet public validatorSet; // contract that manages validator set
    LockKeeper public lockKeeper; // contract that locks stakes
    RewardsBank public rewardsBank;

    uint public onboardingDelay;  // time that new node will be in queueStakes even if it has enough stake (only affects nodes without FLAG_ALWAYS_IN_TOP)
    uint public unstakeLockTime; // time that funds will be locked after unstake
    uint public minStakeAmount;  // min stake to become a validator

    mapping(address => Stake) public stakes; // nodeAddress => stake
    address[] internal stakesList; // keys of stakes

    mapping(address => uint) public lockedWithdraws; // nodeAddress => lockId
    address[] internal onboardingWaitingList; // list of nodes that are waiting for onboardingDelay to pass

    event StakeChanged(address indexed nodeAddress, address indexed nodeOwner, int amount);
    event Reward(address indexed nodeAddress, address indexed rewardAddress, uint amountAmb, uint amountBonds);


    function initialize(
        IValidatorSet _validatorSet, LockKeeper _lockKeeper, RewardsBank _rewardsBank,
        uint _onboardingDelay, uint _unstakeLockTime, uint _minStakeAmount
    ) public initializer {
        validatorSet = _validatorSet;
        lockKeeper = _lockKeeper;
        rewardsBank = _rewardsBank;

        onboardingDelay = _onboardingDelay;
        unstakeLockTime = _unstakeLockTime;
        minStakeAmount = _minStakeAmount;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }


    // USER METHODS

    function newStake(address nodeAddress, address rewardAddress) payable public whenNotPaused {
        require(msg.value >= minStakeAmount, "msg.value must be >= minStakeAmount");
        require(stakes[nodeAddress].stake == 0, "node already registered");

        stakes[nodeAddress] = Stake(msg.value, block.timestamp, msg.sender, rewardAddress);

        stakesList.push(nodeAddress);
        onboardingWaitingList.push(nodeAddress);

        emit StakeChanged(nodeAddress, msg.sender, int(msg.value));
    }

    function addStake(address nodeAddress) payable public onlyNodeOwner(nodeAddress) whenNotPaused {
        require(msg.value > 0, "msg.value must be > 0");

        _addStake(nodeAddress, msg.value);
        emit StakeChanged(nodeAddress, msg.sender, int(msg.value));
    }

    function unstake(address nodeAddress, uint amount) public onlyNodeOwner(nodeAddress) whenNotPaused {
        require(amount > 0, "amount must be > 0");
        uint stakeAmount = stakes[nodeAddress].stake;
        require(stakeAmount >= amount, "stake < amount");

        if (stakeAmount == amount) {
            _deleteStake(nodeAddress);
        } else {
            require(stakeAmount - amount >= minStakeAmount, "resulting stake < minStakeAmount");
            stakes[nodeAddress].stake -= amount;
        }


        if (validatorSet.getNodeStake(nodeAddress) > 0) // only if node already validator
            validatorSet.unstake(nodeAddress, amount);


        // cancel previous lock (if exists). canceledAmount will be added to new lock
        uint canceledAmount;
        if (lockKeeper.getLock(lockedWithdraws[nodeAddress]).totalClaims > 0)  // prev lock exists
            canceledAmount = lockKeeper.cancelLock(lockedWithdraws[nodeAddress]);

        // lock funds
        lockedWithdraws[nodeAddress] = lockKeeper.lockSingle{value: amount + canceledAmount}(
            msg.sender, address(0),
            uint64(block.timestamp + unstakeLockTime), amount,
            "ServerNodes unstake"
        );

        emit StakeChanged(nodeAddress, msg.sender, -int(amount));
    }

    // unlock latest withdraw to stake
    function restake(address nodeAddress) public onlyNodeOwner(nodeAddress) whenNotPaused {
        uint canceledAmount = lockKeeper.cancelLock(lockedWithdraws[nodeAddress]);
        _addStake(nodeAddress, canceledAmount);
        emit StakeChanged(nodeAddress, msg.sender, int(canceledAmount));
    }

    // address(0) address means that rewards will be added to stake
    function setRewardsAddress(address nodeAddress, address rewardsAddress) public onlyNodeOwner(nodeAddress) {
        stakes[nodeAddress].rewardsAddress = rewardsAddress;
    }

    function changeNodeOwner(address nodeAddress, address newOwnerAddress) public onlyNodeOwner(nodeAddress) {
        stakes[nodeAddress].ownerAddress = newOwnerAddress;
    }

    // VIEW METHODS

    function getStakesList() public view returns (address[] memory) {
        return stakesList;
    }

    function getUserStakesList(address ownerAddress) public view returns (address[] memory result) {
        result = new address[](stakesList.length);
        uint count;

        for (uint i = 0; i < stakesList.length; i++)
            if (address(stakes[stakesList[i]].ownerAddress) == ownerAddress)
                result[count++] = stakesList[i];

        assembly {mstore(result, count)}
        return result;
    }


    // VALIDATOR SET METHODS

    function reward(address nodeAddress, uint amount) external {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");
        Stake memory stakeStruct = stakes[nodeAddress];
        require(stakeStruct.stake > 0, "nodeAddress not in stakes");

        uint bondsReward = amount * _getBondsPercent(stakeStruct.timestampStake) / 100;
        uint nativeReward = amount - bondsReward;

        if (stakeStruct.rewardsAddress == address(0)) {
            rewardsBank.withdrawAmb(payable(address(this)), nativeReward);
            _addStake(nodeAddress, nativeReward);
        } else {
            rewardsBank.withdrawAmb(payable(address(stakeStruct.rewardsAddress)), nativeReward);
        }

        if (bondsReward > 0) {
            address bondsRewardsAddress = stakeStruct.rewardsAddress == address(0) ? stakeStruct.ownerAddress : stakeStruct.rewardsAddress;
            rewardsBank.withdrawBonds(bondsRewardsAddress, bondsReward);
        }

        emit Reward(nodeAddress, stakeStruct.rewardsAddress, nativeReward, bondsReward);
    }

    // todo tests
    function onBlock() external {
        _checkOnboardingWaitingList();
    }

    function report(address nodeAddress) external {
        // todo
    }


    // MULTISIG METHODS

    function changeMinStakeAmount(uint newMinStakeAmount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minStakeAmount = newMinStakeAmount;
    }

    function changeUnstakeLockTime(uint newUnstakeLockTime) public onlyRole(DEFAULT_ADMIN_ROLE) {
        unstakeLockTime = newUnstakeLockTime;
    }


    function importOldStakes(address[] memory addresses, uint[] memory amounts, uint[] memory timestamps) public payable onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            addresses.length == amounts.length &&
            addresses.length == timestamps.length,
            "Invalid input");

        uint totalAmount;
        for (uint i = 0; i < addresses.length; i++) {
            address nodeAddress = addresses[i];
            require(amounts[i] > minStakeAmount, "msg.value must be > minStakeAmount");
            require(stakes[nodeAddress].stake == 0, "node already registered");

            stakes[nodeAddress] = Stake(amounts[i], timestamps[i], nodeAddress, address(0));
            totalAmount += amounts[i];
        }

        require(totalAmount == msg.value, "msg.value must be equal to amounts sum");
    }

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // PRIVATE METHODS


    function _addStake(address nodeAddress, uint amount) internal {
        stakes[nodeAddress].stake += amount;

        // call validatorSet.stake() only when node already validator
        if (validatorSet.getNodeStake(nodeAddress) > 0)
            validatorSet.stake(nodeAddress, amount);
    }

    function _deleteStake(address nodeAddress) internal {
        delete stakes[nodeAddress];
        for (uint i = 0; i < stakesList.length; i++) {
            if (stakesList[i] == nodeAddress) {
                stakesList[i] = stakesList[stakesList.length - 1];
                stakesList.pop();
                break;
            }
        }
    }


    // move nodes from onboardingWaitingList to topStakes
    function _checkOnboardingWaitingList() internal {
        uint minTimestampForOnboarding = block.timestamp - onboardingDelay;

        for (uint i = 0; i < onboardingWaitingList.length; i++) {
            address nodeAddress = onboardingWaitingList[i];
            if (stakes[nodeAddress].timestampStake <= minTimestampForOnboarding) {
                validatorSet.newStake(nodeAddress, stakes[nodeAddress].stake, false);

                onboardingWaitingList[i] = onboardingWaitingList[onboardingWaitingList.length - 1];
                onboardingWaitingList.pop();

                if (i != 0) i--;
            }
        }

    }


    function _getBondsPercent(uint timestampStake) internal view returns (uint) {
        uint stakingTime = block.timestamp - timestampStake;
        uint nativePercent = 25 + stakingTime * 75 / (3 * 365  days);
        if (nativePercent > 100) nativePercent = 100;

        return 100 - nativePercent;
    }

    receive() external payable {}

    modifier onlyNodeOwner(address nodeAddress) {
        require(stakes[nodeAddress].ownerAddress == msg.sender, "Only owner can do this");
        _;
    }
}
