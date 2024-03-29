// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../utils/TransferViaCall.sol";


contract RewardsBank is AccessControl{
    using SafeERC20 for IERC20;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function withdrawAmb(address payable addressTo, uint amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        transferViaCall(addressTo, amount);
    }

    function withdrawErc20(address tokenAddress, address addressTo, uint amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(tokenAddress).safeTransfer(addressTo, amount);
    }

    receive() external payable {}

}
