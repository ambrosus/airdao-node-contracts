// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../../consensus/IValidatorSet.sol";
import "../../finance/Treasury.sol";
import "../../funds/RewardsBank.sol";
import "../IStakeManager.sol";
import "./StAMB.sol";
import "./ILiquidPool.sol";

contract LiquidPool is UUPSUpgradeable, AccessControlUpgradeable, IStakeManager, ILiquidPool {
    uint constant private MILLION = 1000000;
    uint constant private FIXEDPOINT = 1 ether;
    bytes32 constant public VALIDATOR_SET_ROLE = keccak256("VALIDATOR_SET_ROLE");
    bytes32 constant public BACKEND_ROLE = keccak256("BACKEND_ROLE");

    IValidatorSet public validatorSet;
    RewardsBank public rewardsBank;
    Treasury public treasury;
    StAMB public token;
    uint public minStakeValue;
    bool public active;
    uint public totalStake;
    uint public interest;
    uint public nodeStake; // stake for 1 onboarded node
    uint public maxNodesCount;
    uint public lockPeriod;
    address public bondAddress;
    address[] public nodes;
    mapping (address => uint) public tiers;

    uint private _requestId;
    uint private _requestStake; 

    function initialize(
        IValidatorSet validatorSet_, RewardsBank rewardsBank_, Treasury treasury_, 
        StAMB token_, uint interest_, uint nodeStake_, uint minStakeValue_, uint maxNodesCount_,
        address[] memory addresses_, uint[] memory tiers_, address bondAddress_, uint lockPeriod_
    ) public initializer {
        require(minStakeValue_ > 0, "Pool min stake value is zero");
        require(interest_ >= 0 && interest_ <= 1000000, "Invalid percent value");
        require(addresses_.length == tiers_.length, "Addresses and tiers arrays have different length");

        for (uint i = 0; i < addresses_.length; i++) {
            tiers[addresses_[i]] = tiers_[i];
        }

        rewardsBank = rewardsBank_;
        treasury = treasury_;
        token = token_;
        minStakeValue = minStakeValue_;
        interest = interest_;
        nodeStake = nodeStake_;
        maxNodesCount = maxNodesCount_;
        lockPeriod = lockPeriod_;
        bondAddress = bondAddress_;
        nodes = new address[](0);

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(VALIDATOR_SET_ROLE, address(validatorSet_));
    }

    // IStakeManager impl

    function reward(address nodeAddress, uint256 amount) public onlyRole(VALIDATOR_SET_ROLE) {
        uint treasuryAmount = treasury.calcFee(amount);
        rewardsBank.withdrawAmb(payable(address(treasury)), treasuryAmount);
        amount -= treasuryAmount;

        rewardsBank.withdrawAmb(payable(nodeAddress), amount);
        validatorSet.emitReward(address(rewardsBank), nodeAddress, nodeAddress, address(rewardsBank), address(0), amount);
        emit Reward(nodeAddress, amount);
    }

    function report(address nodeAddress) public {}

    // OWNER METHODS
    function setInterest(uint interest_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(interest_ >= 0 && interest_ <= 1000000, "Invalid percent value");
        interest = interest_;
    }

    // If we will have updateable pool, we don't need this methods
    // TODO: Why we need this stuff?? 
    function activate() public payable onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!active, "Pool is already active");
        active = true;
        _requestNodeCreation();
    }

    function deactivate(uint maxNodes) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(active, "Pool is not active");
        while (nodes.length > maxNodes) {
            _retireNode();
        }
        if (nodes.length == 0) {
            active = false;
            payable(msg.sender).transfer(nodeStake);
        }
    }

    function setLockPeriod(uint lockPeriod_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        lockPeriod = lockPeriod_;
    }

    // BAKEND METHODS

    function distributeRewards() public onlyRole(BACKEND_ROLE) {
        require(active, "Pool is not active");
        uint totalReward = totalStake * interest / MILLION;
        token.accrueRewards(totalReward);
    }

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

    // PUBLIC METHODS

    function stake() public payable {
        require(active, "Pool is not active");
        require(msg.value >= minStakeValue, "Pool: stake value too low");

        token.mint(msg.sender, msg.value);
        totalStake += msg.value;
        emit StakeChanged(msg.sender, int(msg.value)); 
        _requestNodeCreation();
    }

    function unstake(uint amount) public {
        require(amount <= token.balanceOf(msg.sender), "Sender has not enough tokens");
        require(amount <= totalStake, "Total stake is less than deposit");
        _claim(msg.sender);

        if (token.obtainedAt(msg.sender) + lockPeriod > block.timestamp) {
            revert("Lock period is not expired");
        }

        token.burn(msg.sender, amount);
        while (address(this).balance < amount) {
            _retireNode();
        }
        totalStake -= amount;
        payable(msg.sender).transfer(amount);
        emit StakeChanged(msg.sender, - int(amount));    
    }

    function claim() public {
        _claim(msg.sender);
    }

   
    // PRIVATE METHODS

    function _requestNodeCreation() private {
        if (_requestStake == 0
            && address(this).balance >= nodeStake
            && nodes.length < maxNodesCount) {
            _requestId++;
            _requestStake = nodeStake;
            emit AddNodeRequest(_requestId, nodes.length, _requestStake);
        }
    }

    function _retireNode() private {
        uint deposit = getNodeDeposit(nodes[nodes.length - 1]);
        validatorSet.unstake(nodes[nodes.length - 1], deposit);
        emit NodeRetired(nodes.length - 1, deposit);
        nodes.pop();
    }

    function _claim(address account) private {
        uint amount = token.rewardOf(account);
        if (amount == 0) {
            return;
        } 
        uint tier = tiers[account];
        if (tier == 0) {
            tiers[account] = 750000;
            tier = 750000;
        }
        uint bondAmount = amount * tiers[account] / MILLION;
        uint ambAmount = amount - bondAmount;
        rewardsBank.withdrawAmb(payable(account), ambAmount);
        rewardsBank.withdrawErc20(bondAddress, payable(account), bondAmount);
        token.burnRewards(account, amount);
        emit Claim(account, ambAmount, bondAmount);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

   // VIEW METHODS

    function getStake() public view returns (uint) {
        return token.balanceOf(msg.sender);
    }

    function getInterest() public view returns (uint) {
        return interest;
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

    function getLockPeriod() public view returns (uint) {
        return lockPeriod;
    }
 
    receive() external payable {
        stake();
    }

}
