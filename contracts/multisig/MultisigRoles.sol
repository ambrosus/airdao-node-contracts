// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract MultisigRoles {

    bytes1 constant CONFIRMATION = bytes1(uint8(0x1));
    bytes1 constant INITIATION = bytes1(uint8(0x2));

    address[] public usersList;
    bytes32[] public rolesList;

    mapping(address => bytes25[]) userPerms;
    mapping(address => bytes32[]) userRoles;
    mapping(bytes32 => bytes25[]) rolePerms;

    mapping(address => mapping(bytes25 => bool)) userPermsMap;
    //    mapping(address => mapping(bytes32 => bool)) userRolesMap;
    mapping(bytes32 => mapping(bytes25 => bool)) rolePermsMap;


    constructor(){

    }

    function setUser(address user, bytes25[] memory perms, bytes32[] memory roles) public {
        bytes25[] memory oldPerms = userPerms[user];
        bytes32[] memory oldRoles = userRoles[user];

        if (oldRoles.length == 0 && oldPerms.length == 0) {
            // new user
            usersList.push(user);
        }

        // remove old perms from map
        for (uint i = 0; i < oldPerms.length; i++) {
            bytes25 oldPerm = oldPerms[i];
            delete userPermsMap[user][oldPerm];
        }
        // no user => roles map, so do nothing


        // set new perms and roles
        userPerms[user] = perms;
        userRoles[user] = roles;

        if (perms.length == 0 && roles.length == 0) {
            // remove user
            _removeValueFromArrayAddr(usersList, user);
            return;
        }

        // set new perms to user => perms map
        for (uint i = 0; i < perms.length; i++) {
            bytes25 newPerm = perms[i];
            userPermsMap[user][newPerm] = true;
        }
        // no user => roles map, so do nothing

    }


    function setRole(bytes32 role, bytes25[] memory perms) public {
        bytes25[] memory oldPerms = rolePerms[role];
        if (oldPerms.length == 0) {
            // new role
            rolesList.push(role);
        }

        // remove old perms from map
        for (uint i = 0; i < oldPerms.length; i++) {
            bytes25 oldPerm = oldPerms[i];
            delete rolePermsMap[role][oldPerm];
        }

        // set mew perms
        rolePerms[role] = perms;

        if (perms.length == 0) {
            // remove role
            _removeValueFromArray32(rolesList, role);

            // remove role from users
            // todo optimize??
            for (uint i = 0; i < usersList.length; i++)
                _removeValueFromArray32(userRoles[usersList[i]], role);

            return;
        }

    }


    function getNeededConfirmsCount(bytes25 perm) public returns (uint) {
        require(perm[24] == CONFIRMATION, "Not the confirmation byte in perm");


        uint confirmationCount;
        for (uint i = 0; i < usersList.length; i++) {
            if (isUserHasPerm(usersList[i], perm))
                confirmationCount ++;
        }
        return confirmationCount;
    }


    function getNeededConfirmsAddresses(bytes25 perm) public view returns (address[] memory) {
        require(perm[24] == CONFIRMATION, "Not the confirmation byte in perm");

        address[] memory result = new address[](usersList.length);
        uint confirmationCount;

        for (uint i = 0; i < usersList.length; i++) {
            if (isUserHasPerm(usersList[i], perm)) {
                result[confirmationCount] = usersList[i];
                confirmationCount++;
            }
        }

        // resize length to confirmationCount
        assembly {mstore(result, confirmationCount)}


        return result;
    }


    function isUserHasPerm(address user, bytes25 perm) public view returns (bool){
        // check that user has perm
        if (userPermsMap[user][perm]) return true;

        // check that any of user roles has perm
        for (uint i = 0; i < userRoles[user].length; i++) {
            bytes32 role = userRoles[user][i];
            if (rolePermsMap[role][perm]) return true;
        }

        return false;
    }


    function _removeValueFromArray32(bytes32[] storage array, bytes32 value) internal {
        uint len = array.length;
        for (uint i = 0; i < len; i++) {
            if (array[i] == value) {
                array[i] = array[len - 1];
                array.pop();
                return;
            }
        }
    }

    function _removeValueFromArrayAddr(address[] storage array, address value) internal {
        uint len = array.length;
        for (uint i = 0; i < len; i++) {
            if (array[i] == value) {
                array[i] = array[len - 1];
                array.pop();
                return;
            }
        }
    }
}
