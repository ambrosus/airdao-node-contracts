// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Bank is Ownable {

    constructor() payable Ownable() {}

    function withdraw(address payable addressTo, uint amount) public onlyOwner {
        addressTo.transfer(amount);
    }


    receive() external payable {}
}
