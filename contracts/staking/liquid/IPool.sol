// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IPool {
    // Owner methods
    function activate() external payable;
    function deactivate(uint maxNodes) external;
    function setBackendRole(address backend) external;

    //Validator set methods
    function setInterest(uint interest) external;
    function transferRewards(address to, uint amount) external;

    // Backend methods
    function increaseStake() external;
    function onboardNode(uint requestId, address node, uint nodeId) external;

    // Public methods
    function stake() external payable;
    function unstake(uint tokens) external;

    //View methods
    function getStake() external view returns (uint);
    function getTokenPrice() external view returns (uint);
    function getInterest() external view returns (uint);
    function getRewards() external view returns (uint);
    function getNodeDeposit(address node) external view returns (uint);
    function getNodesCount() external view returns (uint);
    function getNodes() external view returns (address[] memory);

    // Events
    event StakeChanged(address user, int stake, int tokens);
    event AddNodeRequest(uint indexed requestId, uint indexed nodeId, uint stake); 
    event NodeOnboarded(address indexed node, uint indexed nodeId, uint stake);
    event RequestFailed(uint indexed requestId, uint indexed nodeId, uint stake);
    event NodeRetired(uint indexed nodeId, uint stake);
    event Reward(address indexed addr, uint amount);

}
