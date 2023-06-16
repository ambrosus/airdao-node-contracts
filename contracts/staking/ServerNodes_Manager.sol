// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IStakeManager.sol";
import "../consensus/IValidatorSet.sol";
import {IOnBlockListener} from "../consensus/OnBlockNotifier.sol";
import "../LockKeeper.sol";
import "../funds/AmbBank.sol";
import "../funds/AirBond.sol";

// Manager, that allows users to register their **ONE** node in validator set

contract ServerNodes_Manager is IStakeManager, IOnBlockListener, AccessControl {

    struct Stake {
        uint stake;
        uint timestampStake;
        address ownerAddress;
        address rewards;  // address to send rewards. address(0) means that rewards will be added to stake
    }

    IValidatorSet public validatorSet; // contract that manages validator set

    LockKeeper public lockKeeper; // contract that locks stakes
    AmbBank public ambBank;
    AirBond public airBond;


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
        address payable _ambBank, address _airBond,
        uint _onboardingDelay, uint _unstakeLockTime, uint _minStakeAmount
    ) {
        validatorSet = IValidatorSet(_validatorSet);
        lockKeeper = LockKeeper(_lockKeeper);
        ambBank = AmbBank(_ambBank);
        airBond = AirBond(_airBond);

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

    // address(0) address means that rewards will be added to stake
    function setRewardsAddress(address nodeAddress, bool rewardsAddress) public {
        require(stakes[nodeAddress].ownerAddress == msg.sender, "Only owner can set flag");
        stakes[nodeAddress].rewards = rewardsAddress;
    }

    // VALIDATOR SET METHODS

    function reward(address nodeAddress, uint amount) external {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");
        Stake memory stakeStruct = stakes[nodeAddress];
        require(stakeStruct.stake > 0, "nodeAddress is not a validator");

        address payable ownerAddress = payable(stakeStruct.ownerAddress);

        uint bondsReward = amount * _getBondsPercent(stakeStruct.timestampStake);
        uint nativeReward = amount - bondsReward;

        if (stakeStruct.rewardsAddress == address(0)) {
            ambBank.reward(payable(address(this)), nativeReward);
            _addStake(nodeAddress, nativeReward);
        } else {
            ambBank.reward(stakeStruct.rewardsAddress, nativeReward);
        }

        if (bondsReward > 0)
            airBond.mint(stakeStruct.rewardsAddress, bondsReward);

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

    function _getBondsPercent(uint timestampStake) internal view returns (uint) {
        uint stakingTime = block.timestamp - timestampStake;
        uint nativePercent = 25 + stakingTime / (3 * 365  days);
        if (nativePercent > 100) nativePercent = 100;

        return 100 - nativePercent;
    }

}
