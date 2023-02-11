// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IStaking.sol";
import "../consensus/IValidatorSet.sol";
import "../LockKeeper.sol";

contract TestPool is IStaking {
    IValidatorSet public validatorSet; // contract that manages validator set

    constructor(
        address _validatorSet
    ) {
        validatorSet = IValidatorSet(_validatorSet);
    }

    function addStake(address nodeAddress) payable public {
        validatorSet.addStake(nodeAddress, msg.value);
    }

    function removeStake(address nodeAddress, uint amount) public {
        require(validatorSet.getNodeStake(nodeAddress) >= amount, "Stake < amount");

        validatorSet.removeStake(nodeAddress, amount);
        payable(msg.sender).transfer(amount);
    }


    function reward(address nodeAddress, uint amount) external {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");

        address payable ownerAddress = payable(nodeAddress);
        ownerAddress.transfer(amount);
    }

    function report(address nodeAddress) external {

    }

    function validatorStatusChanged(address nodeAddress, bool nowValidator) external {

    }

}
