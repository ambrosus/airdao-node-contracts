// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IOnBlockListener} from "./consensus/OnBlockNotifier.sol";


contract LockKeeper is UUPSUpgradeable, AccessControlUpgradeable, IOnBlockListener {
    using SafeERC20 for IERC20;

    //______________[]__.__.__[]__.__.__[]__.__.__[]________________
    // firstUnlock -^           \     / -- unlockPeriod;          intervals count = totalClaims - 1
    // totalClaims here == 4                     ^- last unlock = firstUnlock + unlockPeriod * (totalClaims - 1)

    // examples:
    //    lockKeeper.lockLinear{value: 400}({
    //        receiver: 0x123...abc,
    //        token: 0x000...000,           // 0x0 for native coin
    //        firstUnlockTime: 1672531200,  // 01.01.2023 00:00:00 unix timestamp
    //        totalClaims: 4,               // 4 unlocks
    //        unlockPeriod: 3600,           // 1 hour
    //        unlockAmount: 100,            // 100 wei
    //        description: "example of lockLinear"
    //    });
    //    will lock 400 wei (100 wei for each unlock) of native coin
    //    first unlock will be at 01.01.2023 00:00:00
    //    next unlocks will be at 01.01.2023 01:00:00, 01.01.2023 02:00:00, 01.01.2023 03:00:00 (every 1 hour)
    //

    //    IERC20(tokenAddress).approve(lockKeeper, 100);  // approve 100 wei of token for lockKeeper
    //    lockKeeper.lockSingle({
    //        receiver: 0x123...abc,
    //        token: tokenAddress,          // address of some ERC20 token
    //        unlockTime: 1672531200,       // 01.01.2023 00:00:00 unix timestamp
    //        amount: 100,                  // 100 wei
    //        description: "example of lockSingle"
    //    })
    //    will lock 100 wei of token that can be claimed at 01.01.2023 00:00:00

    uint public latestLockId;
    mapping(uint => Lock) internal locks;
    uint[] internal locksList;

    struct Lock {
        address locker;
        address receiver;
        address token;  // 0x0 for native coin

        uint64 firstUnlockTime;
        uint64 unlockPeriod;

        uint64 totalClaims;
        uint64 timesClaimed;

        uint256 intervalAmount;
        string description;
    }

    event Locked(
        uint indexed lockId, address indexed receiver,
        address indexed token, address locker,
        uint64 lockTime, uint64 firstUnlockTime, uint64 unlockPeriod,
        uint64 totalClaims, uint256 intervalAmount, string description
    );
    event Claim(uint indexed lockId, address indexed userAddress, uint amount);
    event LockCanceled(uint indexed lockId, uint canceledAmount);

    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // VIEW

    function getLock(uint id) public view returns (Lock memory) {
        return locks[id];
    }

    function getAllLocksIds() public view returns (uint[] memory) {
        return locksList;
    }

    function getAllLocks() public view returns (Lock[] memory) {
        Lock[] memory resultLocks = new Lock[](locksList.length);
        for (uint i; i < locksList.length; i++)
            resultLocks[i] = locks[locksList[i]];
        return resultLocks;
    }


    function allUserLocks(address user) public view returns (uint[] memory, Lock[] memory) {
        uint[] memory resultIds = new uint[](locksList.length);
        Lock[] memory resultLocks = new Lock[](locksList.length);
        uint count;
        for (uint i; i < locksList.length; i++) {
            uint lockId = locksList[i];
            if (locks[lockId].receiver != user) continue;
            resultIds[count] = lockId;
            resultLocks[count++] = locks[lockId];
        }
        assembly {mstore(resultIds, count)}
        assembly {mstore(resultLocks, count)}
        return (resultIds, resultLocks);
    }

    // LOCKING

    function lockSingle(address receiver, address token,
        uint64 unlockTime, uint256 amount,
        string memory description
    ) public payable returns (uint) {
        return lockLinear(receiver, token, unlockTime, 1, 1, amount, description);
    }

    function lockLinear(
        address receiver, address token,
        uint64 firstUnlockTime, uint64 totalClaims,
        uint64 unlockPeriod, uint256 unlockAmount,
        string memory description
    ) public payable returns (uint) {
        require(totalClaims > 0, "LockKeeper: totalClaims must be > 0");
        uint totalAmount = unlockAmount * totalClaims;
        if (token == address(0)) {
            require(msg.value == totalAmount, "LockKeeper: wrong AMB amount");
        } else {
            require(msg.value == 0, "LockKeeper: why do you send AMB?");
            IERC20(token).transferFrom(msg.sender, address(this), totalAmount);
        }

        locks[++latestLockId] = Lock({
            locker: msg.sender,
            receiver: receiver,
            token: token,
            firstUnlockTime: firstUnlockTime,
            unlockPeriod: unlockPeriod,
            totalClaims: totalClaims,
            timesClaimed: 0,
            intervalAmount: unlockAmount,
            description : description
        });

        locksList.push(latestLockId);

        emit Locked(
            latestLockId,
            receiver,
            token,
            msg.sender,
            uint64(block.timestamp),

            firstUnlockTime,
            unlockPeriod,

            totalClaims,
            unlockAmount,
            description
        );

        return latestLockId;
    }

    // CLAIMING

    function claimAll() public {
        uint[] memory locksIds = locksList; // copy list coz it may change during claim
        bool somethingClaimed;
        for (uint i = 0; i < locksIds.length; i++) {
            Lock storage lock = locks[locksIds[i]];
            if (lock.receiver != msg.sender) continue;

            if (_claim(locksIds[i], lock) > 0)
                somethingClaimed = true;
        }
        require(somethingClaimed, "LockKeeper: nothing to claim");
    }

    function claim(uint lockId) public {
        Lock storage lock = locks[lockId];
        require(lock.receiver == msg.sender, "LockKeeper: not your lock");
        require(_claim(lockId, lock) != 0, "LockKeeper: too early to claim");
    }

    function autoClaim() public {
        uint[] memory locksIds = locksList; // copy list coz it may change during claim
        uint i = uint(block.number) % locksIds.length; // prevent claiming first lock every time
        for (; i < locksIds.length; i++) {
            bool isClaimed = _claim(locksIds[i], locks[locksIds[i]]) > 0;
            if (isClaimed) break; // currently can claim only one lock per tx
            // todo maybe limit by count or by used gas with ability to change
        }
    }

    // CANCELLING

    function cancelLock(uint lockId) public returns (uint unclaimedAmount) {
        Lock memory lock = locks[lockId];
        require(msg.sender == lock.locker, "Only address that create lock can cancel it");
        unclaimedAmount = (lock.totalClaims - lock.timesClaimed) * lock.intervalAmount;

        if (lock.token == address(0)) {
            payable(lock.receiver).transfer(unclaimedAmount);
        } else {
            IERC20(lock.token).transfer(lock.locker, unclaimedAmount);
        }

        _deleteLock(lockId);
        emit LockCanceled(lockId, unclaimedAmount);
        return unclaimedAmount;
    }

    // EXTERNAL

    function onBlock() external {
        autoClaim();
    }


    // INTERNAL

    function _claim(uint lockId, Lock storage lock) internal returns (uint256) {
        uint64 timeNow = uint64(block.timestamp);
        if (timeNow < lock.firstUnlockTime) return 0;

        uint lastCanClaimIndex = (timeNow - lock.firstUnlockTime) / lock.unlockPeriod + 1;
        if (lastCanClaimIndex > lock.totalClaims) lastCanClaimIndex = lock.totalClaims;

        uint amountToClaim = (lastCanClaimIndex - lock.timesClaimed) * lock.intervalAmount;
        if (amountToClaim == 0) return 0;

        if (lock.token == address(0)) {
            payable(lock.receiver).transfer(amountToClaim);
        } else {
            IERC20(lock.token).transfer(lock.receiver, amountToClaim);
        }

        if (lastCanClaimIndex == lock.totalClaims) {
            _deleteLock(lockId);
        } else {
            lock.timesClaimed = uint64(lastCanClaimIndex);
        }

        emit Claim(lockId, lock.receiver, amountToClaim);

        return amountToClaim;
    }

    function _deleteLock(uint lockId) internal {
        delete locks[lockId];

        for (uint i = 0; i < locksList.length; i++) {
            if (locksList[i] != lockId) continue;
            locksList[i] = locksList[locksList.length - 1];
            locksList.pop();
            break;
        }
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
