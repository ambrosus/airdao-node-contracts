// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IStakeManager.sol";
import "../consensus/IValidatorSet.sol";

contract TEST_Pool_Manager is IStakeManager {
    IValidatorSet public validatorSet; // contract that manages validator set

    constructor(
        address _validatorSet
    ) {
        validatorSet = IValidatorSet(_validatorSet);
    }

    function addStake(address nodeAddress) payable public {
        if (validatorSet.getNodeStake(nodeAddress) == 0)
            validatorSet.newStake(nodeAddress, msg.value, false);
        else 
            validatorSet.stake(nodeAddress, msg.value);
    }

    function removeStake(address nodeAddress, uint amount) public {
        require(validatorSet.getNodeStake(nodeAddress) >= amount, "Stake < amount");

        validatorSet.unstake(nodeAddress, amount);
        payable(msg.sender).transfer(amount);
    }


    function reward(address nodeAddress, uint amount) external {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");

        address payable ownerAddress = payable(nodeAddress);
        ownerAddress.transfer(amount);
    }

    function report(address nodeAddress) external {

    }
}
