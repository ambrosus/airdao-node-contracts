//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../../consensus/IValidatorSet.sol";
import "../../funds/RewardsBank.sol";
import "../../finance/Treasury.sol";
import "./LiquidPool.sol";
import "./utils/TransferViaCall.sol";

contract LiquidNodeManager is UUPSUpgradeable, AccessControlUpgradeable {
    bytes32 constant public BACKEND_ROLE = keccak256("BACKEND_ROLE");
    bytes32 constant public POOL_ROLE = keccak256("POOL_ROLE");

    IValidatorSet public validatorSet;
    RewardsBank public rewardsBank;

    address public treasury;
    Treasury public treasuryFee;

    LiquidPool public liquidPool;

    uint public nodeStake; // stake for 1 onboarded node
    uint public maxNodesCount;
    address[] public nodes;
    uint private _totalNodesStake;

    uint private _requestId;
    uint private _requestStake;


    event AddNodeRequest(uint indexed requestId, uint indexed nodeId, uint stake);
    event NodeOnboarded(address indexed node, uint indexed nodeId, uint stake);
    event RequestFailed(uint indexed requestId, uint indexed nodeId, uint stake);
    event NodeRetired(uint indexed nodeId, uint stake);
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
        nodes = new address[](maxNodesCount_);
        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // POOL METHODS

    function stake() external payable onlyPool {
        // try to onboard new node
        _requestNodeCreation();
    }

    function unstake(uint amount) external onlyPool {
        // retire node if not enough free balance
        while (getFreeBalance() < amount) {
            _retireNode();
        }
        transferViaCall(msg.sender, amount);
    }

    // IStakeManager impl

    function reward(address nodeAddress, uint256 amount) public {
        require(msg.sender == address(validatorSet), "Only validatorSet can call reward()");

        uint feeAmount = treasuryFee.calcFee(amount);
        rewardsBank.withdrawAmb(payable(address(treasuryFee)), feeAmount);
        amount -= feeAmount;

        rewardsBank.withdrawAmb(payable(treasury), amount);
        validatorSet.emitReward(address(rewardsBank), nodeAddress, address(this), address(treasury), address(0), amount);

        if (address(liquidPool) != address(0)) {
            liquidPool.tryInterest();
        }
    }

    function report(address nodeAddress) public {}

    // BAKEND METHODS

    function onboardNode(uint requestId, address node, uint nodeId) public onlyRole(BACKEND_ROLE) {
        _onboardNode(requestId, node, nodeId);
    }

    // ADMIN METHODS

    function setLiquidPool(LiquidPool liquidPool_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        liquidPool = liquidPool_;
    }

    // INTERNAL METHODS

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function _onboardNode(uint requestId, address node, uint nodeId) private {
        require(node != address(0), "Node address can't be zero");
        require(_requestStake > 0, "No active request");
        require(validatorSet.getNodeStake(node) == 0, "Node already onboarded");
        require(requestId == _requestId, "Invalid request id");

        if (nodeId == nodes.length && getFreeBalance() >= _requestStake) {
            nodes.push(node);
            _totalNodesStake += _requestStake;
            validatorSet.newStake(node, _requestStake, true);
            emit NodeOnboarded(node, nodeId, _requestStake);
        } else {
            emit RequestFailed(requestId, nodeId, _requestStake);
        }

        _requestStake = 0;
        _requestNodeCreation();
    }

    function _retireNode() private returns (uint){
        address node = nodes[nodes.length - 1];
        uint deposit = getNodeDeposit(node);
        _totalNodesStake -= deposit;
        validatorSet.unstake(node, deposit);
        nodes.pop();
        emit NodeRetired(nodes.length, deposit);
        return deposit;
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

    modifier onlyPool() {
        require(msg.sender == address(liquidPool), "LiquidNodeManager: caller is not a pool");
        _;
    }
}
