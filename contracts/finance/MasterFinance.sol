// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Bank.sol";

contract MasterFinance is Ownable {
    Bank[] public banks;

    uint constant maxBanks = 50;
    uint constant maxBankBalance = 100_000_000 ether;

    constructor(address owner) {
        _transferOwnership(owner);
    }

    event Withdraw(address addressTo, uint amount);

    function withdraw(address payable addressTo, uint amount) public onlyOwner {
        uint needToSend = amount;

        while (needToSend > 0) {
            require(banks.length > 0, "No money :(");

            uint amountToSend = address(banks[banks.length - 1]).balance;
            if (amountToSend > needToSend) amountToSend = needToSend;

            banks[banks.length - 1].withdraw(addressTo, amountToSend);
            if (address(banks[banks.length - 1]).balance == 0) {
                banks.pop();
            }

            needToSend -= amountToSend;
        }
        emit Withdraw(addressTo, amount);
    }

    function createBanks() public {
        require(address(this).balance >= maxBanks * maxBankBalance, "Not enough funds on this contract");
        for (uint i=0; i<maxBanks; i++) {
            banks.push(new Bank{value: maxBankBalance}());
        }
    }

}
