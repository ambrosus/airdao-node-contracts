pragma solidity ^0.4.23;

library Consts {
    enum NodeType {NONE, ATLAS, HERMES, APOLLO}
    enum SecondaryNodeType {ZETA, SIGMA, OMEGA}
}

contract Head {
    function poolsNodesManager() public returns (IPoolsNodesManager);
}

interface IPoolsNodesManager {
    function onboard(address nodeAddress, Consts.NodeType nodeType) external payable;
    function retire(address nodeAddress, Consts.NodeType nodeType) external returns (uint);

    function poolStakeChanged(address user, int stake, int tokens) external;
    function poolReward(uint reward, uint tokenPrice) external;
    function addNodeRequest(uint stake, uint requestId, uint nodeId, Consts.NodeType role) external;
    function addNodeRequestResolved(uint requestId, uint status) external;
    function nextId() external returns (uint);
}
