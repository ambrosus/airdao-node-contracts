// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IStakeManager.sol";
import "../consensus/IValidatorSet.sol";
import "../funds/AmbBank.sol";


// Manager, that can add and remove nodes from validator set TOP list (controlled by multisig)

contract BaseNodes_Manager is IStakeManager, AccessControl {
    IValidatorSet public validatorSet; // contract that manages validator set

    constructor(
        address _multisig,
        address _validatorSet
    ) {
        validatorSet = IValidatorSet(_validatorSet);

        _setupRole(DEFAULT_ADMIN_ROLE, _multisig);
    }

    // USER (MULTISIG) METHODS

    function addStake(address nodeAddress) payable public onlyRole(DEFAULT_ADMIN_ROLE) {
        validatorSet.addStake(nodeAddress, msg.value);
    }

    function removeStake(address nodeAddress, uint amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(validatorSet.getNodeStake(nodeAddress) >= amount, "Stake < amount");

        validatorSet.removeStake(nodeAddress, amount);
        payable(msg.sender).transfer(amount);
    }

    // VALIDATOR SET METHODS

    function reward(address nodeAddress, uint amount) external {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");

        address payable ownerAddress = payable(nodeAddress);
        ownerAddress.transfer(amount);
    }

    function report(address nodeAddress) external {

    }

    receive() external payable {}
}
