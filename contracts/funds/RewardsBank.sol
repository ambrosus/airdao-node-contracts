// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../utils/TransferViaCall.sol";


contract RewardsBank is AccessControl{
    using SafeERC20 for IERC20;

    IERC20 public airBond;

    constructor(address _airBond){
        airBond = IERC20(_airBond);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }


    function withdrawAmb(address payable addressTo, uint amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        transferViaCall(addressTo, amount);
    }

    function withdrawBonds(address addressTo, uint amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        airBond.safeTransfer(addressTo, amount);
    }

    receive() external payable {}

}
