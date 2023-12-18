/*
Copyright: Ambrosus Inc.
Email: tech@ambrosus.io

This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

This Source Code Form is “Incompatible With Secondary Licenses”, as defined by the Mozilla Public License, v. 2.0.
*/
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

interface IFees {
    function setGasPrice(uint price) external;
    function getGasPrice() external view returns (uint);
    function setFeesParams(address addr, uint percent) external;
    function getFeesParams() external view returns (address, uint);
}
