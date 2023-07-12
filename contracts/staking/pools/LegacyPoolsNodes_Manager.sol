// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IPool.sol";
import "../IStakeManager.sol";
import "../../consensus/IValidatorSet.sol";
import "./Legacy/IPoolsNodesManager.sol";
import "./Legacy/ICatalogueContracts.sol";

// Manager that allows to register staking pools;
// Each pool can onboard a node (via this manager) when reached some stake goal

contract LegacyPoolsNodes_Manager is Ownable, IStakeManager, IPoolsNodesManager {

    IValidatorSet public validatorSet; // contract that manages validator set


    uint public  minApolloDeposit;

    PoolsStore private poolsStore;
    ApolloDepositStore private apolloDepositStore;
    RolesEventEmitter private rolesEventEmitter;
    PoolEventsEmitter private poolEventsEmitter;

    mapping(address => address) public node2pool;

    event PoolAdded(address poolAddress);
    event PoolRemoved(address poolAddress);

    constructor(uint minApolloDeposit_, IValidatorSet validatorSet_,
        PoolsStore _poolsStore,
        ApolloDepositStore _apolloDepositStore,
        RolesEventEmitter _rolesEventEmitter,
        PoolEventsEmitter _poolEventsEmitter
    ) Ownable() {
        minApolloDeposit = minApolloDeposit_;
        validatorSet = validatorSet_;

        poolsStore = _poolsStore;
        apolloDepositStore = _apolloDepositStore;
        rolesEventEmitter = _rolesEventEmitter;
        poolEventsEmitter = _poolEventsEmitter;
    }


    // ONLY POOL METHODS


    function onboard(address nodeAddress, Consts.NodeType nodeType) external payable onlyPoolsCalls {
        require(msg.value >= minApolloDeposit, "Invalid deposit value");
        require(getDeposit(nodeAddress) == 0, "Already staking");
        apolloDepositStore.storeDeposit{value: msg.value}(nodeAddress);
        validatorSet.newStake(nodeAddress, msg.value, false);  // todo false?
        rolesEventEmitter.nodeOnboarded(nodeAddress, msg.value, "", Consts.NodeType.APOLLO);
        node2pool[nodeAddress] = msg.sender;
    }

    function retire(address nodeAddress, Consts.NodeType nodeType) external onlyPoolsCalls returns (uint) {
        uint amountToTransfer = apolloDepositStore.releaseDeposit(nodeAddress, address(this));
        require(amountToTransfer != 0, "No such node");

        validatorSet.unstake(nodeAddress, amountToTransfer);
        rolesEventEmitter.nodeRetired(nodeAddress, amountToTransfer, Consts.NodeType.APOLLO);
        payable(msg.sender).transfer(amountToTransfer);
        node2pool[nodeAddress] = address(0);
        return amountToTransfer;
    }


    function poolStakeChanged(address user, int stake, int tokens) public onlyPoolsCalls {
        poolEventsEmitter.poolStakeChanged(msg.sender, user, stake, tokens);
    }

    function poolReward(uint payment, uint tokenPrice) public onlyPoolsCalls {
        poolEventsEmitter.poolReward(msg.sender, payment, tokenPrice);
    }

    function addNodeRequest(uint stake, uint requestId, uint nodeId, Consts.NodeType role) public onlyPoolsCalls {
        poolEventsEmitter.addNodeRequest(msg.sender, requestId, nodeId, stake, role);
    }

    function addNodeRequestResolved(uint requestId, uint status) public onlyPoolsCalls {
        poolEventsEmitter.addNodeRequestResolved(msg.sender, requestId, status);
    }

    function nextId() public returns (uint) {
        return poolsStore.nextId();
    }


    // OWNER METHODS

    function addPool(address pool) public onlyOwner {
        poolsStore.addPool(pool);
    }

    function removePool(address pool) public onlyOwner {
        poolsStore.removePool(pool);
    }

    function changeMinApolloDeposit(uint newMinApolloDeposit) public onlyOwner {
        minApolloDeposit = newMinApolloDeposit;
    }

    function importOldStakes(address[] memory addresses, uint[] memory amounts) public onlyOwner{
        require(addresses.length == amounts.length, "Invalid input");
        for (uint i = 0; i < addresses.length; i++)
            validatorSet.newStake(addresses[i], amounts[i], false);
    }

    // IStakeManager METHODS


    function reward(address nodeAddress, uint amount) external {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");
        require(address(this).balance > amount, "[LPNM] Insufficient funds to pay reward");
        address poolAddress = node2pool[nodeAddress];
        require(poolAddress != address(0), "Can't find pool for node");
        IPool(poolAddress).addReward{value: amount}();
    }

    function report(address nodeAddress) external {

    }


    // VIEW METHODS

    function getDeposit(address nodeAddress) public view returns (uint) {
        return validatorSet.getNodeStake(nodeAddress);
    }

    function isPool(address poolAddress) public view returns (bool) {
        return poolsStore.isPool(poolAddress);
    }

    function getPools() public view returns (address[] memory) {
        return poolsStore.getPools(0, poolsStore.getPoolsCount());
    }


    // INTERNAL

    receive() external payable {}

    // MODIFIERS

    modifier onlyPoolsCalls() {
        require(poolsStore.isPool(address(msg.sender)), "The message sender is not pool");
        _;
    }


}
