import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { TEST_BlockListener, TEST_Pool_Manager, TEST_ValidatorSet } from "../../typechain-types";

describe("ValidatorSet", function () {
  const addrs = Array.from({ length: 100 }, (_, i) =>
    ethers.utils.getAddress(ethers.utils.hashMessage(i.toString()).substring(0, 42))
  );

  let validatorSet: TEST_ValidatorSet;
  let testPool: TEST_Pool_Manager;
  let blockListener: TEST_BlockListener;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const ValidatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(ValidatorSetFactory, [
      owner.address,
      owner.address,
      10,
      2,
    ])) as TEST_ValidatorSet;

    // const LockKeeperFactory = await ethers.getContractFactory("LockKeeper");
    // const lockKeeper = await LockKeeperFactory.deploy();

    const TestPoolFactory = await ethers.getContractFactory("TEST_Pool_Manager");
    const testPool = await TestPoolFactory.deploy(validatorSet.address);

    const BlockListener = await ethers.getContractFactory("TEST_BlockListener");
    blockListener = await BlockListener.deploy();
    await blockListener.deployed();

    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), testPool.address);

    return { validatorSet, testPool, owner };
  }

  beforeEach(async function () {
    ({ validatorSet, testPool } = await loadFixture(deploy));
  });

  // todo make funtions like removeTop, removeQueue, addTop, addQueue with finding new heads

  describe("Public functions", function () {
    afterEach(async function () {
      await integrityCheck();
    });

    describe("getValidators", function () {
      it("if no validators are finalized must return zero-length array", async function () {
        const validators = await validatorSet.getValidators();
        expect(validators).to.have.lengthOf(0);
      });
      it("if validators are finalized must return array of validators", async function () {
        const addresses = await ethers.getSigners();

        await testPool.addStake(addresses[0].address, { value: 100 });
        await testPool.addStake(addresses[1].address, { value: 100 });

        await validatorSet.finalizeChange();

        const validators = await validatorSet.getValidators();
        expect(validators).to.have.lengthOf(2);
      });
    });

    describe("addBlockListener", function () {
      it("should add a block listener", async function () {
        const [user] = await ethers.getSigners();
        await validatorSet.addBlockListener(user.address);

        await validatorSet.finalizeChange();

        const listeners = await validatorSet.getListeners();
        expect(listeners).to.have.lengthOf(1);
      });
    });

    describe("removeBlockListener", function () {
      it("should remove a block listener", async function () {
        await validatorSet.addBlockListener(blockListener.address);

        await validatorSet.finalizeChange();

        let listeners = await validatorSet.getListeners();
        expect(listeners).to.have.lengthOf(1);
        expect(listeners[0]).to.equal(blockListener.address);

        await validatorSet.removeBlockListener(blockListener.address);

        await validatorSet.finalizeChange();

        listeners = await validatorSet.getListeners();
        expect(listeners).to.have.lengthOf(0);
      });
    });

    describe("stake unstake", function () {
      const [A, B, C, D, E] = [
        "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        "0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
        "0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
      ].map(ethers.utils.getAddress);

      describe("new stake", function () {
        beforeEach(async function () {
          await testPool.addStake(A, { value: 100 });
          await expectArraysEqual([A], [], "initial");
        });

        // initial state:     TOP [A]    QUEUE []

        it("B should go to topStakes (coz free space)", async function () {
          await testPool.addStake(B, { value: 50 });
          await expectArraysEqual([A, B], []);
        });

        it("B should go to topStakes (coz free space)", async function () {
          await testPool.addStake(B, { value: 200 });
          await expectArraysEqual([A, B], []);
        });

        it("C should go to queueStakes", async function () {
          await testPool.addStake(B, { value: 200 });
          await testPool.addStake(C, { value: 10 });
          await expectArraysEqual([A, B], [C]);
        });

        it("C should go to topStakes instead A", async function () {
          await testPool.addStake(B, { value: 200 });
          await testPool.addStake(C, { value: 300 });
          await expectArraysEqual([C, B], [A]);
        });

        it("D should go to queueStakes", async function () {
          await testPool.addStake(B, { value: 200 });
          await testPool.addStake(C, { value: 300 });
          await testPool.addStake(D, { value: 50 });
          await expectArraysEqual([C, B], [A, D]);
        });

        it("D should go to topStakes instead B", async function () {
          await testPool.addStake(B, { value: 200 });
          await testPool.addStake(C, { value: 300 });
          await testPool.addStake(D, { value: 400 });
          await expectArraysEqual([C, D], [A, B]);
        });
      });

      describe("", function () {
        beforeEach(async function () {
          await testPool.addStake(A, { value: 100 });
          await testPool.addStake(B, { value: 200 });
          await testPool.addStake(C, { value: 300 });
          await testPool.addStake(D, { value: 400 });
          await expectArraysEqual([C, D], [A, B], "initial");
        });

        describe("remove stake", function () {
          // initial state:     TOP [C, D]    QUEUE [A, B]

          it("C (in top) unstakes completely and should be removed (replaced with B)", async function () {
            await testPool.removeStake(C, 300);
            await expectArraysEqual([D, B], [A]);
          });

          it("D (in top) unstakes completely and should be removed (replaced with B)", async function () {
            await testPool.removeStake(D, 400);
            await expectArraysEqual([C, B], [A]);
          });

          it("D (in top) unstakes completely and should be removed (replaced with B)", async function () {
            await validatorSet.changeTopStakesCount(3);
            await testPool.addStake(E, { value: 250 });
            await expectArraysEqual([C, D, E], [A, B], "initial");

            await testPool.removeStake(D, 400);
            await expectArraysEqual([C, E, B], [A]);
          });

          it("A (in queue) unstakes completely and should be removed", async function () {
            await testPool.removeStake(A, 100);
            await expectArraysEqual([C, D], [B]);
          });

          it("B (in queue) unstakes completely and should be removed", async function () {
            await testPool.removeStake(B, 200);
            await expectArraysEqual([C, D], [A]);
          });

          it("E (in queue) unstakes completely and should be removed", async function () {
            await testPool.addStake(E, { value: 150 });
            await expectArraysEqual([C, D], [A, B, E], "initial");

            await testPool.removeStake(E, 150);
            await expectArraysEqual([C, D], [A, B]);
          });

          it("A and B (in queue) unstakes completely and should be removed", async function () {
            await testPool.removeStake(A, 100);
            await testPool.removeStake(B, 200);
            await expectArraysEqual([C, D], []);
          });

          it("C (in top) unstakes completely (and queue is empty) and should be removed", async function () {
            await testPool.removeStake(A, 100);
            await testPool.removeStake(B, 200);
            await testPool.removeStake(C, 300);
            await expectArraysEqual([D], []);
          });

          it("D (in top) unstakes completely (and queue is empty) and should be removed", async function () {
            await testPool.removeStake(A, 100);
            await testPool.removeStake(B, 200);
            await testPool.removeStake(D, 400);
            await expectArraysEqual([C], []);
          });
        });

        describe("increase stake", function () {
          // initial state:     TOP [C, D]    QUEUE [A, B]

          it("C (in top) increase stake", async function () {
            await testPool.addStake(C, { value: 500 });
            await expectArraysEqual([C, D], [A, B]);
          });

          it("D (in top) increase stake", async function () {
            await testPool.addStake(D, { value: 500 });
            await expectArraysEqual([C, D], [A, B]);
          });

          it("A (in queue) increase stake and should go to top", async function () {
            await testPool.addStake(A, { value: 500 });
            await expectArraysEqual([A, D], [C, B]);
          });

          it("B (in queue) increase stake and should go to top", async function () {
            await testPool.addStake(B, { value: 500 });
            await expectArraysEqual([B, D], [A, C]);
          });

          it("A (in queue) increase stake and shouldn't go to top", async function () {
            await testPool.addStake(A, { value: 10 });
            await expectArraysEqual([C, D], [A, B]);
          });

          it("B (in queue) increase stake and shouldn't go to top", async function () {
            await testPool.addStake(B, { value: 10 });
            await expectArraysEqual([C, D], [A, B]);
          });
        });

        describe("decrease stake", function () {
          // initial state:     TOP [C, D]    QUEUE [A, B]

          it("C (in top) decreased stake and should be replaced with B", async function () {
            await testPool.removeStake(C, 200);
            await expectArraysEqual([B, D], [A, C]);
          });

          it("D (in top) decreased stake and should be replaced with B", async function () {
            await testPool.removeStake(D, 300);
            await expectArraysEqual([C, B], [A, D]);
          });

          it("C (in top) decreased stake and shouldn't be replaced", async function () {
            await testPool.removeStake(C, 10);
            await expectArraysEqual([C, D], [A, B]);
          });

          it("D (in top) decreased stake and shouldn't be replaced", async function () {
            await testPool.removeStake(D, 10);
            await expectArraysEqual([C, D], [A, B]);
          });

          it("A (in queue) decreased stake", async function () {
            await testPool.removeStake(A, 10);
            await expectArraysEqual([C, D], [A, B]);
          });

          it("B (in queue) decreased stake", async function () {
            await testPool.removeStake(B, 10);
            await expectArraysEqual([C, D], [A, B]);
          });
        });
      });
    });

    describe("setReward", function () {
      it("should update the base reward", async function () {
        const newBaseReward = 100; // Your desired new base reward
        await validatorSet.setReward(newBaseReward);

        // Ensure the base reward is updated
        const updatedBaseReward = await validatorSet.baseReward();
        expect(updatedBaseReward).to.be.equal(newBaseReward);
      });
    });
  });

  describe("modifiers", function () {
    describe("onlySuperUser", function () {
      it("should revert access for other addresses", async function () {
        const [user] = await ethers.getSigners();
        expect(validatorSet.connect(user).finalizeChange()).to.be.revertedWith(
          "only super user can call this function"
        );
      });
      it("if address is super user, shouldn't be reverted", async function () {
        const [user] = await ethers.getSigners();
        await validatorSet.grantRole(validatorSet.DEFAULT_ADMIN_ROLE(), user.address);
        expect(validatorSet.connect(user).finalizeChange()).not.to.be.revertedWith(
          "only super user can call this function"
        );
      });
    });

    describe("onlyValidator", function () {
      it("should revert access for other addresses", async function () {
        const [user] = await ethers.getSigners();
        expect(validatorSet.connect(user).process()).to.be.revertedWith("only validator can call this function");
      });
    });
  });

  describe("Private functions", function () {
    // it("compare stakes", async function () {
    //   expect(await compare({ownerAddress: addrs[0]}, {ownerAddress: addrs[0]}), "equal owner == equal stakes").to.be.eq(0);
    //
    //   expect(await compare({stake: 10}, {stake: 20})).to.be.eq(-1);
    //   expect(await compare({stake: 20}, {stake: 10})).to.be.eq(+1);
    //
    //
    // });
  });

  async function integrityCheck() {
    const hasDuplicates = (array: any[]) => new Set(array).size !== array.length;

    async function findMinOrMaxStake(array: any[], comparing: number) {
      let index = 0;
      for (let i = 1; i < array.length; i++) if ((await compareStakes(array[i], array[index])) === comparing) index = i;
      return index;
    }

    const top = await validatorSet.getTopStakes();
    const queue = await validatorSet.getQueuedStakes();

    const topStructs = await Promise.all(top.map((addr) => validatorSet.stakes(addr)));
    const queueStructs = await Promise.all(queue.map((addr) => validatorSet.stakes(addr)));

    expect(await validatorSet.lowestStakeIndex(), "lowestStakeIndex").to.be.eq(await findMinOrMaxStake(topStructs, -1));
    expect(await validatorSet.highestStakeIndex(), "highestStakeIndex").to.be.eq(
      await findMinOrMaxStake(queueStructs, +1)
    );

    // const stakesStructs = await Promise.all(nodeAddresses.map(async (addr) => await validatorSet.stakes(addr)));

    //
    // // balance should be equal
    // const contractBalance = await ethers.provider.getBalance(validatorSet.address);
    // const stakeAmounts = stakesStructs.map((stake) => stake.amount);
    // const sumOfStakes = stakeAmounts.reduce((a, b) => a.add(b), BigNumber.from(0));
    // expect(contractBalance).to.be.eq(sumOfStakes);
    //

    // duplicates check

    expect(hasDuplicates(top), "duplicates in top").to.be.false;
    expect(hasDuplicates(queue), "duplicates in queue").to.be.false;

    const nodeAddresses = [...top, ...queue];
    expect(hasDuplicates(nodeAddresses), "intersection between top and queue").to.be.false;
  }

  async function expectArraysEqual(topStake: string[], queueStake: string[], message?: string) {
    message = message ? message + ": " : "";
    expect(await validatorSet.getTopStakes(), message + "top").to.eql(topStake);
    expect(await validatorSet.getQueuedStakes(), message + "queue").to.be.eql(queueStake);
  }

  async function compareStakes(a: any, b: any) {
    const _defaultStake = { amount: 0, isAlwaysTop: 0 };
    return +(await validatorSet.compareStakes({ ..._defaultStake, ...a }, { ..._defaultStake, ...b }));
  }
});
