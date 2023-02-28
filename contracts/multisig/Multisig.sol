pragma solidity ^0.8.6;


import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract Multisig is Ownable {
    /*
     *  Storage
     */

    address[] public signers;
    mapping(address => bool) public isSigner;
    mapping(address => bool) public isInitiator;

    mapping(uint => Transaction) public transactions;
    mapping(uint => mapping(address => bool)) public confirmations;
    uint public transactionCount;

    uint public threshold;

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

//        event Deposit(address indexed sender, uint value);

    event SignerAddition(address indexed signer, bool isInitiator);
    event SignerRemoval(address indexed signer);
    event ThresholdChange(uint required);

    /*
     * Public functions
     */
    /// @dev Contract constructor sets initial signers and required number of confirmations.
    /// @param _signers List of initial signers.
    constructor (
        address[] memory _signers, bool[] memory isInitiatorFlags,
        uint _threshold, address owner
    ) public {
        _changeSigners(new address[](0), _signers, isInitiatorFlags);
        _changeThreshold(_threshold);
        _transferOwnership(owner);
    }


    function changeSigners(address[] memory signersToRemove, address[] memory signersToAdd, bool[] memory isInitiatorFlags) public onlyOwner {
        _changeSigners(signersToRemove, signersToAdd, isInitiatorFlags);
        _validateSigners();
    }

    function _changeSigners(address[] memory signersToRemove, address[] memory signersToAdd, bool[] memory isInitiatorFlags) internal virtual {
        require(signersToAdd.length == isInitiatorFlags.length, "signersToAdd.length != isInitiatorFlag.length");

        uint i;
        for (i = 0; i < signersToRemove.length; i++)
            _removeSigner(signersToRemove[i]);

        for (i = 0; i < signersToAdd.length; i++)
            _addSigner(signersToAdd[i], isInitiatorFlags[i]);
    }


    /// @dev Allows to change the number of required confirmations. Transaction has to be sent by wallet.
    /// @param _threshold Number of required confirmations.
    function changeThreshold(uint _threshold) public onlyOwner {
        _changeThreshold(_threshold);
        _validateSigners();
    }

    function _changeThreshold(uint _threshold) internal {
        require(_threshold <= 100, "threshold must be <= 100");
        threshold = _threshold;
        emit ThresholdChange(_threshold);
    }

    /// @dev Allows an signer to submit and confirm a transaction.
    /// @param destination Transaction target address.
    /// @param value Transaction ether value.
    /// @param data Transaction data payload.
    /// @return txId Returns transaction ID.
    function submitTransaction(address destination, uint value, bytes memory data) public returns (uint txId) {
        require(isInitiator[msg.sender], "not a initiator");
        require(destination != address(0), "destination can't be 0x0");
        // we are checking that tx exists via `destination != 0x0` check
        txId = addTransaction(destination, value, data);
        confirmTransaction(txId);
    }

    /// @dev Allows an signer to confirm a transaction.
    /// @param txId Transaction ID.
    function confirmTransaction(uint txId) public signerExists(msg.sender) transactionExists(txId) notConfirmed(txId, msg.sender) {
        confirmations[txId][msg.sender] = true;
        emit Confirmation(msg.sender, txId);
        executeTransaction(txId);
    }

    /// @dev Allows an signer to revoke a confirmation for a transaction.
    /// @param txId Transaction ID.
    function revokeConfirmation(uint txId) public signerExists(msg.sender) confirmed(txId, msg.sender) notExecuted(txId) {
        confirmations[txId][msg.sender] = false;
        emit Revocation(msg.sender, txId);
    }

    /// @dev Allows anyone to execute a confirmed transaction.
    /// @param txId Transaction ID.
    function executeTransaction(uint txId) public signerExists(msg.sender) confirmed(txId, msg.sender) notExecuted(txId) {
        if (!isConfirmed(txId)) return;
        Transaction storage txn = transactions[txId];

        bool success = external_call(txn.destination, txn.value, txn.data.length, txn.data);
        emit Execution(txId, success);
        txn.executed = success;
    }



    /// @dev Returns the confirmation status of a transaction.
    /// @param txId Transaction ID.
    /// @return Confirmation status.
    function isConfirmed(uint txId) public view returns (bool) {
        uint requiredCount = getRequiredSignersCount();

        uint count = 0;
        for (uint i = 0; i < signers.length; i++) {
            if (confirmations[txId][signers[i]]) count += 1;
            if (count >= requiredCount) return true;
        }
        return false;
    }

    /*
     * Internal functions
     */

    // call has been separated into its own function in order to take advantage
    // of the Solidity's code generator to produce a loop that copies tx.data into memory.
    function external_call(address destination, uint value, uint dataLength, bytes memory data) internal returns (bool) {
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

    /// @dev Adds a new transaction to the transaction mapping, if transaction does not exist yet.
    /// @param destination Transaction target address.
    /// @param value Transaction ether value.
    /// @param data Transaction data payload.
    /// @return txId Returns transaction ID.
    function addTransaction(address destination, uint value, bytes memory data) internal returns (uint txId) {
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

    function _addSigner(address signer, bool isInitiator_) internal {
        require(!isSigner[signer], "Already signer");

        signers.push(signer);
        isSigner[signer] = true;
        isInitiator[signer] = isInitiator_;

        emit SignerAddition(signer, isInitiator_);
    }

    function _removeSigner(address signer) internal {
        require(isSigner[signer], "Not a signer");

        for (uint i = 0; i < signers.length; i++) {
            if (signers[i] == signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }

        isSigner[signer] = false;
        isInitiator[signer] = false;
        emit SignerRemoval(signer);
    }


    function _validateSigners() internal virtual {
        require(getRequiredSignersCount() > 0, "required signers must be > 0");
        // at least 1 isInitiator
        // todo something else?
    }


    /*
     * Web3 call functions
     */

    /// @dev Returns list of signers + initiator flags.
    /// @return List of signer addresses, list of initiator flags.
    function getSigners() public view returns (address[] memory, bool[] memory) {
        bool[] memory isInitiators = new bool[](signers.length);
        for (uint i = 0; i < signers.length; i++)
            isInitiators[i] = isInitiator[signers[i]];
        return (signers, isInitiators);
    }

    /// @dev Returns list of signers + initiator flags.
    /// @return List of signer addresses, list of initiator flags.
    function getTransactionData(uint txId) public view transactionExists(txId) returns (Transaction memory, address[] memory) {
        return (transactions[txId], getConfirmations(txId));
    }





    function getRequiredSignersCount() public view returns (uint) {
        return signers.length * threshold / 100;
    }


    /// @dev Returns array with signer addresses, which confirmed transaction.
    /// @param txId Transaction ID.
    /// @return Returns array of signer addresses.
    function getConfirmations(uint txId) public view returns (address[] memory) {
        address[] memory result = new address[](signers.length);

        uint count = 0;
        for (uint i = 0; i < signers.length; i++) {
            if (confirmations[txId][signers[i]]) {
                result[count] = signers[i];
                count += 1;
            }
        }

        // resize length to count
        assembly {mstore(result, count)}
        return result;
    }

    /// @dev Returns list of transaction IDs in defined range.
    /// @param from Index start position of transaction array.
    /// @param to Index end position of transaction array.
    /// @param pending Include pending transactions.
    /// @param executed Include executed transactions.
    /// @return _txIds Returns array of transaction IDs.
    function getTransactionIds(uint from, uint to, bool pending, bool executed) public view returns (uint[] memory _txIds) {
        uint[] memory txIdsTemp = new uint[](transactionCount);
        uint count = 0;
        uint i;
        for (i = 0; i < transactionCount; i++)
            if (pending && !transactions[i].executed
            || executed && transactions[i].executed)
            {
                txIdsTemp[count] = i;
                count += 1;
            }
        _txIds = new uint[](to - from);
        for (i = from; i < to; i++)
            _txIds[i - from] = txIdsTemp[i];
    }

//
//    /// @dev receive function allows to deposit ether.
//    receive() external payable {
//        if (msg.value > 0)
//            emit Deposit(msg.sender, msg.value);
//    }





    /*
     *  Modifiers
     */
    modifier onlyWallet() {
        require(msg.sender == address(this), "only wallet");
        _;
    }


    modifier signerExists(address signer) {
        require(isSigner[signer], "not a signer");
        _;
    }

    modifier transactionExists(uint txId) {
        require(transactions[txId].destination != address(0), "tx doesn't exists");
        _;
    }

    modifier confirmed(uint txId, address signer) {
        require(confirmations[txId][signer], "not confirmed by user");
        _;
    }

    modifier notConfirmed(uint txId, address signer) {
        require(!confirmations[txId][signer], "already confirmed by user");
        _;
    }

    modifier notExecuted(uint txId) {
        require(!transactions[txId].executed, "already executed");
        _;
    }

}