//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../../consensus/IValidatorSet.sol";
import "../../funds/RewardsBank.sol";
import "../../finance/Treasury.sol";
import "./LiquidPool.sol";
import "../../utils/TransferViaCall.sol";

contract LiquidNodesManager is UUPSUpgradeable, AccessControlUpgradeable {
    bytes32 constant public BACKEND_ROLE = keccak256("BACKEND_ROLE");
    bytes32 constant public POOL_ROLE = keccak256("POOL_ROLE");

    IValidatorSet public validatorSet;
    RewardsBank public rewardsBank;

    address public treasury;
    Treasury public treasuryFee;

    uint public nodeStake; // stake for 1 onboarded node
    uint public maxNodesCount;
    address[] public nodes;
    uint private _totalNodesStake;

    uint private _requestId;
    uint private _requestStake;
    uint256[10] __gap;


    event AddNodeRequest(uint indexed requestId, uint indexed nodeId, uint stake);
    event NodeOnboarded(uint indexed requestId, address indexed node, uint indexed nodeId, uint stake);
    event RequestFailed(uint indexed requestId, uint indexed nodeId, uint stake);
    event NodeRetired(uint indexed nodeId, address indexed node, uint stake);
    event Reward(address indexed addr, uint amount);

    function initialize(
        IValidatorSet validatorset_, RewardsBank rewardsBank_,
        address treasury_, Treasury treasuryFee_,
        uint nodeStake_, uint maxNodesCount_
    ) public initializer {
        validatorSet = validatorset_;
        rewardsBank = rewardsBank_;
        treasury = treasury_;
        treasuryFee = treasuryFee_;
        nodeStake = nodeStake_;
        maxNodesCount = maxNodesCount_;
        nodes = new address[](0);
        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // POOL METHODS

    function stake() external payable onlyRole(POOL_ROLE) {
        // retire node if maxNodesCount was changed
        if (nodes.length > maxNodesCount) {
            _retireNode();
        }
        // try to onboard new node
        _requestNodeCreation();
    }

    function unstake(uint amount) external onlyRole(POOL_ROLE) {
        // retire node if not enough free balance
        while (getFreeBalance() < amount) {
            _retireNode();
        }
        transferViaCall(payable(msg.sender), amount);
        // Try to onboard new node in case if maxNodesCount was changed
        _requestNodeCreation();
    }
    // IStakeManager impl

    function reward(address nodeAddress, uint256 amount) public {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");

        uint feeAmount = treasuryFee.calcFee(amount);
        rewardsBank.withdrawAmb(payable(address(treasuryFee)), feeAmount);
        amount -= feeAmount;

        rewardsBank.withdrawAmb(payable(treasury), amount);
        validatorSet.emitReward(address(rewardsBank), nodeAddress, address(this), address(treasury), address(0), amount);
    }

    function report(address nodeAddress) public {}

    // BAKEND METHODS

    function onboardNode(uint requestId, address node, uint nodeId) public onlyRole(BACKEND_ROLE) {
        _onboardNode(requestId, node, nodeId);
    }

    // ADMIN METHODS

    function setNodeStakeAndCount(uint nodeStake_, uint maxNodesCount_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        nodeStake = nodeStake_;
        maxNodesCount = maxNodesCount_;
    }

    // INTERNAL METHODS

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function _onboardNode(uint requestId, address node, uint nodeId) private {
        require(node != address(0), "Node address can't be zero");
        require(_requestStake > 0, "No active request");
        require(validatorSet.getNodeStake(node) == 0, "Node already onboarded");
        require(requestId == _requestId, "Invalid request id");
        require(address(this).balance >= _totalNodesStake + _requestStake, "Not enough balance");

        if (nodeId == nodes.length && getFreeBalance() >= _requestStake) {
            nodes.push(node);
            _totalNodesStake += _requestStake;
            validatorSet.newStake(node, _requestStake, true);
            emit NodeOnboarded(requestId, node, nodeId, _requestStake);
        } else {
            emit RequestFailed(requestId, nodeId, _requestStake);
        }

        _requestStake = 0;

        // try to onboard another node
        _requestNodeCreation();
    }

    function _retireNode() private {
        require(nodes.length > 0, "No nodes onboarded");

        address node = nodes[nodes.length - 1];
        uint deposit = getNodeDeposit(node);
        _totalNodesStake -= deposit;
        nodes.pop();
        validatorSet.unstake(node, deposit);
        emit NodeRetired(nodes.length, node, deposit);
    }

    function _requestNodeCreation() private {
        if (_requestStake == 0 && getFreeBalance() >= nodeStake && nodes.length < maxNodesCount) {
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

    // balance that not used for nodes stakes
    function getFreeBalance() public view returns (uint) {
        return address(this).balance - _totalNodesStake;
    }
}
