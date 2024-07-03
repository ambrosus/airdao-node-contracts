// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../../consensus/IValidatorSet.sol";
import "../../finance/Treasury.sol";
import "../../funds/RewardsBank.sol";
import "../IStakeManager.sol";
import "./StAMB.sol";
import "./ILiquidPool.sol";
import "./StAMB.sol";
import "./RewardToken.sol";
import "./StakingTiers.sol";

contract LiquidPool is AccessControl, IStakeManager, ILiquidPool, StAMB {
    uint constant private MILLION = 1000000;
    bytes32 constant public VALIDATOR_SET_ROLE = keccak256("VALIDATOR_SET_ROLE");
    bytes32 constant public BACKEND_ROLE = keccak256("BACKEND_ROLE");

    IValidatorSet public validatorSet;
    RewardsBank public rewardsBank;
    Treasury public treasury;
    RewardToken public rewardToken;
    StakingTiers public tiers;
    bool public active;
    uint public minStakeValue;
    uint public totalStake;
    uint public interest;
    uint public interestRate; 
    uint public nodeStake; // stake for 1 onboarded node
    uint public maxNodesCount;
    uint public lockPeriod;
    address public bondAddress;
    address[] public nodes;
    // mapping user to user data 
    mapping (address => uint) private lastChanged;

    uint private _requestId;
    uint private _requestStake; 

    constructor(
        IValidatorSet validatorSet_, RewardsBank rewardsBank_, Treasury treasury_, StakingTiers tiers_,
        uint interest_, uint interestRate_, uint nodeStake_, uint minStakeValue_, uint maxNodesCount_,
        address bondAddress_, uint lockPeriod_
    ) {
        require(minStakeValue_ > 0, "Pool min stake value is zero");
        require(interest_ >= 0 && interest_ <= 1000000, "Invalid percent value");

        rewardToken = new RewardToken();

        rewardsBank = rewardsBank_;
        treasury = treasury_;
        tiers = tiers_;
        minStakeValue = minStakeValue_;
        interest = interest_;
        interestRate = interestRate_;
        nodeStake = nodeStake_;
        maxNodesCount = maxNodesCount_;
        lockPeriod = lockPeriod_;
        bondAddress = bondAddress_;
        active = true;
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

    function setInterestRate(uint interestRate_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        interestRate = interestRate_;
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

        _mint(msg.sender, msg.value);
        totalStake += msg.value;
        emit StakeChanged(msg.sender, int(msg.value)); 
        _requestNodeCreation();
    }

    function unstake(uint amount) public {
        require(amount <= balanceOf(msg.sender), "Sender has not enough tokens");
        require(amount <= totalStake, "Total stake is less than deposit");
        uint tier = tiers.getTier(msg.sender);
        if (rewardToken.balanceOf(msg.sender) > 0) {
            _claim(msg.sender, tier); 
        }

        if (obtainedAt(msg.sender) + lockPeriod > block.timestamp) {
            revert("Lock period is not expired");
        }

        _burn(msg.sender, amount);
        while (address(this).balance < amount) {
            _retireNode();
        }
        totalStake -= amount;
        payable(msg.sender).transfer(amount);
        emit StakeChanged(msg.sender, - int(amount));    
    }

    function claim(uint desiredCoeff) public {
        _claim(msg.sender, desiredCoeff); 
    }
   
    // PRIVATE METHODS

    function _onTransfer() internal override {
        require(_balances[msg.sender] != 0, "Stake is zero");
        uint userReward = _calculateUserReward(msg.sender);
        rewardToken.mint(msg.sender, userReward);
        lastChanged[msg.sender] = block.timestamp;
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

    function _retireNode() private {
        uint deposit = getNodeDeposit(nodes[nodes.length - 1]);
        validatorSet.unstake(nodes[nodes.length - 1], deposit);
        emit NodeRetired(nodes.length - 1, deposit);
        nodes.pop();
    }

    function _claim(address account, uint desiredCoeff) private {
        uint amount = rewardToken.balanceOf(account);
        require(amount > 0, "No rewards to claim");
         
        uint tier = tiers.getTier(account);
        if (tier == 0) {
            tiers.setTier(account, 750000);
            tier = 750000;
        }
        require(tier >= desiredCoeff, "User tier is too low");
        uint bondAmount = amount * tier / MILLION;
        uint ambAmount = amount - bondAmount;
        rewardsBank.withdrawAmb(payable(account), ambAmount);
        rewardsBank.withdrawErc20(bondAddress, payable(account), bondAmount);
        rewardToken.burn(account, amount);
        emit Claim(account, ambAmount, bondAmount);
    }

    function _calculateUserReward(address account) private returns (uint) {
        uint yield = _balances[account] * interest / MILLION;
        uint yieldPerSecond = yield / interestRate;

        uint timePassed = block.timestamp - lastChanged[account];
        uint yieldForPeriod = yieldPerSecond * timePassed;
        return yieldForPeriod;
    }

   // VIEW METHODS

    function getStake() public view returns (uint) {
        return _balances[msg.sender];
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
