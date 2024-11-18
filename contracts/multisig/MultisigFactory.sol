// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./Multisig.sol";
import "./MasterMultisig.sol";
import "./IMultisigFactory.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract MultisigFactory is IMultisigFactory, UUPSUpgradeable, AccessControlUpgradeable {
    bytes32 constant public CREATOR_ROLE = keccak256("CREATOR_ROLE");
    
    // Track ecosystem and common multisigs separately
    Multisig[] public multisigs;
    mapping(address => bool) public isRegisteredMultisig;
    
    function initialize(address ecosystemMaster, address commonMaster) public initializer {
        require(ecosystemMaster != address(0), "Invalid ecosystem master");
        require(commonMaster != address(0), "Invalid common master");

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

        multisigs.push(newMultisig);
        isRegisteredMultisig[address(newMultisig)] = true;
        
        emit MultisigCreated(address(newMultisig));
        return address(newMultisig);
    }
    
    // Register previously deployed multisigs in batch
    function registerMultisigs(address[] calldata _multisigs) external onlyRole(CREATOR_ROLE) {
        for (uint i = 0; i < _multisigs.length; i++) {
            address multisigAddress = _multisigs[i];
            require(multisigAddress != address(0), "Invalid multisig address");
            require(!isRegisteredMultisig[multisigAddress], "Already registered");
            
            Multisig multisig = Multisig(multisigAddress);
            multisigs.push(multisig);
            isRegisteredMultisig[multisigAddress] = true;
            
            emit MultisigRegistered(multisigAddress);
        }
    }
    
    // View functions
    function getMultisigsCount() external view returns (uint256) {
        return multisigs.length;
    }
    
    function getMultisigsAddresses() external view returns (address[] memory) {
        address[] memory addresses = new address[](multisigs.length);
        for (uint i = 0; i < multisigs.length; i++) {
            addresses[i] = address(multisigs[i]);
        }
        return addresses;
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
