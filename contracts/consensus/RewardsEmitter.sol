// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract RewardsEmitter is AccessControl {
    bytes32 public constant EMITTER_ROLE = keccak256("EMITTER_ROLE");

    event Reward(
        address indexed manager,
        address indexed nodeAddress,
        address indexed nodeOwner,
        address rewardReceiver,
        address tokenAddress,
        uint256 amount
    );

    constructor(){
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function emitReward(address manager, address nodeAddress, address nodeOwner, address rewardReceiver, address tokenAddress, uint256 amount) external onlyRole(EMITTER_ROLE) {
        emit Reward(manager, nodeAddress, nodeOwner, rewardReceiver, tokenAddress, amount);
    }

}
