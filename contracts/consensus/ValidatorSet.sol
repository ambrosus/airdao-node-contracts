/*
Copyright: Ambrosus Inc.
Email: tech@ambrosus.io

This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

This Source Code Form is “Incompatible With Secondary Licenses”, as defined by the Mozilla Public License, v. 2.0.
*/
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;


import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "../LockKeeper.sol";
import "../staking/IStakeManager.sol";
import "./IValidatorSet.sol";
import "./OnBlockNotifier.sol";

/**
@title Implementation of Parities ValidatorSet contract with:
- simple add/remove methods
- only owner (set explicitly in constructor and transferable) can perform mutating functions
https://wiki.parity.io/Validator-Set.html
*/

contract ValidatorSet is UUPSUpgradeable, OnBlockNotifier, AccessControlEnumerableUpgradeable, IValidatorSet {

    bytes32 public constant STAKING_MANAGER_ROLE = keccak256("STAKING_MANAGER_ROLE");  // can use addStake / removeStake methods
    bytes32 public constant REWARD_ORACLE_ROLE = keccak256("REWARD_ORACLE_ROLE");  // can provide baseReward

    struct Stake {
        uint amount;
        IStakeManager stakingContract;
        bool isAlwaysTop;
    }

    mapping(address => Stake) public stakes;  // nodeAddress => Stake

    uint public topStakesCount;  // max validators count

    uint public baseReward; // base reward for validators; updated by reward oracle


    // NOTE: nodeAddresses here
    address[] internal finalizedValidators;  // consensus validators
    address[] internal topStakes; // top N stakes
    address[] internal queuedStakes; // other stakes

    uint public totalStakeAmount; // sum of all stakes

    uint internal _lowestStakeIndex; // index of the lowest stake in topStakes array
    uint internal _highestStakeIndex; // index of the highest stake in queueStakes array

    uint internal _latestRewardBlock; // block when reward was called last time (to prevent call more then once)
    uint internal _latestRemoveFromTopBlock; // block when node was removed from top list last time (to prevent call more then once per finalization)

    uint256[20] private __gap;

    event InitiateChange(bytes32 indexed parentHash, address[] newSet);  // emitted when topStakes changes and need to be finalized
    event ValidatorSetFinalized(address[] newSet);  // emitted when topStakes finalized to finalizedValidators

    event StakeCreated(address indexed nodeAddress, address indexed stakingContract, uint amount, bool isAlwaysTop);
    event StakeRemoved(address indexed nodeAddress, address indexed stakingContract);
    event StakeChanged(address indexed nodeAddress, address indexed stakingContract, int changeAmount);

    event QueueListNodeAdded(address indexed nodeAddress);
    event QueueListNodeRemoved(address indexed nodeAddress);

    event TopListNodeAdded(address indexed nodeAddress);
    event TopListNodeRemoved(address indexed nodeAddress);

    event Report(address indexed nodeAddress, uint malisciousType);
    event Reward(address indexed manager, address indexed nodeAddress, address indexed rewardReceiver,
        address nodeOwner, address tokenAddress, uint256 amount);

    event RewardError(address stakingManager, string errorText);


    function initialize(
        address _rewardOracle,
        uint _baseReward,
        uint _topStakesCount
    ) public initializer {
        baseReward = _baseReward;
        topStakesCount = _topStakesCount;


        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(REWARD_ORACLE_ROLE, _rewardOracle);
    }

    // PUBLIC USER VIEW METHODS

    // @return amount of stake for nodeAddress
    function getNodeStake(address nodeAddress) public view returns (uint) {
        return stakes[nodeAddress].amount;
    }

    // @return array of addresses of nodes
    function getValidators() public view returns (address[] memory) {
        return finalizedValidators;
    }

    // @return array of addresses of nodes
    function getTopStakes() public view returns (address[] memory) {
        return topStakes;
    }

    // @return array of addresses of nodes
    function getQueuedStakes() public view returns (address[] memory) {
        return queuedStakes;
    }

    function getStakesByManager(address manager) public view returns (address []memory result) {
        result = new address[](topStakes.length + queuedStakes.length);
        uint count;

        for (uint i = 0; i < topStakes.length; i++)
            if (address(stakes[topStakes[i]].stakingContract) == manager)
                result[count++] = topStakes[i];
        for (uint i = 0; i < queuedStakes.length; i++)
            if (address(stakes[queuedStakes[i]].stakingContract) == manager)
                result[count++] = queuedStakes[i];

        assembly {mstore(result, count)}

        return result;
    }

    // STAKING POOL METHODS

    function newStake(address nodeAddress, uint amount, bool isAlwaysTop) external onlyRole(STAKING_MANAGER_ROLE) {
        require(amount > 0, "amount must be > 0");
        require(stakes[nodeAddress].amount == 0, "Already has stake");

        stakes[nodeAddress] = Stake(amount, IStakeManager(msg.sender), isAlwaysTop);
        _addStake(nodeAddress);

        emit StakeCreated(nodeAddress, msg.sender, amount, isAlwaysTop);
        emit StakeChanged(nodeAddress, msg.sender, int(amount));
    }

    function stake(address nodeAddress, uint amount) external {
        require(amount > 0, "amount must be > 0");
        Stake storage stake = stakes[nodeAddress];
        require(stake.amount > 0, "Stake doesn't exist");
        require(address(stake.stakingContract) == msg.sender, "stakingContract must be the same");

        bool isInTopStakes = _compareWithLowestStake(nodeAddress) >= 0;
        if (isInTopStakes)
            totalStakeAmount += amount;
        stake.amount += amount;
        _increaseStake(nodeAddress, isInTopStakes);

        emit StakeChanged(nodeAddress, msg.sender, int(amount));
    }

    function unstake(address nodeAddress, uint amount) external {
        require(amount > 0, "amount must be > 0");
        Stake storage stake = stakes[nodeAddress];
        require(address(stake.stakingContract) == msg.sender, "stakingContract must be the same");
        require(stake.amount >= amount, "amount bigger than stake");

        bool isInTopStakes = _compareWithLowestStake(nodeAddress) >= 0;
        if (isInTopStakes)
            totalStakeAmount -= amount;
        stake.amount -= amount;

        emit StakeChanged(nodeAddress, msg.sender, - int(amount));

        if (stake.amount == 0) {
            _removeStake(nodeAddress, isInTopStakes);
            emit StakeRemoved(nodeAddress, msg.sender);
        } else {
            _decreaseStake(nodeAddress, isInTopStakes);
        }
        // todo ensure that no more than 5% validators leave topStake in a day by decreasing stake

    }


    function emitReward(address rewardsBank, address nodeAddress, address nodeOwner, address rewardReceiver, address tokenAddress, uint256 amount) external onlyRole(STAKING_MANAGER_ROLE) {
        emit Reward(rewardsBank, nodeAddress, rewardReceiver, nodeOwner, tokenAddress, amount);
    }

    // ADMIN METHODS


    function changeTopStakesCount(uint newTopStakesCount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTopStakesCount > 0, "newTopStakesCount must be > 0");
        if (newTopStakesCount < queuedStakes.length)
            require(newTopStakesCount + (queuedStakes.length / 8) >= queuedStakes.length, "decrease of more than 12.5% is not allowed");

        topStakesCount = newTopStakesCount;
    }

    function addBlockListener(IOnBlockListener listener) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _addListener(listener);
    }

    function removeBlockListener(IOnBlockListener listener) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _removeListener(listener);
    }


    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}


    // ORACLE METHODS

    function setReward(uint _baseReward) public onlyRole(REWARD_ORACLE_ROLE) {
        baseReward = _baseReward;
    }


    // SUPERUSER (NODE) METHODS


    function finalizeChange() onlySuperUser() public {
        finalizedValidators = topStakes;
        emit ValidatorSetFinalized(finalizedValidators);  // todo
    }


    function process() external onlyValidator() {
        _notifyAll();  // call `onBlock` method on listeners
        _reward();
        try this._updateExternal() {} catch {}
    }

    function _updateExternal() external {
        require(msg.sender == address(this));
        _tryMoveToQueue();
        _tryMoveFromQueue();
    }

    // PRIVATE METHODS

    function _topValidatorsChanged() internal {
        /* solium-disable-next-line security/no-block-members */
        emit InitiateChange(blockhash(block.number - 1), topStakes);

    }

    function _reward() internal {
        require(block.number > _latestRewardBlock, "reward already called in this block");
        _latestRewardBlock = block.number;

        Stake storage stake = stakes[msg.sender];
        uint rewardAmount = baseReward * finalizedValidators.length * stake.amount / totalStakeAmount;

        try stake.stakingContract.reward(msg.sender, rewardAmount) {
        } catch Error(string memory reason) {
            emit RewardError(address(stake.stakingContract), reason);
        } catch {
            emit RewardError(address(stake.stakingContract), "unknown error");
        }
    }

    // HELPERS


    function _addStake(address nodeAddress) internal {
        // add to queue and call _update() to move it to topStakes if needed
        _addToQueue(nodeAddress);
        _tryMoveFromQueue();
    }

    function _removeStake(address nodeAddress, bool isInTop) internal {
        // remove stake from everywhere
        delete stakes[nodeAddress];

        if (isInTop) {
            _removeFromTop(nodeAddress);
            // we have free space in topStakes, need to move node from queuedStakes to topStakes
            _tryMoveFromQueue();
        } else {
            _removeFromQueue(nodeAddress);
        }

    }

    function _increaseStake(address nodeAddress, bool isInTop) internal {
        if (isInTop) {
            if (nodeAddress == topStakes[_lowestStakeIndex]) {// lowest stake in top increased his stake, need to find new lowestStakeIndex
                _findLowestStakeIndex();
                _tryMoveFromQueue();
            }
        } else {
            if (_compareWithHighestStake(nodeAddress) >= 0) {// current node now has highest stake in queue, set highestStakeIndex to index of current node
                _highestStakeIndex = _findIndexByValue(queuedStakes, nodeAddress);
                _tryMoveFromQueue();
            }
        }
    }

    function _decreaseStake(address nodeAddress, bool isInTop) internal {
        if (isInTop) {
            if (_compareWithLowestStake(nodeAddress) <= 0) {// current node now has lowest stake in top, set lowestStakeIndex to index of current node
                _lowestStakeIndex = _findIndexByValue(topStakes, nodeAddress);
                _tryMoveFromQueue();
            }
        } else {
            if (nodeAddress == queuedStakes[_highestStakeIndex]) {// highest stake in queue decreased his stake, need to find new highestStakeIndex
                _findHighestStakeIndex();
                _tryMoveFromQueue();
            }
        }
    }

    function _tryMoveFromQueue() internal {
        if (queuedStakes.length == 0) return;

        if (topStakes.length < topStakesCount) {
            // move highest stake in queue to topStakes
            address removedFromQueue = _removeFromQueueByIndex(_highestStakeIndex);
            _addToTop(removedFromQueue);

        } else if (topStakes.length == topStakesCount) {
            if (_compareWithLowestStake(queuedStakes[_highestStakeIndex]) > 0) {
                address removedFromTop = _removeFromTopByIndex(_lowestStakeIndex);
                address removedFromQueue = _removeFromQueueByIndex(_highestStakeIndex);
                _addToQueue(removedFromTop);
                _addToTop(removedFromQueue);
            }
        }

    }

    function _tryMoveToQueue() internal {
        if (topStakes.length <= topStakesCount) return;
        if (block.number < _latestRemoveFromTopBlock + finalizedValidators.length) return;  // no more than once per round

        address removedFromTop = _removeFromTopByIndex(_lowestStakeIndex);
        _addToQueue(removedFromTop);
    }

    // MORE LOW LEVEL HELPERS

    function _addToQueue(address nodeAddress) internal {
        queuedStakes.push(nodeAddress);

        if (queuedStakes.length == 1) // if current node is the only one in queuedStakes - it is highestStakeIndex
            _highestStakeIndex = 0;
        else if (_compareWithHighestStake(nodeAddress) > 0) // current node now has highest stake
            _highestStakeIndex = queuedStakes.length - 1;

        emit QueueListNodeAdded(nodeAddress);
    }

    function _addToTop(address nodeAddress) internal {
        topStakes.push(nodeAddress);
        _topValidatorsChanged();

        if (_compareWithLowestStake(topStakes[topStakes.length - 1]) < 0) // check if new node is now  _lowestStakeIndex
            _lowestStakeIndex = topStakes.length - 1;

        totalStakeAmount += stakes[nodeAddress].amount;

        emit TopListNodeAdded(nodeAddress);
    }

    function _removeFromQueue(address nodeAddress) internal {
        uint index = _findIndexByValue(queuedStakes, nodeAddress);
        _removeFromQueueByIndex(index);
    }

    function _removeFromQueueByIndex(uint index) internal returns (address) {
        address nodeAddress = queuedStakes[index];
        _removeByIndex(queuedStakes, index);

        if (_highestStakeIndex == index)  // need to find new highestStakeIndex
            _findHighestStakeIndex();
        else if (_highestStakeIndex == queuedStakes.length)  // if highestStakeIndex was last in queue - now it moved to `index`
            _highestStakeIndex = index;

        emit QueueListNodeRemoved(nodeAddress);
        return nodeAddress;
    }

    function _removeFromTop(address nodeAddress) internal {
        uint index = _findIndexByValue(topStakes, nodeAddress);
        _removeFromTopByIndex(index);
    }

    function _removeFromTopByIndex(uint index) internal returns (address) {
        address nodeAddress = topStakes[index];
        _removeByIndex(topStakes, index);
        _topValidatorsChanged();

        if (_lowestStakeIndex == index) // need to find new lowestStakeIndex
            _findLowestStakeIndex();
        else if (_lowestStakeIndex == topStakes.length) // if lowestStakeIndex was last in topStakes - now it moved to `index`
            _lowestStakeIndex = index;

        totalStakeAmount -= stakes[nodeAddress].amount;
        _latestRemoveFromTopBlock = block.number;

        emit TopListNodeRemoved(nodeAddress);
        return nodeAddress;
    }

    // ANOTHER TYPE OF HELPERS

    function _findLowestStakeIndex() internal {
        //        uint lowestStakeIndex = 0;
        // todo check gas with internal variable usage
        _lowestStakeIndex = 0;
        for (uint i = 1; i < topStakes.length; i++) {
            if (_compareStakes(stakes[topStakes[i]], stakes[topStakes[_lowestStakeIndex]]) < 0)
                _lowestStakeIndex = i;
        }
    }

    function _findHighestStakeIndex() internal {
        if (queuedStakes.length == 0) return;
        // todo check gas with internal variable usage
        _highestStakeIndex = 0;
        for (uint i = 1; i < queuedStakes.length; i++) {
            if (_compareStakes(stakes[queuedStakes[i]], stakes[queuedStakes[_highestStakeIndex]]) > 0)
                _highestStakeIndex = i;
        }
    }


    function _compareWithHighestStake(address nodeAddress) internal view returns (int) {
        return _compareStakesA(nodeAddress, queuedStakes[_highestStakeIndex]);
    }

    function _compareWithLowestStake(address nodeAddress) internal view returns (int) {
        return _compareStakesA(nodeAddress, topStakes[_lowestStakeIndex]);
    }

    function _compareStakesA(address a, address b) internal view returns (int) {
        if (a == b) return 0;
        return _compareStakes(stakes[a], stakes[b]);
    }

    function _compareStakes(Stake memory a, Stake memory b) internal pure returns (int) {
        // returns
        // 1 if a > b
        // -1 if a < b

        // if one of the stakes is always in top => it is higher
        if (a.isAlwaysTop != b.isAlwaysTop) {
            return (a.isAlwaysTop) ? int(1) : - 1;
        }

        // compare stakes
        if (a.amount > b.amount) return 1;
        if (a.amount < b.amount) return - 1;

        return 0;
        // todo
        // compare timestamps
        //        return (a.timestampStake > b.timestampStake) ? int(1) : - 1;
    }


    function _findIndexByValue(address[] storage array, address value) internal view returns (uint) {
        for (uint i = 0; i < array.length; i++)
            if (array[i] == value) return i;
        revert("Value not found");
    }

    function _removeByIndex(address[] storage array, uint i) internal {
        array[i] = array[array.length - 1];
        array.pop();
    }

    // MODIFIERS

    modifier onlySuperUser() {
        require(msg.sender == 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "only super user can call this function");
        _;
    }

    modifier onlyValidator() {
        // current validator or multisig
        require(msg.sender == block.coinbase, "only super user can call this function");
        _;
    }

}
