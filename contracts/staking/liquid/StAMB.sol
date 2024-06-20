// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract StAMB is ERC20, Ownable {

    constructor() ERC20("Staked Amber", "stAMB") Ownable() {
    }

    function burn(address account, uint amount) public onlyOwner() {
        _burn(account, amount);
    }

    function mint(address to, uint amount) public onlyOwner() {
        _mint(to, amount);
    }
}
