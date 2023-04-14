// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../funds/AirBond.sol";
import "../../utils/TransferViaCall.sol";

contract AirDrop is Ownable {

    AirBond public airBondToken;
    address public backendAddress;
    uint public minAmbBalance;
    mapping(address => mapping(bytes32 => uint)) public claimed;

    event Claim(address user, bytes32[] categories, uint[] amounts);

    constructor(address airBondToken_, address backendAddress_, uint minAmbBalance_) payable Ownable() {
        airBondToken = AirBond(airBondToken_);
        backendAddress = backendAddress_;
        minAmbBalance = minAmbBalance_;
    }

    function claim(bytes32[] memory categories, uint[] memory amounts, bytes memory signature) public {
        require(msg.sender.balance >= minAmbBalance, "Not enough AMB");
        require(categories.length == amounts.length, "categories.length != amounts.length");

        checkSignature(msg.sender, categories, amounts, signature);

        uint amountsSum;
        for (uint i = 0; i < categories.length; i++) {
            claimed[msg.sender][categories[i]] = amounts[i];
            amountsSum += amounts[i];
        }

        require(airBondToken.balanceOf(address(this)) >= amountsSum, "Run out of tokens");
        airBondToken.transfer(msg.sender, amountsSum);

        emit Claim(msg.sender, categories, amounts);
    }

    function getClaimed(address user, bytes32[] memory categories) public view returns (uint[] memory) {
        uint[] memory result = new uint[](categories.length);
        for (uint i = 0; i < categories.length; i++)
            result[i] = claimed[user][categories[i]];
        return result;
    }


    // onlyOwner

    function withdraw(address payable addressTo, uint amount) public onlyOwner {
        airBondToken.transfer(addressTo, amount);
    }

    function changeBackendAddress(address backendAddress_) public onlyOwner {
        backendAddress = backendAddress_;
    }

    function changeMinAmbBalance(uint minAmbBalance_) public onlyOwner {
        minAmbBalance = minAmbBalance_;
    }

    // internal

    function checkSignature(address user, bytes32[] memory categories, uint[] memory amounts, bytes memory signature) internal view {
        bytes memory categoriesConcat;
        bytes memory amountsConcat;

        for (uint i = 0; i < categories.length; i++) {
            categoriesConcat = abi.encodePacked(categoriesConcat, categories[i]);
            amountsConcat = abi.encodePacked(amountsConcat, amounts[i]);
        }

        bytes32 messageHash = keccak256(abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(user, keccak256(categoriesConcat), keccak256(amountsConcat)))
            ));

        require(ecdsaRecover(messageHash, signature) == backendAddress, "Wrong signature");
    }


    function ecdsaRecover(bytes32 messageHash, bytes memory signature) pure internal returns (address) {
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
