// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IStaking.sol";
import "../consensus/IValidatorSet.sol";
import "../LockKeeper.sol";
import "../funds/AmbBank.sol";
import "../funds/AmbBond.sol";

contract OneNodePerOwner is IStaking, AccessControl {

    struct Stake {
        uint stake;
        uint timestampStake;
        address ownerAddress;
        bool rewardsToStake;
    }

    IValidatorSet public validatorSet; // contract that manages validator set

    LockKeeper public lockKeeper; // contract that locks stakes
    AmbBank public ambBank;
    AmbBond public ambBond;


    uint public onboardingDelay;  // time that new node will be in queueStakes even if it has enough stake (only affects nodes without FLAG_ALWAYS_IN_TOP)
    uint public unstakeLockTime; // time that funds will be locked after unstake
    uint public minStakeAmount;  // min stake to become a validator


    mapping(address => Stake) public stakes; // nodeAddress => stake
    mapping(address => address) public owner2node; // owner => node addresses mapping


    address[] onboardingWaitingList; // list of nodes that are waiting for onboardingDelay to pass


    // todo maybe in validatorSet?
    event RemovedFromTop(address indexed nodeAddress, address indexed ownerAddress);  // called when node is removed from topStakes


    constructor(
        address _validatorSet, address _lockKeeper,
        address payable _ambBank, address _ambBond,
        uint _onboardingDelay, uint _unstakeLockTime, uint _minStakeAmount
    ) {
        validatorSet = IValidatorSet(_validatorSet);
        lockKeeper = LockKeeper(_lockKeeper);
        ambBank = AmbBank(_ambBank);
        ambBond = AmbBond(_ambBond);

        onboardingDelay = _onboardingDelay;
        unstakeLockTime = _unstakeLockTime;
        minStakeAmount = _minStakeAmount;
    }


    // USER METHODS

    function newStake(address nodeAddress) payable public {
        require(msg.value > minStakeAmount, "msg.value must be > minStakeAmount");
        require(owner2node[msg.sender] == address(0), "owner already has a stake");
        require(stakes[msg.sender].stake == 0, "node already registered");

        stakes[nodeAddress] = Stake(msg.value, block.timestamp, msg.sender, false);

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
        address nodeAddress = owner2node[msg.sender];
        uint stakeAmount = stakes[nodeAddress].stake;

        require(stakeAmount >= amount, "Stake < amount");
        if (stakeAmount != amount)  // if user unstake all stake, don't check for minStakeAmount
            require(stakeAmount - amount >= minStakeAmount, "Stake < minStakeAmount");

        validatorSet.removeStake(nodeAddress, amount);

        // lock funds
        lockKeeper.lockSingle{value : amount}(
            msg.sender, address(0),
            uint64(block.timestamp + unstakeLockTime), amount,
            "Validator Unstake"
        );
    }

    function setFlagRewardsToStake(address nodeAddress, bool flag) public {
        require(stakes[nodeAddress].ownerAddress == msg.sender, "Only owner can set flag");
        stakes[nodeAddress].rewardsToStake = flag;
    }

    // VALIDATOR SET METHODS

    function reward(address nodeAddress, uint amount) external {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");
        require(stakes[nodeAddress].stake > 0, "nodeAddress is not a validator");

        address payable ownerAddress = payable(stakes[nodeAddress].ownerAddress);

        uint ambBondsReward = amount * _getAmbBondsPercent(stakes[nodeAddress].timestampStake);
        uint nativeReward = amount - ambBondsReward;


        if (stakes[nodeAddress].rewardsToStake) {
            ambBank.reward(payable(address(this)), nativeReward);
            _addStake(nodeAddress, nativeReward);
        } else {
            ambBank.reward(ownerAddress, nativeReward);
        }

        if (ambBondsReward > 0)
            ambBond.reward(ownerAddress, ambBondsReward);



        // per-block update (nothing in common with rewards)
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


    // PRIVATE METHODS


    function _addStake(address nodeAddress, uint amount) internal {
        stakes[nodeAddress].stake += amount;

        // call validatorSet.addStake() only when node really ready to be validator
        if (stakes[nodeAddress].timestampStake >= _minTimestampForOnboarding())
            validatorSet.addStake(nodeAddress, stakes[nodeAddress].stake);
    }


    function _checkOnboardingWaitingList() internal {
        // move nodes from onboardingWaitingList to topStakes
        uint minTimestampForOnboarding = _minTimestampForOnboarding();

        for (uint i = 0; i < onboardingWaitingList.length; i++) {
            address nodeAddress = onboardingWaitingList[i];
            if (stakes[nodeAddress].timestampStake >= minTimestampForOnboarding) {
                validatorSet.addStake(nodeAddress, stakes[nodeAddress].stake);

                onboardingWaitingList[i] = onboardingWaitingList[onboardingWaitingList.length - 1];
                onboardingWaitingList.pop();
                i--;
            }
        }

    }

    function _minTimestampForOnboarding() internal view returns (uint) {
        return block.timestamp + onboardingDelay;
    }

    function _getAmbBondsPercent(uint timestampStake) internal view returns (uint) {
        uint stakingTime = block.timestamp - timestampStake;
        uint nativePercent = 25 + stakingTime / (3 * 365  days);
        if (nativePercent > 100) nativePercent = 100;

        return 100 - nativePercent;
    }

}
