// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";


contract Finance is Ownable {
    constructor(address owner){
        _transferOwnership(owner);
    }

    event Withdraw(address addressTo, uint amount);

    function withdraw(address payable addressTo, uint amount) public onlyOwner {
        require(address(this).balance >= amount, "transfer amount exceeds balance");
        addressTo.transfer(amount);
        emit Withdraw(addressTo, amount);
    }

    receive() external payable {}

}
