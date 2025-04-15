// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IBlockRewards.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BlockRewardsMode2 is IBlockRewards, AccessControl {

    uint256 constant private MINT_TRIGGER_BALANCE = 1 ether;

    uint256 public blockReward;
    address public treasury;
    address public support;
    uint256 public ppm;

    constructor(address owner) {
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
    }

    function reward(address[] calldata, uint16[] calldata) external override returns (address[] memory, uint256[] memory) {
        uint16 numValid;
        uint16 supportIdx;
        uint16 rewardIdx;

        if (ppm > 0 && support != address(0) && support.balance <= MINT_TRIGGER_BALANCE) {
            numValid += 1;
            supportIdx = numValid;
        }

        if (blockReward > 0 && treasury != address(0)) {
            numValid += 1;
            rewardIdx = numValid;
        }

        address[] memory retAddresses = new address[](numValid);
        uint256[] memory retAmounts = new uint256[](numValid);

        if (supportIdx > 0) {
            retAddresses[supportIdx - 1] = support;
            retAmounts[supportIdx - 1] = ppm;
        }

        if (rewardIdx > 0) {
            retAddresses[rewardIdx - 1] = treasury;
            retAmounts[rewardIdx - 1] = blockReward;
        }

        return (retAddresses, retAmounts);
    }

    function setBlockReward(uint256 reward_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        blockReward = reward_;
    }

    function setTreasuryAddress(address treasury_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = treasury_;
    }

    function setSupportFee(address support_, uint256 ppm_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        support = support_;
        ppm = ppm_;
    }
}
