// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../IStakeManager.sol";
import "../../consensus/IValidatorSet.sol";
import "./Legacy/IPoolsNodesManager.sol";
import "./Legacy/ICatalogueContracts.sol";

// Manager that allows to register staking pools;
// Each pool can onboard a node (via this manager) when reached some stake goal

contract LegacyPoolsNodes_Manager is Ownable, IStakeManager, IPoolsNodesManager {

    IValidatorSet public validatorSet; // contract that manages validator set


    uint public  minApolloDeposit;

    mapping(address => bool) public isPool;
    address[] public pools;
    uint public lastPoolId;

    ApolloDepositStore private apolloDepositStore;
    RolesEventEmitter private rolesEventEmitter;
    PoolEventsEmitter private poolEventsEmitter;

    event PoolAdded(address poolAddress);
    event PoolRemoved(address poolAddress);

    constructor(uint minApolloDeposit_, IValidatorSet validatorSet_, uint lastPoolId_,
        ApolloDepositStore _apolloDepositStore,
        RolesEventEmitter _rolesEventEmitter,
        PoolEventsEmitter _poolEventsEmitter
    ) Ownable() {
        minApolloDeposit = minApolloDeposit_;
        validatorSet = validatorSet_;
        lastPoolId = lastPoolId_;

        apolloDepositStore = _apolloDepositStore;
        rolesEventEmitter = _rolesEventEmitter;
        poolEventsEmitter = _poolEventsEmitter;
    }


    // ONLY POOL METHODS


    function onboard(address nodeAddress, Consts.NodeType nodeType) external payable onlyPoolsCalls {
        require(msg.value >= minApolloDeposit, "Invalid deposit value");
        require(getDeposit(nodeAddress) == 0, "Already staking");
        apolloDepositStore.storeDeposit{value: msg.value}(nodeAddress);
        validatorSet.addStake(nodeAddress, msg.value);
        rolesEventEmitter.nodeOnboarded(nodeAddress, msg.value, "", Consts.NodeType.APOLLO);
    }

    function retire(address nodeAddress, Consts.NodeType nodeType) external onlyPoolsCalls returns (uint) {
        uint amountToTransfer = apolloDepositStore.releaseDeposit(nodeAddress, address(this));
        require(amountToTransfer != 0, "No such node");

        validatorSet.removeStake(nodeAddress, amountToTransfer);
        rolesEventEmitter.nodeRetired(nodeAddress, amountToTransfer, Consts.NodeType.APOLLO);
        payable(msg.sender).transfer(amountToTransfer);
        return amountToTransfer;
    }


    function poolStakeChanged(address user, int stake, int tokens) public onlyPoolsCalls {
        poolEventsEmitter.poolStakeChanged(msg.sender, user, stake, tokens);
    }

    function poolReward(uint reward, uint tokenPrice) public onlyPoolsCalls {
        poolEventsEmitter.poolReward(msg.sender, reward, tokenPrice);
    }

    function addNodeRequest(uint stake, uint requestId, uint nodeId, Consts.NodeType role) public onlyPoolsCalls {
        poolEventsEmitter.addNodeRequest(msg.sender, requestId, nodeId, stake, role);
    }

    function addNodeRequestResolved(uint requestId, uint status) public onlyPoolsCalls {
        poolEventsEmitter.addNodeRequestResolved(msg.sender, requestId, status);
    }

    function nextId() public returns (uint) {
        lastPoolId++;
        return lastPoolId;
    }


    // OWNER METHODS

    function addPool(address pool) public onlyOwner {
        require(pool != address(0), "Pool must not be 0x0");
        require(!isPool[pool], "Pool already registered");

        isPool[pool] = true;
        pools.push(pool);
        emit PoolAdded(pool);
    }

    function removePool(address pool) public onlyOwner {
        require(isPool[pool], "Pool not registered");

        delete isPool[pool];
        emit PoolRemoved(pool);

        for (uint i = 0; i < pools.length; i++) {
            if (pools[i] == pool) {
                pools[i] = pools[pools.length - 1];
                pools.pop();
                return;
            }
        }
    }

    function changeMinApolloDeposit(uint newMinApolloDeposit) public onlyOwner {
        minApolloDeposit = newMinApolloDeposit;
    }

    // IStakeManager METHODS


    function reward(address nodeAddress, uint amount) external {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");

        // todo
    }

    function report(address nodeAddress) external {

    }


    // VIEW METHODS

    function getDeposit(address nodeAddress) public view returns (uint) {
        return validatorSet.getNodeStake(nodeAddress);
    }

    function getPoolsCount() public view returns (uint) {
        return pools.length;
    }

    function getPools() public view returns (address[] memory) {
        return pools;
    }




    // INTERNAL

    receive() external payable {}

    // MODIFIERS

    modifier onlyPoolsCalls() {
        require(isPool[msg.sender], "The message sender is not pool");
        _;
    }


}
