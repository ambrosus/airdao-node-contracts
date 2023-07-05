// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IStakeManager.sol";
import "../consensus/IValidatorSet.sol";
import {IOnBlockListener} from "../consensus/OnBlockNotifier.sol";
import "../LockKeeper.sol";
import "../utils/TransferViaCall.sol";


// Manager, that allows users to register their **ONE** node in validator set

contract ServerNodes_Manager is IStakeManager, IOnBlockListener, AccessControl {
    using SafeERC20 for IERC20;

    struct Stake {
        uint stake;
        uint timestampStake;
        address ownerAddress;
        address rewardsAddress;  // address to send rewards. address(0) means that rewards will be added to stake
    }

    IValidatorSet public validatorSet; // contract that manages validator set

    LockKeeper public lockKeeper; // contract that locks stakes
    IERC20 public airBond;


    uint public onboardingDelay;  // time that new node will be in queueStakes even if it has enough stake (only affects nodes without FLAG_ALWAYS_IN_TOP)
    uint public unstakeLockTime; // time that funds will be locked after unstake
    uint public minStakeAmount;  // min stake to become a validator


    mapping(address => Stake) public stakes; // nodeAddress => stake
    mapping(address => address) public owner2node; // owner => node addresses mapping


    address[] onboardingWaitingList; // list of nodes that are waiting for onboardingDelay to pass


    // todo maybe in validatorSet?
    event RemovedFromTop(address indexed nodeAddress, address indexed ownerAddress);  // called when node is removed from topStakes


    constructor(
        address _validatorSet, address _lockKeeper, address _airBond, address _admin,
        uint _onboardingDelay, uint _unstakeLockTime, uint _minStakeAmount
    ) {
        validatorSet = IValidatorSet(_validatorSet);
        lockKeeper = LockKeeper(_lockKeeper);
        airBond = IERC20(_airBond);

        onboardingDelay = _onboardingDelay;
        unstakeLockTime = _unstakeLockTime;
        minStakeAmount = _minStakeAmount;

        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    }


    // USER METHODS

    function newStake(address nodeAddress) payable public {
        require(msg.value > minStakeAmount, "msg.value must be > minStakeAmount");
        require(stakes[nodeAddress].stake == 0, "node already registered");
        require(owner2node[msg.sender] == address(0), "owner already has a stake");

        stakes[nodeAddress] = Stake(msg.value, block.timestamp, msg.sender, address(0));
        owner2node[msg.sender] = nodeAddress;

        // add to queuedStakes
        onboardingWaitingList.push(nodeAddress);
    }

    function addStake() payable public {
        require(msg.value > 0, "msg.value must be > 0");
        address nodeAddress = owner2node[msg.sender];
        require(stakes[nodeAddress].stake > 0, "no stake for you address");

        _addStake(nodeAddress, msg.value);
    }

    function unstake(uint amount) public {
        require(amount > 0, "amount must be > 0");

        address nodeAddress = owner2node[msg.sender];
        require(nodeAddress != address(0), "no stake for you address");

        uint stakeAmount = stakes[nodeAddress].stake;
        require(stakeAmount >= amount, "stake < amount");

        if (stakeAmount == amount) {
            delete stakes[nodeAddress];
            delete owner2node[msg.sender];
        } else {
            require(stakeAmount - amount >= minStakeAmount, "resulting stake < minStakeAmount");
            stakes[nodeAddress].stake -= amount;
        }


        if (validatorSet.getNodeStake(nodeAddress) > 0) // only if node already validator
            validatorSet.unstake(nodeAddress, amount);

        // lock funds
        lockKeeper.lockSingle{value: amount}(
            msg.sender, address(0),
            uint64(block.timestamp + unstakeLockTime), amount,
            "Validator Unstake"
        );
    }

    // address(0) address means that rewards will be added to stake
    function setRewardsAddress(address nodeAddress, address rewardsAddress) public {
        require(stakes[nodeAddress].ownerAddress == msg.sender, "Only owner can set flag");
        stakes[nodeAddress].rewardsAddress = rewardsAddress;
    }

    // VALIDATOR SET METHODS

    function reward(address nodeAddress, uint amount) external {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");
        Stake memory stakeStruct = stakes[nodeAddress];
        require(stakeStruct.stake > 0, "nodeAddress is not a validator");

        uint bondsReward = amount * _getBondsPercent(stakeStruct.timestampStake) / 100;
        uint nativeReward = amount - bondsReward;

        if (stakeStruct.rewardsAddress == address(0)) {
            _addStake(nodeAddress, nativeReward);
        } else {
            transferViaCall(payable(stakeStruct.rewardsAddress), nativeReward);
        }

        if (bondsReward > 0) {
            address bondsRewardsAddress = stakeStruct.rewardsAddress == address(0) ? stakeStruct.ownerAddress : stakeStruct.rewardsAddress;
            airBond.safeTransfer(bondsRewardsAddress, bondsReward);
        }

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

    function withdrawAmb(address payable addressTo, uint amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        transferViaCall(addressTo, amount);
    }

    function withdrawBonds(address payable addressTo, uint amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        airBond.safeTransfer(addressTo, amount);
    }

    // PRIVATE METHODS


    function _addStake(address nodeAddress, uint amount) internal {
        stakes[nodeAddress].stake += amount;

        // call validatorSet.stake() only when node already validator
        if (validatorSet.getNodeStake(nodeAddress) > 0)
            validatorSet.stake(nodeAddress, amount);
    }


    // move nodes from onboardingWaitingList to topStakes
    function _checkOnboardingWaitingList() internal {
        uint minTimestampForOnboarding =  block.timestamp - onboardingDelay;

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
}
