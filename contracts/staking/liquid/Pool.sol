// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../../consensus/IValidatorSet.sol";
import "../../finance/Finance.sol";
import "../../finance/Treasury.sol";
import "../../funds/RewardsBank.sol";
import "../IStakeManager.sol";
import "./StAMB.sol";
import "./IPool.sol";

contract Pool is AccessControl, IStakeManager, IPool {
    uint constant private MILLION = 1000000;
    uint constant private FIXEDPOINT = 1 ether;
    bytes32 constant public VALIDATOR_SET_ROLE = keccak256("VALIDATOR_SET_ROLE");
    bytes32 constant public BACKEND_ROLE = keccak256("BACKEND_ROLE");

    IValidatorSet public validatorSet;
    RewardsBank public rewardsBank;
    Treasury public treasury;
    Finance public finance;
    StAMB public token;
    uint public minStakeValue;
    uint public maxTotalStake;
    bool public active;
    uint public totalStake;
    uint public interest;
    uint public nodeStake; // stake for 1 onboarded node
    uint public maxNodesCount;
    address[] public nodes;

    uint private _requestId;
    uint private _requestStake; 

     constructor(
        IValidatorSet validatorSet_, RewardsBank rewardsBank_, Treasury treasury_, 
        StAMB token_, uint interest_, uint nodeStake_, uint minStakeValue_, uint maxNodesCount_
    ) {
        require(minStakeValue_ > 0, "Pool min stake value is zero");
        require(interest_ >= 0 && interest_ <= 1000000, "Invalid percent value");

        finance = new Finance(address(this));

        rewardsBank = rewardsBank_;
        treasury = treasury_;
        token = token_;
        minStakeValue = minStakeValue_;
        interest = interest_;
        nodeStake = nodeStake_;
        maxNodesCount = maxNodesCount_;
        nodes = new address[](0);

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(VALIDATOR_SET_ROLE, address(validatorSet_));
    }


    //EVENTS
    // VALIDATOR SET METHODS

    function reward(address nodeAddress, uint256 amount) public onlyRole(VALIDATOR_SET_ROLE) {
        uint treasuryAmount = treasury.calcFee(amount);
        rewardsBank.withdrawAmb(payable(address(treasury)), treasuryAmount);
        amount -= treasuryAmount;

        rewardsBank.withdrawAmb(payable(nodeAddress), amount);
        validatorSet.emitReward(address(rewardsBank), nodeAddress, nodeAddress, address(finance), address(0), amount);
        emit Reward(nodeAddress, amount);
        _requestNodeCreation();
    }

    // Why we need it?
    function report(address nodeAddress) public {}

    function setInterest(uint interest_) public onlyRole(VALIDATOR_SET_ROLE) {
        require(interest_ >= 0 && interest_ <= 1000000, "Invalid percent value");
        interest = interest_;
    }

    function transferRewards(address to, uint amount) public onlyRole(VALIDATOR_SET_ROLE) {
        rewardsBank.withdrawAmb(payable(to), amount);
    }


    // TODO: Why we need this stuff?? 
    // OWNER METHODS

    function activate() public payable onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!active, "Pool is already active");
        require(msg.value == nodeStake, "Send value not equals node stake value");
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

    function setBackendRole(address backend) public onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(BACKEND_ROLE, backend);
    }

    // BAKEND METHODS

    function increaseStake() public onlyRole(BACKEND_ROLE) {
        require(active, "Pool is not active");
        uint amount = totalStake * interest / MILLION;
        finance.withdraw(payable(address(this)), amount);
        emit StakeChanged(address(this), int(amount), int(_toTokens(amount)));
        _requestNodeCreation();
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

    //TODO: Update
    function stake() public payable {
        require(active, "Pool is not active");
        require(msg.value >= minStakeValue, "Pool: stake value too low");
        require(maxTotalStake == 0 || msg.value + totalStake <= maxTotalStake, "Pool: stake value too high");

        uint tokens = _toTokens(msg.value);

        // todo return (msg.value % tokenPrice) to user ?
        token.mint(msg.sender, tokens);
        totalStake += msg.value;
        emit StakeChanged(msg.sender, int(msg.value), int(tokens)); 
        _requestNodeCreation();
    }

    //TODO: Update
    function unstake(uint tokens) public {
        require(tokens <= token.balanceOf(msg.sender), "Sender has not enough tokens");
        uint deposit = _fromTokens(tokens);
        require(deposit <= totalStake, "Total stake is less than deposit");

        token.burn(msg.sender, tokens);
        while (address(this).balance < deposit) {
            _retireNode();
        }
        totalStake -= deposit;
        payable(msg.sender).transfer(deposit);
        emit StakeChanged(msg.sender, - int(deposit), - int(tokens));    
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

    function _fromTokens(uint amount) private view returns (uint) {
        uint tokenPrice = getTokenPrice();
        return amount * tokenPrice / FIXEDPOINT;
    }

    function _toTokens(uint amount) private view returns (uint) {
        uint tokenPrice = getTokenPrice();
        return amount * FIXEDPOINT / tokenPrice;
    }

   // VIEW METHODS

    function getStake() public view returns (uint) {
        return token.balanceOf(msg.sender);
    }

    function getTokenPrice() public view returns (uint) {
        uint totalTokens = token.totalSupply();
        if (totalTokens == 0) return 1 ether;

        return totalStake * FIXEDPOINT / totalTokens;
    }

    function getInterest() public view returns (uint) {
        return interest;
    }
    
    function getRewards() public view returns (uint) {
        return address(finance).balance;
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
 
    //TODO: Provide some fallback? Return funds to sender?
    receive() external payable {
        uint amount = msg.value;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Refund failed.");
    }

}
