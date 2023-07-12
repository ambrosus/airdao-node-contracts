// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./MasterMultisig.sol";

contract TEST_MasterMultisig is MasterMultisig {
    constructor(
        address[] memory _signers, bool[] memory isInitiatorFlags,
        uint _threshold
    ) MasterMultisig(_signers, isInitiatorFlags, _threshold) {
        _validateSigners();
    }


    function setTransaction(uint txId, Transaction memory transaction) public {
        transactions[txId] = transaction;
        if (transactionCount < txId+1) transactionCount = txId+1;
    }

}
