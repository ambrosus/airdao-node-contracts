// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../IStakeManager.sol";
import "../../consensus/IValidatorSet.sol";

abstract contract NodesManager {

    IValidatorSet public validatorSet;

    uint public nodeStake; // stake for 1 onboarded node
    uint public maxNodesCount;
    address[] public nodes;

    uint private _requestId;
    uint private _requestStake; // Needed to garanty that only one request is active

    //Save nodes ?

    constructor(IValidatorSet validatorSet_, uint nodeStake_) {
        require(nodeStake_ > 0, "Node stake value is zero");

        validatorSet = validatorSet_;
        nodeStake = nodeStake_;
    }

    // EVENTS

    event AddNodeRequest(uint indexed requestId, uint indexed nodeId, uint stake); 
    event NodeOnboarded(address indexed node, uint indexed nodeId, uint stake);
    event RequestFailed(uint indexed requestId, uint indexed nodeId, uint stake);
    event NodeRetired(uint indexed nodeId, uint stake);


    // PUBLIC METHODS
    function onboardNode(uint requestId, address node, uint nodeId) public {
        require(node != address(0), "Node address can't be zero");
        require(_requestStake > 0, "No active request");
        require(validatorSet.getNodeStake(node) == 0, "Node already onboarded");
        require(requestId == _requestId, "Invalid request id");
        
        if (nodeId == nodes.length && address(this).balance >= _requestStake) {
            nodes.push(node);
            // false - node must not always be in the top list
            validatorSet.newStake(node, _requestStake, false);
            emit NodeOnboarded(node, nodeId, _requestStake);
        } else {
            emit RequestFailed(requestId, nodeId, _requestStake);
        }

        _requestStake = 0;
        _requestNodeCreation();
    }

    // INTERNAL METHODS

    function _requestNodeCreation() internal {
        if (_requestStake == 0
            && address(this).balance >= nodeStake
            && nodes.length < maxNodesCount) {
            _requestId++;
            _requestStake = nodeStake;
            emit AddNodeRequest(_requestId, nodes.length, _requestStake);
        }
    }

    function _retireNode() internal {
        uint deposit = getNodeDeposit(nodes[nodes.length - 1]);
        validatorSet.unstake(nodes[nodes.length - 1], deposit);
        emit NodeRetired(nodes.length - 1, deposit);
        nodes.pop();
    }

    // VIEW METHODS

    function getNodeDeposit(address node) public view returns (uint) {
        return validatorSet.getNodeStake(node);
    }

    function getNodesCount() public view returns (uint) {
        return nodes.length;
    }

    function getNodes() public view returns (address[] memory) {
        return nodes;
    }
}

