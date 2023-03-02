// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../utils/TransferViaCall.sol";

contract Bank is Ownable {

    constructor() payable Ownable() {}

    function withdraw(address payable addressTo, uint amount) public onlyOwner {
        transferViaCall(addressTo, amount);
    }


    receive() external payable {}
}
