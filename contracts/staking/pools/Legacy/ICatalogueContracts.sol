// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IPoolsNodesManager.sol";


interface ApolloDepositStore {
    function storeDeposit(address apollo) external payable;

    function releaseDeposit(address apollo, address refundAddress) external returns (uint);

    function isDepositing(address apollo) external view returns (bool);
}


interface PoolEventsEmitter {
    event PoolStakeChanged(address pool, address user, int stake, int tokens);
    event PoolReward(address pool, uint reward, uint tokenPrice);
    event AddNodeRequest(address pool, uint id, uint nodeId, uint stake, Consts.NodeType role);
    event AddNodeRequestResolved(address pool, uint id, uint status);

    function poolStakeChanged(address pool, address user, int stake, int tokens) external;

    function poolReward(address pool, uint reward, uint tokenPrice) external;

    function addNodeRequest(address pool, uint id, uint nodeId, uint stake, Consts.NodeType role) external;

    function addNodeRequestResolved(address pool, uint id, uint status) external;
}


interface RolesEventEmitter {

    event NodeOnboarded(address nodeAddress, uint placedDeposit, string nodeUrl, Consts.NodeType role);
    event NodeRetired(address nodeAddress, uint releasedDeposit, Consts.NodeType role);
    event NodeUrlChanged(address nodeAddress, string oldNodeUrl, string newNodeUrl);

    function nodeOnboarded(address nodeAddress, uint placedDeposit, string memory nodeUrl, Consts.NodeType role) external;

    function nodeRetired(address nodeAddress, uint releasedDeposit, Consts.NodeType role) external;

    function nodeUrlChanged(address nodeAddress, string memory oldNodeUrl, string memory newNodeUrl) external;
}
