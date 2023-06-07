// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../IStakeManager.sol";
import "../../consensus/IValidatorSet.sol";

// Manager that allows to register staking pools;
// Each pool can onboard a node (via this manager) when reached some stake goal

contract PoolsNodes_Manager is Ownable, IStakeManager {

    IValidatorSet public validatorSet; // contract that manages validator set


    uint public  minApolloDeposit;

    mapping(address => bool) public isPool;
    address[] public pools;
    uint public lastPoolId;


    event PoolAdded(address poolAddress);
    event PoolRemoved(address poolAddress);


    event PoolStakeChanged(address pool, address user, int stake, int tokens);
    event PoolReward(address pool, uint reward, uint tokenPrice);
    event AddNodeRequest(address pool, uint id, uint nodeId, uint stake);
    event AddNodeRequestResolved(address pool, uint id, uint status);


    event NodeOnboarded(address nodeAddress, uint placedDeposit);
    event NodeRetired(address nodeAddress, uint releasedDeposit);



    constructor(uint minApolloDeposit_, IValidatorSet validatorSet_, uint lastPoolId_) Ownable() {
        minApolloDeposit = minApolloDeposit_;
        validatorSet = validatorSet_;
        lastPoolId = lastPoolId_;
    }


    // ONLY POOL METHODS


    function onboard(address nodeAddress) external payable onlyPoolsCalls {
        require(msg.value >= minApolloDeposit, "Invalid deposit value");
        require(getDeposit(nodeAddress) == 0, "Already staking");

        validatorSet.addStake(nodeAddress, msg.value);
        emit NodeOnboarded(nodeAddress, msg.value);
    }

    function retire(address nodeAddress) external onlyPoolsCalls returns (uint) {
        uint amountToTransfer = getDeposit(nodeAddress);
        require(amountToTransfer != 0, "No such node");

        validatorSet.removeStake(nodeAddress, amountToTransfer);
        emit NodeRetired(nodeAddress, amountToTransfer);
        payable(msg.sender).transfer(amountToTransfer);
        return amountToTransfer;
    }


    function poolStakeChanged(address user, int stake, int tokens) public onlyPoolsCalls {
        emit PoolStakeChanged(msg.sender, user, stake, tokens);
    }

    function poolReward(uint reward, uint tokenPrice) public onlyPoolsCalls {
        emit PoolReward(msg.sender, reward, tokenPrice);
    }

    function addNodeRequest(uint stake, uint requestId, uint nodeId) public onlyPoolsCalls {
        emit AddNodeRequest(msg.sender, requestId, nodeId, stake);
    }

    function addNodeRequestResolved(uint requestId, uint status) public onlyPoolsCalls {
        emit AddNodeRequestResolved(msg.sender, requestId, status);
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

    function changeMinApolloDeposit(uint newMinApolloDeposit) public onlyOwner{
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
