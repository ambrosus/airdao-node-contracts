/*
Copyright: Ambrosus Inc.
Email: tech@ambrosus.io

This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

This Source Code Form is “Incompatible With Secondary Licenses”, as defined by the Mozilla Public License, v. 2.0.
*/
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "./IFees.sol";

contract Fees is UUPSUpgradeable, AccessControlEnumerableUpgradeable, IFees {

    bytes32 public constant FEES_MANAGER_ROLE = keccak256("FEES_MANAGER_ROLE");

    uint gasPrice;
    address payAddress;
    uint feePercent;

    event GasPriceChanged(uint indexed price);
    event FeesParamsChanged(address indexed addr, uint indexed percent);

    function initialize(
        uint _gasPrice,
        address _payAddress,
        uint _feePercent
    ) public initializer {
        gasPrice = _gasPrice;
        payAddress = _payAddress;
        feePercent = _feePercent;

        _setupRole(FEES_MANAGER_ROLE, msg.sender);
    }
   
    function setGasPrice(uint price) external onlyRole(FEES_MANAGER_ROLE) {
        gasPrice = price;

        emit GasPriceChanged(price);
    }

    function getGasPrice() public view returns (uint) {
        return gasPrice;
    }

    function setFeesParams(address addr, uint percent) external onlyRole(FEES_MANAGER_ROLE) {
        payAddress = addr;
        feePercent = percent;

        emit FeesParamsChanged(addr, percent);
    }

    function getFeesParams() public view returns (address addr, uint percent) {
        return (payAddress, feePercent);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
