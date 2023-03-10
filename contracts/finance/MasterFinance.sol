// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Bank.sol";
import "../utils/TransferViaCall.sol";


contract MasterFinance is Ownable {
    uint maxBanks; // = 50;
    uint maxBankBalance; // = 100_000_000 ether;

    Bank[] public banks;

    constructor(address owner, uint maxBanks_, uint maxBankBalance_) {
        maxBanks = maxBanks_;
        maxBankBalance = maxBankBalance_;
        _transferOwnership(owner);
        for (uint i = 0; i < maxBanks_; i++) {
            banks.push(new Bank());
        }
    }

    event Withdraw(address addressTo, uint amount);

    // reentrancy guard doesn't need coz only owner can call this function and multisig (owner) doesn't have this attack in code :)
    function withdraw(address payable addressTo, uint amount) public onlyOwner {
        emit Withdraw(addressTo, amount);

        uint needToSend = amount;
        needToSend -= sendFromThis(addressTo, needToSend);
        for (uint i = 0; i < maxBanks && needToSend > 0; i++) {
            needToSend -= sendFromBank(banks[i], addressTo, needToSend);
        }
        require(needToSend == 0, "transfer amount exceeds balance");

    }


    function transferToBanks() public {
        for (uint i = 0; i < maxBanks; i++) {
            if (address(this).balance == 0) return;
            sendToBank(payable(banks[i]));
        }
    }

    function getBalances() public view returns (address[] memory addresses, uint[] memory balances){
        addresses = new address[](maxBanks+1);
        balances = new uint[](maxBanks+1);

        addresses[0] = address(this);
        balances[0] = addresses[0].balance;
        for (uint i=0; i<maxBanks; i++) {
            addresses[i+1] = address(banks[i]);
            balances[i+1] = addresses[i+1].balance;
        }

        return (addresses, balances);
    }


    function sendFromThis(address payable addressTo, uint needSendAmount) internal returns (uint) {
        uint sendAmount = address(this).balance;
        if (sendAmount == 0) return 0;

        if (sendAmount > needSendAmount) sendAmount = needSendAmount;
        transferViaCall(addressTo, sendAmount);
        return sendAmount;
    }

    function sendFromBank(Bank bank, address payable addressTo, uint needSendAmount) internal returns (uint){
        uint sendAmount = address(bank).balance;
        if (sendAmount == 0) return 0;

        if (sendAmount > needSendAmount) sendAmount = needSendAmount;
        bank.withdraw(addressTo, sendAmount);
        return sendAmount;
    }

    function sendToBank(address payable bank) internal {
        if (bank.balance >= maxBankBalance) return;

        uint needToSendAmount = address(this).balance;
        uint sendAmount = maxBankBalance - bank.balance;
        if (sendAmount > needToSendAmount) sendAmount = needToSendAmount;
        transferViaCall(bank, sendAmount);
    }

    receive() external payable {
        transferToBanks();
    }

}
