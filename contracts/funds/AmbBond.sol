// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AmbBond is ERC20 {
    constructor() ERC20("AmbBond", "AmbB") {

    }

    function reward(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
