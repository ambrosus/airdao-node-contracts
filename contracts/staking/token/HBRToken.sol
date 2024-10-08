// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract HBRToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");  // can use mint / burn methods

    constructor(address admin) ERC20("Harbor", "HBR") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(address account, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(account, amount);
    }
}
