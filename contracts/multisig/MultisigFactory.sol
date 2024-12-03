// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./Multisig.sol";
import "./MasterMultisig.sol";
import "./IMultisigFactory.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract MultisigFactory is IMultisigFactory, UUPSUpgradeable, AccessControlUpgradeable {
    bytes32 constant public CREATOR_ROLE = keccak256("CREATOR_ROLE");
    
    mapping(address => bool) public registeredMultisigs;
    
    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(CREATOR_ROLE, msg.sender);
        __UUPSUpgradeable_init();
    }

    function createMultisig(MultisigSettings calldata settings) external onlyRole(CREATOR_ROLE) returns (address) {
        Multisig newMultisig = new Multisig(
            settings.signers,
            settings.isInitiatorFlags,
            settings.threshold,
            settings.owner
        );

        registeredMultisigs[address(newMultisig)] = true;
        
        emit MultisigCreated(address(newMultisig));
        return address(newMultisig);
    }
    
    // Register previously deployed multisigs in batch
    function registerMultisigs(address[] calldata _multisigs) external onlyRole(CREATOR_ROLE) {
        for (uint i = 0; i < _multisigs.length; i++) {
            address multisigAddress = _multisigs[i];
            require(multisigAddress != address(0), "Invalid multisig address");
            require(!registeredMultisigs[multisigAddress], "Already registered");
            
            registeredMultisigs[multisigAddress] = true;
            
            emit MultisigRegistered(multisigAddress);
        }
    }
    
    function isRegisteredMultisig(address multisig) external view override returns (bool) {
        return registeredMultisigs[multisig];
    }

    function deleteMultisig(address multisigAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(registeredMultisigs[multisigAddress], "Multisig not found");
        
        delete registeredMultisigs[multisigAddress];
        
        emit MultisigDeleted(multisigAddress);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
