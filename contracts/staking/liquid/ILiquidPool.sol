// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface ILiquidPool {
    // Owner methods
    function setInterest(uint interest) external;
    function setInterestRate(uint interestRate) external;

    // Backend methods
    function onboardNode(uint requestId, address node, uint nodeId) external;

    // Public methods
    function stake() external payable;
    function unstake(uint tokens) external;
    function claim(uint desiredCoeff) external;

    //View methods
    function getStake() external view returns (uint);
    function getInterest() external view returns (uint);
    function getNodeDeposit(address node) external view returns (uint);
    function getNodesCount() external view returns (uint);
    function getNodes() external view returns (address[] memory);

    // Events
    event StakeChanged(address user, int stake);
    event AddNodeRequest(uint indexed requestId, uint indexed nodeId, uint stake); 
    event NodeOnboarded(address indexed node, uint indexed nodeId, uint stake);
    event RequestFailed(uint indexed requestId, uint indexed nodeId, uint stake);
    event NodeRetired(uint indexed nodeId, uint stake);
    event Reward(address indexed addr, uint amount);
    event Claim(address indexed addr, uint ambAmount, uint bondAmount);
}
