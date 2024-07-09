// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./LiquidPool.sol";


contract StAMB is ERC20, AccessControl {
    LiquidPool public liquidPool;

    constructor(LiquidPool liquidPool_) ERC20("Staked AMB", "StAMB") {
        liquidPool = liquidPool_;
        _setupRole(DEFAULT_ADMIN_ROLE, address(liquidPool));
    }

    function mint(address account, uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(account, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        liquidPool.beforeTokenTransfer(from, to, amount);
    }

}

