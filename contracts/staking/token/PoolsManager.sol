// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./TokenPool.sol";
import "./IPoolsManager.sol";
import "../../funds/RewardsBank.sol";

contract PoolsManager is Ownable, IPoolsManager {

    RewardsBank public bank;

    mapping(address => address) public tokenToPool; //maps the address of the token to the address of the pool
    mapping(address => address) public poolToToken; //maps the address of the pool to the address of the token

    constructor(RewardsBank bank_) Ownable() {
        bank = bank_;
    }

    // OWNER METHODS

    function createPool(address token_, uint interest_, uint minStakeValue) public onlyOwner() returns (address) {
        TokenPool pool = new TokenPool(token_, bank, interest_, minStakeValue);
        tokenToPool[token_] = address(pool);
        poolToToken[address(pool)] = token_;
        bank.grantRole(bank.DEFAULT_ADMIN_ROLE(), address(pool));
        emit PoolCreated(address(pool), token_, interest_, minStakeValue);
        return address(pool);
    }

    function deactivatePool(address pool_) public onlyOwner() {
        require(poolToToken[pool_] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pool_);
        pool.deactivate();
        emit PoolDeactivated(pool_);
    }

    function activatePool(address pool_) public onlyOwner() {
        require(poolToToken[pool_] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pool_);
        pool.activate();
        emit PoolActivated(pool_);
    }

    function setInterest(address pool_, uint interest_) public onlyOwner() {
        require(poolToToken[pool_] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pool_);
        pool.setInterest(interest_);
    }

    function setMinStakeValue(address pool_, uint minStakeValue_) public onlyOwner() {
        require(poolToToken[pool_] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pool_);
        pool.setMinStakeValue(minStakeValue_);
    }

    function grantBackendRole(address pool_, address backend_) public onlyOwner() {
        require(poolToToken[pool_] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pool_);
        pool.grantRole(pool.BACKEND_ROLE(), backend_);
    }

    // VIEW METHODS

    function getPool(address token_) public view returns (address) {
        return tokenToPool[token_];
    }

    function getPoolInfo(address pool_) public view returns (address token, uint interest, uint minStakeValue, uint totalStake, uint totalShare,bool) {
        TokenPool pool = TokenPool(pool_);
        return (address(pool.token()), pool.interest(), pool.minStakeValue(), pool.totalStake(), pool.totalShare(), pool.active());
    }
}
