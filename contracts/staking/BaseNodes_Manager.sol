// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./IStakeManager.sol";
import "../consensus/IValidatorSet.sol";
import "../funds/RewardsBank.sol";
import "../finance/Treasury.sol";

// Manager, that can add and remove nodes from validator set TOP list (controlled by multisig)

contract BaseNodes_Manager is UUPSUpgradeable, IStakeManager, AccessControlUpgradeable {
    IValidatorSet public validatorSet; // contract that manages validator set
    RewardsBank public rewardsBank;
    Treasury public treasury;

    uint256[20] private __gap;

    function initialize(
        IValidatorSet _validatorSet, RewardsBank _rewardsBank, Treasury _treasury
    ) public initializer {
        validatorSet = _validatorSet;
        rewardsBank = _rewardsBank;
        treasury = _treasury;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // USER (MULTISIG) METHODS

    function addStake(address nodeAddress) payable public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (validatorSet.getNodeStake(nodeAddress) == 0)
            validatorSet.newStake(nodeAddress, msg.value, true);
        else
            validatorSet.stake(nodeAddress, msg.value);
    }

    function removeStake(address nodeAddress, uint amount, address sendTo) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(validatorSet.getNodeStake(nodeAddress) >= amount, "Stake < amount");

        validatorSet.unstake(nodeAddress, amount);
        payable(sendTo).transfer(amount);
    }

    // VALIDATOR SET METHODS

    function reward(address nodeAddress, uint amount) external {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");

        uint treasuryAmount = treasury.calcFee(amount);
        rewardsBank.withdrawAmb(payable(address(treasury)), treasuryAmount);
        amount -= treasuryAmount;

        rewardsBank.withdrawAmb(payable(nodeAddress), amount);
        validatorSet.emitReward(nodeAddress, nodeAddress, nodeAddress, address(0), amount);
    }

    function report(address nodeAddress) external {

    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    receive() external payable {}
}
