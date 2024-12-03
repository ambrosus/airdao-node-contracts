// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./Multisig.sol";
import "./MasterMultisig.sol";

interface IMultisigFactory {
    struct MultisigSettings {
        address[] signers;
        bool[] isInitiatorFlags;
        uint threshold;
        address owner;
    }

    // Events
    event MultisigCreated(address indexed multisig);
    event MultisigRegistered(address indexed multisig);
    event MultisigDeleted(address indexed multisig);

    function createMultisig(MultisigSettings calldata settings) external returns (address);
    function deleteMultisig(address multisigAddress) external;
    function registerMultisigs(address[] calldata _multisigsAddresses) external;
    function isRegisteredMultisig(address multisig) external view returns (bool);

}

