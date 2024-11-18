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

    function createMultisig(MultisigSettings calldata settings) external returns (address);
    function registerMultisigs(address[] calldata _multisigs) external;
    function getMultisigsCount() external view returns (uint256);
    function getMultisigsAddresses() external view returns (address[] memory);

}

