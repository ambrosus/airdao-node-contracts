pragma solidity ^0.8.0;

interface IPool {
    function getVersion() external view returns (string memory);
    function activate() external payable;
    function deactivate(uint maxNodes) external;
    function setName(string memory newName) external;

    function stake() external payable;
    function unstake(uint tokens) external;
    function viewStake() external view returns (uint);

    function getTokenPrice() external view returns (uint);
    function addReward() external payable;
    function getNodesCount() external view returns(uint);
    function getNodes() external view returns (address[] memory);
}
