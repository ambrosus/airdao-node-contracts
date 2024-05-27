pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PoolToken.sol";
import "./PoolsNodes_Manager.sol";


contract Pool is Ownable {

    uint constant private MILLION = 1000000;
    uint constant private FIXEDPOINT = 1 ether;

    uint public id;
    string public name;
    PoolsNodes_Manager public manager;
    PoolToken public token;
    uint public nodeStake;  // stake for 1 onboarded node
    uint public minStakeValue;
    uint public maxTotalStake;
    uint public fee;
    bool public active;

    uint private _requestStake;
    uint private _requestId;

    uint public totalStake;
    address[] public nodes;


    function getVersion() public pure returns (string memory) {
        return "0.1.0";
    }

    constructor(
        string memory poolName, uint poolNodeStake, uint poolMinStakeValue, uint poolFee, uint poolMaxTotalStake,
        address payable manager_
    ) Ownable() public {

        require(poolNodeStake > 0, "Pool node stake value is zero");
        // node stake value is used as a divisor
        require(poolMinStakeValue > 0, "Pool min stake value is zero");
        require(poolFee >= 0 && poolFee < MILLION, "Pool fee must be from 0 to 1000000");


        manager = PoolsNodes_Manager(manager_);
        token = new PoolToken();
        nodeStake = poolNodeStake;
        minStakeValue = poolMinStakeValue;
        maxTotalStake = poolMaxTotalStake;
        fee = poolFee;
        name = poolName;
        id = _getManager().nextId();
    }

    // OWNER METHODS

    function activate() public payable onlyOwner {
        require(!active, "Pool is already active");
        require(msg.value == nodeStake, "Send value not equals node stake value");
        active = true;
        _onboardNodes();
    }

    function deactivate(uint maxNodes) public onlyOwner {
        require(active, "Pool is not active");
        while (nodes.length > maxNodes) {
            _removeNode();
        }
        if (nodes.length == 0) {
            active = false;
            transferViaCall(payable(msg.sender), nodeStake);
        }
    }

    function setName(string memory newName) public onlyOwner {
        name = newName;
    }


    // PUBLIC METHODS

    function stake() public payable {
        require(active, "Pool is not active");
        require(msg.value >= minStakeValue, "Pool: stake value too low");
        require(maxTotalStake == 0 || msg.value + totalStake <= maxTotalStake, "Pool: stake value too high");

        uint tokens = toTokens(msg.value);

        // todo return (msg.value % tokenPrice) to user ?
        token.mint(msg.sender, tokens);
        totalStake += msg.value;
        _getManager().poolStakeChanged(msg.sender, int(msg.value), int(tokens));
        _onboardNodes();
    }

    function unstake(uint tokens) public {
        require(tokens <= token.balanceOf(msg.sender), "Sender has not enough tokens");
        uint deposit = fromTokens(tokens);
        require(deposit <= totalStake, "Total stake is less than deposit");

        token.burn(msg.sender, tokens);
        while (address(this).balance < deposit) {
            _removeNode();
        }
        totalStake -= deposit;
        transferViaCall(payable(msg.sender), deposit);
        _getManager().poolStakeChanged(msg.sender, - int(deposit), - int(tokens));
    }

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
                _getManager().poolReward(reward, getTokenPrice());
            }
        }

        transferViaCall(payable(owner()), msg.value - reward);
        _onboardNodes();
    }


    // SERVICE METHODS

    function addNode(uint requestId, address node, uint nodeId) public {
        require(msg.sender == address(0), "Only service");
        // todo who is service

        require(node != address(0), "Node can not be zero");
        require(_requestStake > 0, "No active requests");
        uint status;
        if (active && requestId == _requestId) {
            if (nodeId == nodes.length && address(this).balance >= _requestStake) {
                _getManager().onboard{value : _requestStake}(node);
                nodes.push(node);
                status = 1;
            }
        }
        _getManager().addNodeRequestResolved(requestId, status);
        _requestStake = 0;
        _onboardNodes();
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

    function getNodesCount() public view returns (uint) {
        return nodes.length;
    }

    function getNodes() public view returns (address[] memory) {
        return nodes;
    }


    // INTERNAL METHODS

    function _onboardNodes() private {
        if (active && _requestStake == 0 && address(this).balance >= nodeStake) {
            _requestStake = nodeStake;
            _getManager().addNodeRequest(_requestStake, ++_requestId, nodes.length);
        }
    }

    function _removeNode() private {
        _getManager().retire(nodes[nodes.length - 1]);
        nodes.pop();
    }

    function _getManager() private view returns (PoolsNodes_Manager) {
        return manager;
    }

    function fromTokens(uint amount) internal view returns (uint) {
        uint tokenPrice = getTokenPrice();
        return amount * tokenPrice / FIXEDPOINT;
    }

    function toTokens(uint amount) internal view returns (uint) {
        uint tokenPrice = getTokenPrice();
        return amount * FIXEDPOINT / tokenPrice;
    }

    receive() external payable {}


}
