// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./MultisigRoles.sol";

contract Multisig is MultisigRoles {

    /*
     *  Storage
     */
    mapping(uint => Transaction) public transactions;
    mapping(uint => mapping(address => bool)) public confirmations;

    uint public transactionCount;

    uint public defaultThreshold = 51;

    struct Transaction {
        address destination;
        uint value;
        bytes data;
        bool executed;
    }


    /*
     *  Events
     */

    event Submission(uint indexed txId);

    event Confirmation(address indexed sender, uint indexed txId);
    event Revocation(address indexed sender, uint indexed txId);

    event Execution(uint indexed txId, bool success);


    /*
     * Public functions
     */
    constructor() {
        // todo list of users that can initiate and confirm `setUser` method

    }

    /// @dev Submit and confirm a transaction.
    /// @param destination Transaction target address.
    /// @param value Transaction ether value.
    /// @param data Transaction data payload.
    /// @return txId Returns transaction ID.
    function submitTransaction(
        address destination,
        uint value,
        bytes memory data
    ) public returns (uint txId)    {
        bytes25 perm = _getPerm(destination, data, INITIATION);
        require(isUserHasPerm(msg.sender, perm), "no initiation perm");


        txId = addTransaction(destination, value, data);
        confirmTransaction(txId);
    }

    /// @dev Confirm a transaction.
    /// @param txId Transaction ID.
    function confirmTransaction(uint txId) public hasConfirmPerm(msg.sender, txId) transactionExists(txId) {
        require(!confirmations[txId][msg.sender], "Already confirmed");

        confirmations[txId][msg.sender] = true;
        emit Confirmation(msg.sender, txId);
        executeTransaction(txId);
    }

    /// @dev Revoke a confirmation for a transaction.
    /// @param txId Transaction ID.
    function revokeConfirmation(uint txId) public hasConfirmPerm(msg.sender, txId) confirmedByUser(txId, msg.sender) notExecuted(txId) {
        confirmations[txId][msg.sender] = false;
        emit Revocation(msg.sender, txId);
    }

    /// @dev Execute a confirmed transaction. FIXME (CAN BE CALLED BY ANYONE)
    /// @param txId Transaction ID.
    function executeTransaction(uint txId) public hasConfirmPerm(msg.sender, txId) confirmedByUser(txId, msg.sender) notExecuted(txId) {
        if (!isConfirmed(txId)) return;

        Transaction storage txn = transactions[txId];
        bool success = external_call(txn.destination, txn.value, txn.data.length, txn.data);

        emit Execution(txId, success);
        txn.executed = success;
    }

    /// @dev Returns the confirmation status of a transaction.
    /// @param txId Transaction ID.
    /// @return Confirmation status.
    function isConfirmed(uint txId) public view returns (bool)    {
        // todo threshold for this perms
        bytes25 perm = getConfirmPerm(transactions[txId]);
        address[] memory owners = getNeededConfirmsAddresses(perm);
        uint requiredCount = owners.length * defaultThreshold / 100;

        uint count = 0;
        for (uint i = 0; i < owners.length; i++) {
            if (confirmations[txId][owners[i]]) count += 1;
            if (count >= requiredCount) return true;
        }
        return false;
    }


    /*
     * Web3 call functions
     */

    //    /// @dev Returns number of confirmations of a transaction.
    //    /// @param txId Transaction ID.
    //    /// @return count Number of confirmations.
    //    function getConfirmationCount(uint txId) public view returns (uint count)    {
    //        for (uint i = 0; i < owners.length; i++)
    //            if (confirmations[txId][owners[i]])
    //                count += 1;
    //    }
    //

    /// @dev Returns array with owner addresses, which confirmed transaction.
    /// @param txId Transaction ID.
    /// @return _confirmations Returns array of owner addresses.
    function getConfirmations(uint txId) public view returns (address[] memory _confirmations)    {
        bytes25 perm = getConfirmPerm(transactions[txId]);
        address[] memory owners = getNeededConfirmsAddresses(perm);


        address[] memory result = new address[](owners.length);
        uint count = 0;
        for (uint i = 0; i < owners.length; i++) {
            if (confirmations[txId][owners[i]]) {
                result[count] = owners[i];
                count += 1;
            }
        }

        // resize length to count
        assembly {mstore(result, count)}

        return result;

    }


    /*
     * Internal functions
     */


    /// @dev Adds a new transaction to the transaction mapping
    /// @param destination Transaction target address.
    /// @param value Transaction ether value.
    /// @param data Transaction data payload.
    /// @return txId Returns transaction ID.
    function addTransaction(
        address destination,
        uint value,
        bytes memory data
    ) internal returns (uint txId)    {
        txId = transactionCount;
        transactions[txId] = Transaction({
        destination : destination,
        value : value,
        data : data,
        executed : false
        });
        transactionCount += 1;
        emit Submission(txId);
    }


    // call has been separated into its own function in order to take advantage
    // of the Solidity's code generator to produce a loop that copies tx.data into memory.
    function external_call(address destination, uint value, uint dataLength, bytes memory data) private returns (bool) {
        bool result;
        assembly {
            let x := mload(0x40)   // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
            let d := add(data, 32) // First 32 bytes are the padded length of data, so exclude that
            result := call(
            sub(gas(), 34710), // 34710 is the value that solidity is currently emitting
            // It includes callGas (700) + callVeryLow (3, to pay for SUB) + callValueTransferGas (9000) +
            // callNewAccountGas (25000, in case the destination address does not exist and needs creating)

            destination,
            value,
            d,
            dataLength, // Size of the input (in bytes) - this is what fixes the padding problem
            x,
            0                  // Output is ignored, therefore the output size is zero
            )
        }
        return result;
    }



    function getConfirmPerm(Transaction memory tx_) public view returns (bytes25) {
        return _getPerm(tx_.destination, tx_.data, CONFIRMATION);
    }

    function _getPerm(address addr, bytes memory data, bytes1 action) public view returns (bytes25) {
        return bytes25(abi.encodePacked(addr, getSelectorFromData(data), action));
    }

    function getSelectorFromData(bytes memory data) internal view returns (bytes4 result) {
        if (data.length == 0) return 0x0;
        assembly {
            result := mload(add(data, 32))
        }
    }


    /*
     *  Modifiers
     */
    modifier onlyWallet() {
        require(msg.sender == address(this));
        _;
    }

    modifier transactionExists(uint txId) {
        require(transactions[txId].destination != address(0));
        _;
    }

    modifier confirmedByUser(uint txId, address user) {
        require(confirmations[txId][user]);
        _;
    }

    modifier notExecuted(uint txId) {
        require(!transactions[txId].executed);
        _;
    }

    modifier hasConfirmPerm(address sender, uint txId) {
        require(isUserHasPerm(sender, getConfirmPerm(transactions[txId])), "no confirmation perm");
        _;
    }


}
