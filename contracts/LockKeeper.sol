// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract LockKeeper {
    using SafeERC20 for IERC20;

    constructor() {

    }


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
    mapping(uint => Lock) public locks;
    mapping(address => uint[]) public userLocks;

    struct Lock {
        address locker;
        address receiver;
        address token;  // 0x0 for native coin

        uint64 firstUnlockTime;
        uint64 unlockPeriod;

        uint64 totalClaims;
        uint64 timesClaimed;

        uint256 intervalAmount;
    }

    event Locked(
        uint indexed lockId, address indexed receiver,
        address indexed token, address locker,
        uint64 lockTime, uint64 firstUnlockTime, uint64 unlockPeriod,
        uint64 totalClaims, uint256 intervalAmount, string description
    );
    event Claim(); // todo

    function allUserLocks(address user) public view returns (uint[] memory) {
        return userLocks[user];
    }


    function lockSingle(address receiver, address token,
        uint64 unlockTime, uint256 amount,
        string memory description
    ) public payable {
        lockLinear(receiver, token, unlockTime, 1, 0, amount, description);
    }

    function lockLinear(
        address receiver, address token,
        uint64 firstUnlockTime, uint64 totalClaims,
        uint64 unlockPeriod, uint256 unlockAmount,
        string memory description
    ) public payable {
        require(totalClaims > 0, "LockKeeper: totalClaims must be > 0");
        uint totalAmount = unlockAmount * totalClaims;
        if (token == address(0)) {
            require(msg.value == totalAmount, "LockKeeper: wrong AMB amount");
        } else {
            require(msg.value == 0, "LockKeeper: why do you send AMB?");
            IERC20(token).transferFrom(msg.sender, address(this), totalAmount);
        }

        locks[++latestLockId] = Lock({
            locker : msg.sender,
            receiver: receiver,
            token: token,
            firstUnlockTime: firstUnlockTime,
            unlockPeriod: unlockPeriod,
            totalClaims: totalClaims,
            timesClaimed: 0,
            intervalAmount: unlockAmount
        });

        userLocks[receiver].push(latestLockId);

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
    }

    function claimAll() public {
        uint[] memory userLocks_ = allUserLocks(msg.sender);
        bool somethingClaimed;
        for (uint i = 0; i < userLocks_.length; i++) {
            if (_claim(userLocks_[i]) > 0)
                somethingClaimed = true;
        }
        require(somethingClaimed, "LockKeeper: nothing to claim");
    }

    function claim(uint lockId) public {
        require(_claim(lockId) != 0, "LockKeeper: too early to claim");
    }

    function cancelLock(uint lockId) public {
        Lock memory lock = locks[lockId];
        require(msg.sender == lock.locker, "Only address that create lock can cancel it");
        uint unclaimedAmount = (lock.totalClaims - lock.timesClaimed) * lock.intervalAmount;

        if (lock.token == address(0)) {
            payable(lock.receiver).transfer(unclaimedAmount);
        } else {
            IERC20(lock.token).transfer(lock.locker, unclaimedAmount);
        }

        _deleteLock(lockId, lock.receiver);
        // todo cancel event
    }

    function _claim(uint lockId) internal returns (uint256) {
        Lock storage lock = locks[lockId];  // todo try memory
        require(lock.totalClaims > 0, "LockKeeper: lock not found");
        require(lock.receiver == msg.sender, "LockKeeper: not your lock");
        //        require(lock.timesClaimed < lock.totalClaims, "LockKeeper: all intervals claimed [CAN'T BE]");

        uint64 firstCantClaimTime = lock.firstUnlockTime + lock.unlockPeriod * lock.timesClaimed;
        uint lastCanClaimIndex = lock.timesClaimed;

        while (lastCanClaimIndex < lock.totalClaims) {
            if (uint64(block.timestamp) < firstCantClaimTime)
                break;

            firstCantClaimTime += lock.unlockPeriod;
            lastCanClaimIndex++;

        }


        uint amountToClaim = (lastCanClaimIndex - lock.timesClaimed) * lock.intervalAmount;
        if (amountToClaim == 0) {
            return 0;
        }

        if (lock.token == address(0)) {
            payable(lock.receiver).transfer(amountToClaim);
        } else {
            IERC20(lock.token).transfer(lock.receiver, amountToClaim);
        }

        if (lastCanClaimIndex == lock.totalClaims) {
            _deleteLock(lockId, lock.receiver);
        } else {
            lock.timesClaimed = uint64(lastCanClaimIndex);
        }

        // todo event

        return amountToClaim;
    }

    function _deleteLock(uint lockId, address user) internal {
        delete locks[lockId];

        uint[] storage userLocks_ = userLocks[user];

        for (uint i = 0; i < userLocks_.length; i++) {
            if (userLocks_[i] != lockId) continue;
            userLocks_[i] = userLocks_[userLocks_.length - 1];
            userLocks_.pop();
            break;
        }
    }

}
