// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;


// Use this method when receiver can be contract with receive() or fallback() function
// DO NOT FORGET ABOUT REENTRANCY GUARD WHILE USING THIS METHOD

function transferViaCall(address payable addressTo, uint amount) {
    (bool sent, bytes memory d) = addressTo.call{value: amount}("");
    require(sent, "Transfer failed");
}
