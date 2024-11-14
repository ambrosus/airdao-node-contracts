// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./Multisig.sol";
import "./MasterMultisig.sol";
import "./IMultisigFactory.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract MultisigFactory is IMultisigFactory, UUPSUpgradeable, AccessControlUpgradeable {
    bytes32 constant public CREATOR_ROLE = keccak256("CREATOR_ROLE");
    // Master multisigs
    MultisigSettings public ecosystemMultisigSettings;
    MultisigSettings public commonMultisigSettings;
    
    // Track ecosystem and common multisigs separately
    Multisig[] public ecosystemMultisigs;
    Multisig[] public commonMultisigs;
    mapping(address => bool) public isRegisteredMultisig;
    mapping(address => bool) public isEcosystemMultisig;
    
    function initialize(address ecosystemMaster, address commonMaster) public initializer {
        require(ecosystemMaster != address(0), "Invalid ecosystem master");
        require(commonMaster != address(0), "Invalid common master");

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(CREATOR_ROLE, msg.sender);
        __UUPSUpgradeable_init();

        address[] memory ecoSigners = new address[](3);
        ecoSigners[0] = Aleksandr;
        ecoSigners[1] = Andrii;
        ecoSigners[2] = Igor2;

        bool[] memory ecoFlags = new bool[](3);
        ecoFlags[0] = true;
        ecoFlags[1] = true;
        ecoFlags[2] = true;

        ecosystemMultisigSettings = MultisigSettings({
            signers: ecoSigners,
            isInitiatorFlags: ecoFlags,
            threshold: 51,
            owner: ecosystemMaster
        });

        address[] memory commonSigners = new address[](11);
        commonSigners[0] = Valerii;
        commonSigners[1] = Oleksii;
        commonSigners[2] = Olena;
        commonSigners[3] = Igor;
        commonSigners[4] = Andrii;
        commonSigners[5] = Alina;
        commonSigners[6] = Alex;
        commonSigners[7] = Seth;
        commonSigners[8] = Sophie;
        commonSigners[9] = Matthieu;
        commonSigners[10] = Michael;

        bool[] memory commonFlags = new bool[](11);
        commonFlags[0] = true;
        commonFlags[1] = true;
        commonFlags[2] = true;
        commonFlags[3] = true;
        commonFlags[4] = true;
        commonFlags[5] = true;
        commonFlags[6] = true;
        commonFlags[7] = true;
        commonFlags[8] = true;
        commonFlags[9] = true;
        commonFlags[10] = true;

        commonMultisigSettings = MultisigSettings({
            signers: commonSigners,
            isInitiatorFlags: commonFlags,
            threshold: 50,
            owner: commonMaster
        });
    }
    
    // Create new multisig under ecosystem master
    function createEcosystemMultisig() external onlyRole(CREATOR_ROLE) returns (address) {
        return _createMultisig(ecosystemMultisigSettings);
    }
    
    // Create new multisig under common master
    function createCommonMultisig() external onlyRole(CREATOR_ROLE) returns (address) {
        return _createMultisig(commonMultisigSettings);
    }
    
    // Register previously deployed multisigs in batch
    function registerMultisigs(address[] calldata _multisigs) external onlyRole(CREATOR_ROLE) {
        for (uint i = 0; i < _multisigs.length; i++) {
            address multisigAddress = _multisigs[i];
            require(multisigAddress != address(0), "Invalid multisig address");
            require(!isRegisteredMultisig[multisigAddress], "Already registered");
            
            Multisig multisig = Multisig(multisigAddress);
            address master = multisig.owner();
            
            if (master == address(ecosystemMultisigSettings.owner)) {
                ecosystemMultisigs.push(multisig);
                isEcosystemMultisig[multisigAddress] = true;
            } else if (master == address(commonMultisigSettings.owner)) {
                commonMultisigs.push(multisig);
            } else {
                revert("Invalid master multisig");
            }
            isRegisteredMultisig[multisigAddress] = true;
            
            emit MultisigRegistered(multisigAddress);
        }
    }
    
    // View functions
    function getEcosystemMultisigSettings() external view returns (MultisigSettings memory) {
        return ecosystemMultisigSettings;
    }

    function getCommonMultisigSettings() external view returns (MultisigSettings memory) {
        return commonMultisigSettings;
    }

    function getEcosystemMultisigsCount() external view returns (uint256) {
        return ecosystemMultisigs.length;
    }
    
    function getCommonMultisigsCount() external view returns (uint256) {
        return commonMultisigs.length;
    }
    
    function getAllMultisigsAddresses() external view returns (address[] memory) {
        uint256 totalLength = ecosystemMultisigs.length + commonMultisigs.length;
        address[] memory addresses = new address[](totalLength);
        
        for (uint i = 0; i < ecosystemMultisigs.length; i++) {
            addresses[i] = address(ecosystemMultisigs[i]);
        }
        
        for (uint i = 0; i < commonMultisigs.length; i++) {
            addresses[ecosystemMultisigs.length + i] = address(commonMultisigs[i]);
        }
        
        return addresses;
    }
    
    function getEcosystemMultisigsAddresses() external view returns (address[] memory) {
        address[] memory addresses = new address[](ecosystemMultisigs.length);
        for (uint i = 0; i < ecosystemMultisigs.length; i++) {
            addresses[i] = address(ecosystemMultisigs[i]);
        }
        return addresses;
    }
    
    function getCommonMultisigsAddresses() external view returns (address[] memory) {
        address[] memory addresses = new address[](commonMultisigs.length);
        for (uint i = 0; i < commonMultisigs.length; i++) {
            addresses[i] = address(commonMultisigs[i]);
        }
        return addresses;
    }

    // Internal function to create multisig
    function _createMultisig(MultisigSettings memory settings) internal returns (address) {
        Multisig newMultisig = new Multisig(
            settings.signers,
            settings.isInitiatorFlags,
            settings.threshold,
            settings.owner
        );
        
        if (settings.owner == address(ecosystemMultisigSettings.owner)) {
            ecosystemMultisigs.push(newMultisig);
            isEcosystemMultisig[address(newMultisig)] = true;
        } else {
            commonMultisigs.push(newMultisig);
        }
        isRegisteredMultisig[address(newMultisig)] = true;
        
        emit MultisigCreated(address(newMultisig));
        return address(newMultisig);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
