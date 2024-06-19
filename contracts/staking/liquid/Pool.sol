// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./StAMB.sol";
import "./IPool.sol";
import "./NodesManager.sol";
import "../../consensus/IValidatorSet.sol";


contract Pool is Ownable, NodesManager, IPool {
    uint constant private MILLION = 1000000;
    uint constant private FIXEDPOINT = 1 ether;

    PoolToken public token;
    uint public minStakeValue;
    uint public maxTotalStake;
    uint public fee;
    bool public active;
    uint public totalStake;

    uint private _requestStake;
    uint private _requestId;

     constructor(
        uint minStakeValue_, uint fee_, uint maxTotalStake_,
        IValidatorSet validatorSet_, uint nodeStake_
    ) Ownable() NodesManager(validatorSet_, nodeStake_) {
        require(minStakeValue_ > 0, "Pool min stake value is zero");
        require(fee_ >= 0 && fee_ < MILLION, "Pool fee must be from 0 to 1000000");

        token = new PoolToken();
        minStakeValue = minStakeValue_;
        maxTotalStake = maxTotalStake_;
        fee = fee_;
    }

    //EVENTS

    event StakeChanged(address user, int stake, int tokens);
    event Reward(uint reward, uint tokenPrice);

    // TODO: Why we need this stuff?? 
    // OWNER METHODS

    function activate() public payable onlyOwner {
        require(!active, "Pool is already active");
        require(msg.value == nodeStake, "Send value not equals node stake value");
        active = true;
        _requestNodeCreation();
    }

    function deactivate(uint maxNodes) public onlyOwner {
        require(active, "Pool is not active");
        while (nodes.length > maxNodes) {
            _retireNode();
        }
        if (nodes.length == 0) {
            active = false;
            payable(msg.sender).transfer(nodeStake);
        }
    }

    // PUBLIC METHODS

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

    //TODO: Decide how the rewards should be distributed 
    function addReward() public payable {
        uint reward;

        if (nodes.length > 0) {
            reward = msg.value;
            if (msg.sender == nodes[0]) {

                uint extraStake = (totalStake % nodeStake);
                uint ownerStake = nodeStake - extraStake;

                // todo wtf?

                if (ownerStake < nodeStake)  // equal to (extraStake > 0)
                    reward -= reward * ownerStake / nodeStake;
                else // equal to (extraStake == 0)
                    reward = 0;

            }
            if (reward > 0) {
                if (fee > 0)
                    reward -= reward * fee / MILLION;

                totalStake += reward;
                emit Reward(reward, getTokenPrice());
            }
        }

        payable(owner()).transfer(msg.value - reward);
        _requestNodeCreation();
    }

    // VIEW METHODS

    function viewStake() public view returns (uint) {
        return token.balanceOf(msg.sender);
    }

    function getTokenPrice() public view returns (uint) {
        uint totalTokens = token.totalSupply();
        if (totalTokens == 0) return 1 ether;

        return totalStake * FIXEDPOINT / totalTokens;
    }

    // INTERNAL METHODS

    function _fromTokens(uint amount) internal view returns (uint) {
        uint tokenPrice = getTokenPrice();
        return amount * tokenPrice / FIXEDPOINT;
    }

    function _toTokens(uint amount) internal view returns (uint) {
        uint tokenPrice = getTokenPrice();
        return amount * FIXEDPOINT / tokenPrice;
    }
    
    //TODO: Provide some fallback? Return funds to sender?
    receive() external payable {}


}
