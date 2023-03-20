pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract PoolToken is ERC20, Ownable {

    constructor() ERC20("PoolToken", "PT") Ownable() {
    }

    function burn(address account, uint amount) public onlyOwner() {
        _burn(account, amount);
    }

    function mint(address to, uint amount) public onlyOwner() {
        _mint(to, amount);
    }
}
