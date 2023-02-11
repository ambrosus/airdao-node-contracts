// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract AmbBank {
    constructor() payable {

    }

    event Rewarded(address indexed address_, uint256 amount);

    function reward(address payable to, uint256 amount) external {
        to.transfer(amount);
        emit Rewarded(to, amount);
    }

    receive() external payable {

    }
}
