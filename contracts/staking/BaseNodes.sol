// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IStaking.sol";
import "../consensus/IValidatorSet.sol";
import "../funds/AmbBank.sol";

contract BaseNodes is IStaking, AccessControl {
    IValidatorSet public validatorSet; // contract that manages validator set

    AmbBank public ambBank;

    constructor(
        address _multisig,
        address _validatorSet,
        address payable _ambBank
    ) {
        validatorSet = IValidatorSet(_validatorSet);
        ambBank = AmbBank(_ambBank);

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


}
