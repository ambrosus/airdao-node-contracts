// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";


abstract contract  StAMB is ERC20Upgradeable, AccessControlUpgradeable {
    mapping (address => uint256) internal _obtainedAt;

    function __StAMB_init() public initializer {
        __ERC20_init("Staked AMB", "StAMB");
        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function obtainedAt(address account) public view returns (uint256) {
        return _obtainedAt[account];
    }

    function mint(address account, uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_obtainedAt[account] == 0)
            _obtainedAt[account] = block.timestamp;
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (balanceOf(account) == amount)
            _obtainedAt[account] = 0;
        _burn(account, amount);
    }

    function _onTransfer() internal virtual {}

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _onTransfer();
        if (balanceOf(msg.sender) == amount) {
            _obtainedAt[msg.sender] = 0;
        }
        if (_obtainedAt[recipient] == 0) {
            _obtainedAt[recipient] = block.timestamp;
        }
        return super.transfer(recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        _onTransfer();
        if (balanceOf(sender) == amount) {
            _obtainedAt[msg.sender] = 0;
        }
        if (_obtainedAt[recipient] == 0) {
            _obtainedAt[recipient] = block.timestamp;
        }
        return super.transferFrom(sender, recipient, amount);
    }
}

