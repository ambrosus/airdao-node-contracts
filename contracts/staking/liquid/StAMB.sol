// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./LiquidPool.sol";


contract StAMB is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");  // can use mint / burn methods


    LiquidPool public liquidPool;
    mapping(address => uint) public obtainedAt;
    mapping(address => uint) public holdingTime;
    mapping(address => uint) public lastHoldingTimeUpdate;

    constructor() ERC20("Staked AMB", "StAMB") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function mint(address account, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public onlyRole(MINTER_ROLE) {
        _burn(account, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        liquidPool.beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        if (balanceOf(from) == 0)
            obtainedAt[from] = 0;

        if (obtainedAt[to] == 0 && balanceOf(to) > 0)
            obtainedAt[to] = block.timestamp;
    }

    function setLiquidPool(LiquidPool liquidPool_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(MINTER_ROLE, address(liquidPool));
        liquidPool = liquidPool_;
        _setupRole(MINTER_ROLE, address(liquidPool_));
    }

    function calculateHoldingTime(address user) public returns (uint) {
        if (obtainedAt[user] == 0)
            return 0;

        holdingTime[user] += block.timestamp - obtainedAt[user] - lastHoldingTimeUpdate[user];
        lastHoldingTimeUpdate[user] = block.timestamp;
        return holdingTime[user];
    }
}

