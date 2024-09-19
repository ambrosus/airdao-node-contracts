//_ SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./TokenPool.sol";
import "./LimitedTokenPool.sol";
import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

contract TokenPoolsManager is AccessControl{
    LockKeeper lockKeeper;
    RewardsBank public bank;
    UpgradeableBeacon public tokenPoolBeacon;
    UpgradeableBeacon public depositedTokenPoolBeacon;

    mapping(string => address) public pools;
    mapping(string => address) public depositedPools;

    constructor(RewardsBank bank_, LockKeeper lockKeeper_, UpgradeableBeacon singleSideBeacon_, UpgradeableBeacon doubleSideBeacon_) {
        lockKeeper = lockKeeper_;
        bank = bank_;
        tokenPoolBeacon = singleSideBeacon_;
        depositedTokenPoolBeacon = doubleSideBeacon_;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    event PoolCreated(string name, address pool);
    event PoolDeactivated(string name);
    event PoolActivated(string name);
    event DepositedPoolCreated(string name, address pool);
    event DepositedPoolDeactivated(string name);
    event DepositedPoolActivated(string name);

    // OWNER METHODS
    // TOKEN POOL METHODS
    function createTokenPool(TokenPool.Config calldata params) public onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,address,(address,string,address,uint256,uint256,uint256,uint256,uint256,uint256))",
            bank, lockKeeper, params);
        address pool = address(new BeaconProxy(address(tokenPoolBeacon), data));
        pools[params.name] = pool;
        bank.grantRole(bank.DEFAULT_ADMIN_ROLE(), address(pool));
        emit PoolCreated(params.name, pool);
        return pool;
    }

    function deactivateTokenPool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pools[_pool]);
        pool.deactivate();
        emit PoolDeactivated(_pool);
    }

    function activateTokenPool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        
        TokenPool pool = TokenPool(pools[_pool]);
        pool.activate();
        emit PoolActivated(_pool);
    }

    function setMinStakeValue(string memory _pool, uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pools[_pool]);
        pool.setMinStakeValue(value);
    }

    function setInterest(string memory _pool, uint _interest, uint _interestRate) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pools[_pool]);
        pool.setInterest(_interest, _interestRate);
    }

    function setLockPeriod(string memory _pool, uint period) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pools[_pool]);
        pool.setLockPeriod(period);
    }

    function setRewardTokenPrice(string memory _pool, uint price) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pools[_pool]);
        pool.setRewardTokenPrice(price);
    }

    function setFastUnstakePenalty(string memory _pool, uint penalty) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pools[_pool]);
        pool.setFastUnstakePenalty(penalty);
    }

    // DEPOSITED POOL METHODS
    function createLimitedTokenPool(LimitedTokenPool.MainConfig calldata params) public onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,address,(string,address,address,address,uint256,uint256,uint256))",
            bank, lockKeeper, params);
        address pool = address(new BeaconProxy(address(depositedTokenPoolBeacon), data));
        depositedPools[params.name] = pool;
        bank.grantRole(bank.DEFAULT_ADMIN_ROLE(), address(pool));
        emit DepositedPoolCreated(params.name, pool);
        return pool;
    }

    function configureLimitedTokenPoolLimits(string calldata name, LimitedTokenPool.LimitsConfig calldata params) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[name] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[name]);
        pool.setLimitsConfig(params);
    }

    function deactivateDoubleSidePool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.deactivate();
        emit DepositedPoolDeactivated(_pool);
    }

    function activateDoubleSidePool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.activate();
        emit DepositedPoolActivated(_pool);
    }

    function setRewardTokenPriceL(string memory _pool, uint price) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.setRewardTokenPrice(price);
    }

    function setInterestL(string memory _pool, uint _interest, uint _interestRate) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.setInterest(_interest, _interestRate);
    }

    function setMinDepositValueL(string memory _pool, uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.setMinDepositValue(value);
    }

    function setMinStakeValueL(string memory _pool, uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.setMinStakeValue(value);
    }

    function setFastUnstakePenaltyL(string memory _pool, uint penalty) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.setFastUnstakePenalty(penalty);
    }

    function setUnstakeLockPeriodL(string memory _pool, uint period) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.setUnstakeLockPeriod(period);
    }

    function setStakeLockPeriodL(string memory _pool, uint period) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.setStakeLockPeriod(period);
    }

    function setMaxTotalStakeValueL(string memory _pool, uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.setMaxTotalStakeValue(value);
    }

    function setMaxStakePerUserValueL(string memory _pool, uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.setMaxStakePerUserValue(value);
    }

    function setStakeLimitsMultiplierL(string memory _pool, uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(depositedPools[_pool] != address(0), "Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(depositedPools[_pool]);
        pool.setStakeLimitsMultiplier(value);
    }

    // VIEW METHODS

    function getPoolAddress(string memory name) public view returns (address) {
        return pools[name];
    }

    function getDepositedPoolAdress(string memory name) public view returns (address) {
        return depositedPools[name];
    }

}
