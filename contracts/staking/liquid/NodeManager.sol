//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../../consensus/IValidatorSet.sol";
import "../../funds/RewardsBank.sol";
import "../../finance/Treasury.sol";

contract NodeManager is UUPSUpgradeable, AccessControlUpgradeable {
    bytes32 constant public VALIDATOR_SET_ROLE = keccak256("VALIDATOR_SET_ROLE");
    bytes32 constant public BACKEND_ROLE = keccak256("BACKEND_ROLE");

    IValidatorSet public validatorSet;
    RewardsBank public rewardsBank;
    Treasury public treasury;
    uint public nodeStake; // stake for 1 onboarded node
    uint public maxNodesCount;
    address[] public nodes;

    uint private _requestId;
    uint private _requestStake; 

    event AddNodeRequest(uint indexed requestId, uint indexed nodeId, uint stake); 
    event NodeOnboarded(address indexed node, uint indexed nodeId, uint stake);
    event RequestFailed(uint indexed requestId, uint indexed nodeId, uint stake);
    event NodeRetired(uint indexed nodeId, uint stake);
    event Reward(address indexed addr, uint amount);

    function initialize(
        IValidatorSet validatorset_, RewardsBank rewardsBank_, Treasury treasury_,
        uint nodeStake_, uint maxNodesCount_
    ) public initializer {
        validatorSet = validatorset_;
        rewardsBank = rewardsBank_;
        treasury = treasury_;
        nodeStake = nodeStake_;
        maxNodesCount = maxNodesCount_;
        nodes = new address[](maxNodesCount_);
        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // OWNER METHODS

    function requestNodeCreation() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _requestNodeCreation();
    }

    function requestNodeRetirement() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _retireNode();
    }

    // IStakeManager impl

    function reward(address nodeAddress, uint256 amount) public onlyRole(VALIDATOR_SET_ROLE) {
        uint treasuryAmount = treasury.calcFee(amount);
        rewardsBank.withdrawAmb(payable(address(treasury)), treasuryAmount);
        amount -= treasuryAmount;

        rewardsBank.withdrawAmb(payable(nodeAddress), amount);
        validatorSet.emitReward(address(rewardsBank), nodeAddress, nodeAddress, address(rewardsBank), address(0), amount);
    }

    function report(address nodeAddress) public {}

    // BAKEND METHODS

    function onboardNode(uint requestId, address node, uint nodeId) public onlyRole(BACKEND_ROLE) {
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

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE){}

    function _retireNode() private {
        uint deposit = getNodeDeposit(nodes[nodes.length - 1]);
        validatorSet.unstake(nodes[nodes.length - 1], deposit);
        emit NodeRetired(nodes.length - 1, deposit);
        nodes.pop();
    }

    function _requestNodeCreation() private {
        if (_requestStake == 0
            && address(this).balance >= nodeStake
            && nodes.length < maxNodesCount) {
            _requestId++;
            _requestStake = nodeStake;
            emit AddNodeRequest(_requestId, nodes.length, _requestStake);
        }
    }


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
