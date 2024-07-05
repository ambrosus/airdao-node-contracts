// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IPoolsNodesManager.sol";

contract TEST_PoolsStore {

    event PoolAdded(address poolAddress);
    event PoolRemoved(address poolAddress);

    mapping(address => bool) public isPool;
    address[] public pools;
    uint public id;

    constructor() { }

    function addPool(address pool) public {
        require(!isPool[pool], "Pool already registered");
        require(pool != address(0), "Pool must not be 0x0");
        isPool[pool] = true;
        pools.push(pool);
        emit PoolAdded(pool);
    }

    function removePool(address pool) public {
        require(isPool[pool], "Pool not registered");
        delete isPool[pool];
        for (uint i = 0; i < pools.length; i++) {
            if (pools[i] == pool) {
                pools[i] = pools[pools.length - 1];
                pools.pop();
                break;
            }
        }
        emit PoolRemoved(pool);
    }

    function nextId() public returns (uint) {
        id++;
        return id;
    }

    function getPoolsCount() public view returns (uint) {
        return pools.length;
    }

    function getPools(uint from, uint to) public view returns (address[] memory _pools) {
        require(from >= 0 && from < pools.length, "From index out of bounds");
        require(to > from && to <= pools.length, "To index out of bounds");
        uint i;
        _pools = new address[](to - from);
        for (i = from; i < to; i++) {
            _pools[i - from] = pools[i];
        }
    }
}


contract TEST_ApolloDepositStore {

    mapping(address => uint) deposits;

    constructor() public  { }

    function storeDeposit(address apollo) public payable {
        require(!isDepositing(apollo));
        deposits[apollo] = msg.value;
    }

    function releaseDeposit(address apollo, address refundAddress) public returns (uint) {
        require(refundAddress != address(0));
        require(isDepositing(apollo));
        uint amountToTransfer = deposits[apollo];
        deposits[apollo] = 0;
        payable(refundAddress).transfer(amountToTransfer);
        return amountToTransfer;
    }

    function isDepositing(address apollo) public view returns(bool) {
        return deposits[apollo] > 0;
    }
}


contract TEST_RolesEventEmitter {

    constructor() public {}

    event NodeOnboarded(address nodeAddress, uint placedDeposit, string nodeUrl, Consts.NodeType role);
    event NodeRetired(address nodeAddress, uint releasedDeposit, Consts.NodeType role);
    event NodeUrlChanged(address nodeAddress, string oldNodeUrl, string newNodeUrl);

    function nodeOnboarded(address nodeAddress, uint placedDeposit, string memory nodeUrl, Consts.NodeType role) public {
        emit NodeOnboarded(nodeAddress, placedDeposit, nodeUrl, role);
    }

    function nodeRetired(address nodeAddress, uint releasedDeposit, Consts.NodeType role) public {
        emit NodeRetired(nodeAddress, releasedDeposit, role);
    }

    function nodeUrlChanged(address nodeAddress, string memory oldNodeUrl, string memory newNodeUrl) public {
        emit NodeUrlChanged(nodeAddress, oldNodeUrl, newNodeUrl);
    }
}

contract TEST_PoolEventsEmitter  {

    constructor() public {}

    event PoolStakeChanged(address pool, address user, int stake, int tokens);
    event PoolReward(address pool, uint reward, uint tokenPrice);
    event AddNodeRequest(address pool, uint id, uint nodeId, uint stake, Consts.NodeType role);
    event AddNodeRequestResolved(address pool, uint id, uint status);

    function poolStakeChanged(address pool, address user, int stake, int tokens) public {
        emit PoolStakeChanged(pool, user, stake, tokens);
    }

    function poolReward(address pool, uint reward, uint tokenPrice) public {
        emit PoolReward(pool, reward, tokenPrice);
    }

    function addNodeRequest(address pool, uint id, uint nodeId, uint stake, Consts.NodeType role) public {
        emit AddNodeRequest(pool, id, nodeId, stake, role);
    }

    function addNodeRequestResolved(address pool, uint id, uint status) public {
        emit AddNodeRequestResolved(pool, id, status);
    }
}
