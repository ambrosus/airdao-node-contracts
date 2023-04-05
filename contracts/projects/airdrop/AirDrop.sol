// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../funds/AmbBond.sol";
import "../../utils/TransferViaCall.sol";

contract AirDrop is Ownable {

    AmbBond public ambBondToken;
    address public backendAddress;
    mapping(address => mapping(bytes32 => uint)) public claimed;

    event Claim(address user, bytes32 category, uint amount);

    constructor(address ambBondToken_, address backendAddress_) payable Ownable() {
        ambBondToken = AmbBond(ambBondToken_);
        backendAddress = backendAddress_;
    }

    function claim(bytes32 category, uint amount, bytes memory signature) public {
        require(claimed[msg.sender][category] == 0, "Already claimed");
        checkSignature(msg.sender, category, amount, signature);

        claimed[msg.sender][category] = amount;
        require(ambBondToken.balanceOf(address(this)) >= amount, "Run out of tokens");
        ambBondToken.transfer(msg.sender, amount);
        emit Claim(msg.sender, category, amount);
    }

    function getClaimed(address user, bytes32[] memory categories) public view returns(uint[] memory) {
        uint[] memory result = new uint[](categories.length);
        for (uint i = 0; i < categories.length; i++)
            result[i] = claimed[user][categories[i]];
        return result;
    }


    // onlyOwner

    function withdraw(address payable addressTo, uint amount) public onlyOwner {
        transferViaCall(addressTo, amount);
    }

    function changeBackendAddress(address backendAddress_) public onlyOwner {
        backendAddress = backendAddress_;
    }

    // internal

    function checkSignature(address user, bytes32 category, uint amount, bytes memory signature) internal view {
        bytes32 messageHash = keccak256(abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(user, category, amount))
            ));
        require(ecdsaRecover(messageHash, signature) == backendAddress, "Wrong signature");
    }


    function ecdsaRecover(bytes32 messageHash, bytes memory signature) pure internal returns(address) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
            if lt(v, 27) {v := add(v, 27)}
        }
        return ecrecover(messageHash, v, r, s);
    }
}
