pragma solidity ^0.8.6;


import "@openzeppelin/contracts/access/Ownable.sol";


// TODO what if we send amb to contract through submitTransaction but created tx failed?

contract Multisig is Ownable {

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


    event Submission(uint indexed txId);

    event Confirmation(address indexed sender, uint indexed txId);
    event Revocation(address indexed sender, uint indexed txId);

    event Execution(uint indexed txId);

    event SignerAddition(address indexed signer, bool isInitiator);
    event SignerRemoval(address indexed signer);
    event ThresholdChange(uint required);


    // PUBLIC METHODS


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
    function submitTransaction(address destination, uint value, bytes memory data) public payable returns (uint txId) {
        require(isInitiator[msg.sender], "Not a initiator");
        require(msg.value == value, "msg.value != value");
        // we are checking that tx exists via `destination != 0x0` check
        require(destination != address(0), "Destination can't be 0x0");

        uint txId = transactionCount++;
        transactions[txId] = Transaction(destination, value, data, false);

        confirmTransaction(txId);
        emit Submission(txId);
        return txId;
    }

    /// @dev Allows an signer to confirm a transaction.
    /// @param txId Transaction ID.
    function confirmTransaction(uint txId) public signerExists(msg.sender) transactionExists(txId) notExecuted(txId) {
        require(!confirmations[txId][msg.sender], "Already confirmed");
        confirmations[txId][msg.sender] = true;
        emit Confirmation(msg.sender, txId);

        // try to execute
        if (!isConfirmed(txId)) return;

        Transaction storage txn = transactions[txId];
        _executeTransaction(txn.destination, txn.value, txn.data);
        txn.executed = true;
        emit Execution(txId);
    }

    /// @dev Allows an signer to revoke a confirmation for a transaction.
    /// @param txId Transaction ID.
    function revokeConfirmation(uint txId) public notExecuted(txId) {
        require(confirmations[txId][msg.sender], "Not confirmed");
        confirmations[txId][msg.sender] = false;
        emit Revocation(msg.sender, txId);
    }

    function withdraw(address payable to, uint amount) public {
        require(msg.sender == owner() || msg.sender == address(this), "Must be called from owner or from multisig");
        require(address(this).balance >= amount, "amount > balance");
        to.transfer(amount);
    }

    // call this function (using callStatic) to check if there any errors before submitting actual transaction
    function checkBeforeSubmitTransaction(address destination, uint value, bytes memory data) external payable {
        _executeTransaction(destination, value, data);
        revert("OK");
    }

    // VIEW METHODS

    /// @dev Returns list of signers + initiator flags.
    /// @return List of signer addresses, list of initiator flags.
    function getTransactionData(uint txId) public view transactionExists(txId) returns (Transaction memory, address[] memory) {
        return (transactions[txId], getConfirmations(txId));
    }

    /// @dev Returns list of signers + initiator flags.
    /// @return List of signer addresses, list of initiator flags.
    function getSigners() public view returns (address[] memory, bool[] memory) {
        bool[] memory isInitiators = new bool[](signers.length);
        for (uint i = 0; i < signers.length; i++)
            isInitiators[i] = isInitiator[signers[i]];
        return (signers, isInitiators);
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

    function getRequiredSignersCount() public view returns (uint) {
        // ceil aka roundup
        return (signers.length * threshold + 99)/ 100;
    }

    function getInitiatorsCount() public view returns (uint) {
        uint count;
        for (uint i = 0; i < signers.length; i++)
            if (isInitiator[signers[i]]) count++;
        return count;
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
    /// @return result Returns array of transaction IDs.
    function getTransactionIds(uint from, uint to, bool pending, bool executed) public view returns (uint[] memory result) {
        if (to == 0 || to > transactionCount) to = transactionCount;
        require(to >= from, "to < from");

        uint[] memory result = new uint[](to - from);
        uint count = 0;

        for (uint i = from; i < to; i++) {
            if ((transactions[i].executed && executed) || (!transactions[i].executed && pending)) {
                result[count++] = i;
            }
        }
        assembly {mstore(result, count)}
        return result;
    }



    // INTERNAL METHODS

    function _addSigner(address signer, bool isInitiator_) internal {
        if (!isSigner[signer]) {
            signers.push(signer);
            isSigner[signer] = true;
        }
        else if (isInitiator[signer] == isInitiator_)
            revert("Already signer");

        isInitiator[signer] = isInitiator_;
        emit SignerAddition(signer, isInitiator_);
    }

    function _removeSigner(address signer) signerExists(signer) internal {
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
        require(getInitiatorsCount() > 0, "must be at least 1 initiator");
    }


    function _executeTransaction(address destination, uint value, bytes memory data) internal {
        (bool success, bytes memory returndata) = destination.call{value : value}(data);
        if (!success) {
            // revert with same revert message
            // returndata prefixed with Error(string) selector 0x08c379a, so
            // do low level revert that doesn't add second selector
            assembly{revert(add(returndata, 0x20), mload(returndata))}
        }
    }



    /*
     *  Modifiers
     */

    modifier signerExists(address signer) {
        require(isSigner[signer], "Not a signer");
        _;
    }

    modifier transactionExists(uint txId) {
        require(transactions[txId].destination != address(0), "Tx doesn't exists");
        _;
    }

    modifier notExecuted(uint txId) {
        require(!transactions[txId].executed, "Already executed");
        _;
    }

}
