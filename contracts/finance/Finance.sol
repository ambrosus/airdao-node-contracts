// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";


contract Finance is Ownable {
    constructor(address owner){
        _transferOwnership(owner);
    }

    function withdraw(address addressTo, uint amount) public onlyOwner {
        // todo
    }

}
