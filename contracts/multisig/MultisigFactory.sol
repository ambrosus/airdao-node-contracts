// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./Multisig.sol";
import "./MasterMultisig.sol";
import "./IMultisigFactory.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract MultisigFactory is IMultisigFactory, UUPSUpgradeable, AccessControlUpgradeable {
    bytes32 constant public CREATOR_ROLE = keccak256("CREATOR_ROLE");
    
    mapping(string => address) public multisigs;
    
    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(CREATOR_ROLE, msg.sender);
        __UUPSUpgradeable_init();
    }

    function createMultisig(string calldata name, MultisigSettings calldata settings) external onlyRole(CREATOR_ROLE) returns (address) {
        Multisig newMultisig = new Multisig(
            settings.signers,
            settings.isInitiatorFlags,
            settings.threshold,
            settings.owner
        );

        multisigs[name] = address(newMultisig);
        
        emit MultisigCreated(address(newMultisig));
        return address(newMultisig);
    }
    
    // Register previously deployed multisigs in batch
    function registerMultisigs(address[] calldata _multisigs, string[] calldata _names) external onlyRole(CREATOR_ROLE) {
        for (uint i = 0; i < _multisigs.length; i++) {
            string memory name = _names[i];
            address multisigAddress = _multisigs[i];
            require(multisigAddress != address(0), "Invalid multisig address");
            require(multisigs[name] == address(0), "Already registered");
            
            multisigs[name] = multisigAddress;
            
            emit MultisigRegistered(multisigAddress);
        }
    }
    
    // View functions
    function getMultisigAddress(string calldata _name) external view override returns (address) {
        return multisigs[_name];
    }

    function deleteMultisig(string calldata name) external onlyRole(DEFAULT_ADMIN_ROLE) {
        address multisigAddress = multisigs[name];
        require(multisigAddress != address(0), "Multisig not found");
        
        delete multisigs[name];
        
        emit MultisigDeleted(multisigAddress);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
