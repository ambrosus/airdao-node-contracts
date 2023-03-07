import {loadFixture, setBalance} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {Finance, MasterFinance} from "../../typechain-types";
import {BigNumber} from "ethers";


// todo test that rewards contract setBalance just like hardhat

describe("Finance", function () {
  const maxBankBalance = ethers.utils.parseEther("100000000"); // hello biden its zelensky we need 100 millions ambers
  const bankCount = 50;

  let masterFinance: MasterFinance;
  let finance: Finance;
  let owner: SignerWithAddress;

  async function deploy() {
    const masterFinanceFactory = await ethers.getContractFactory("MasterFinance");
    const masterFinance = await masterFinanceFactory.deploy(owner.address, bankCount, maxBankBalance);
    const financeFactory = await ethers.getContractFactory("Finance");
    const finance = await financeFactory.deploy(owner.address);
    return {masterFinance, finance};
  }

  beforeEach(async function () {
    ([owner] = await ethers.getSigners());
    ({masterFinance, finance} = await loadFixture(deploy));
  });

  describe("create banks", function () {

    it("all banks should have maxBankBalance balance", async function () {
      await setBalance(masterFinance.address, maxBankBalance.mul(bankCount));
      await masterFinance.transferToBanks();

      for (let i = 0; i < bankCount; i++) {
        const bank = await masterFinance.banks(i);
        expect(await ethers.provider.getBalance(bank), "bank-check-" + i).to.be.eq(maxBankBalance)
      }

      await expect(masterFinance.banks(bankCount), "bank-check-excess").to.be.reverted;
    });

    it("masterFinance will have extra balance via setBalance", async function () {
      await setBalance(masterFinance.address, maxBankBalance.mul(bankCount).add(420));
      await masterFinance.transferToBanks();

      for (let i = 0; i < bankCount; i++) {
        const bank = await masterFinance.banks(i);
        expect(await ethers.provider.getBalance(bank), "bank-check-" + i).to.be.eq(maxBankBalance)
      }

      await expect(await ethers.provider.getBalance(masterFinance.address)).to.be.eq(420);
    });


    it("masterFinance will have extra balance via transfer", async function () {
      await setBalance(masterFinance.address, maxBankBalance.mul(bankCount));
      await masterFinance.transferToBanks();

      await owner.sendTransaction({to: masterFinance.address, value: 420});

      for (let i = 0; i < bankCount; i++) {
        const bank = await masterFinance.banks(i);
        expect(await ethers.provider.getBalance(bank), "bank-check-" + i).to.be.eq(maxBankBalance)
      }

      await expect(await ethers.provider.getBalance(masterFinance.address)).to.be.eq(420);
    });

    it("last bank will have lower balance", async function () {
      await setBalance(masterFinance.address, maxBankBalance.mul(bankCount).sub(420));
      await masterFinance.transferToBanks();

      for (let i = 0; i < bankCount-1; i++) {
        const bank = await masterFinance.banks(i);
        expect(await ethers.provider.getBalance(bank), "bank-check-" + i).to.be.eq(maxBankBalance)
      }

      const bank = await masterFinance.banks(bankCount-1);
      expect(await ethers.provider.getBalance(bank), "bank-check-last").to.be.eq(maxBankBalance.sub(420));
    });



    // it("should crash coz balance exceed amount", async function () {
    //   await setBalance(masterFinance.address, maxBankBalance.mul(bankCount - 1));
    //   await expect(masterFinance.transferToBanks()).to.be.revertedWith('Not enough funds on this contract');
    // });

  });


  describe("withdraw", function () {

    beforeEach(async function () {
      await setBalance(masterFinance.address, maxBankBalance.mul(bankCount));
      await masterFinance.transferToBanks();
    });


    it("masterfinance withdraw()", async function () {
      await expect(masterFinance.withdraw(owner.address, 420))
        .to.changeEtherBalance(owner, 420)
        .to.emit(masterFinance, "Withdraw").withArgs(owner.address, 420)
    });

    it("masterfinance withdraw() extra balance", async function () {
      await owner.sendTransaction({to: masterFinance.address, value: 420});
      await expect(await ethers.provider.getBalance(masterFinance.address)).to.be.eq(420);

      await expect(masterFinance.withdraw(owner.address, 420))
        .to.changeEtherBalance(owner, 420)
        .to.emit(masterFinance, "Withdraw").withArgs(owner.address, 420)

      await expect(await ethers.provider.getBalance(masterFinance.address)).to.be.eq(0);
    });

    it("masterfinance withdraw() all, include extra balance", async function () {
      await owner.sendTransaction({to: masterFinance.address, value: 420});
      await expect(await ethers.provider.getBalance(masterFinance.address)).to.be.eq(420);

      let balance = (await masterFinance.getBalances())[1].reduce((acc, val) => acc.add(val), BigNumber.from(0))
      await masterFinance.withdraw(owner.address, balance);

      balance = (await masterFinance.getBalances())[1].reduce((acc, val) => acc.add(val), BigNumber.from(0))
      expect(balance).to.be.eq(0)
    });

    it("masterfinance withdraw() more than maxBankBalance ", async function () {
      const amount = maxBankBalance.mul(3).div(2)
      await expect(masterFinance.withdraw(owner.address, amount)).to.changeEtherBalance(owner, amount)
    });

    it("masterfinance withdraw() exceed balance ", async function () {
      const amount = maxBankBalance.mul(bankCount).add(1)
      await expect(masterFinance.withdraw(owner.address, amount)).to.be.revertedWith('transfer amount exceeds balance')
    });

    it("masterfinance withdraw() not owner ", async function () {
      const [_, notOwner] = await ethers.getSigners();
      await expect(masterFinance.connect(notOwner).withdraw(owner.address, 420)).to.be.revertedWith('Ownable: caller is not the owner')
    });


    it("masterfinance withdraw-replenish-withdraw ", async function () {
      await masterFinance.withdraw(owner.address, maxBankBalance.mul(5));
      await owner.sendTransaction({to: masterFinance.address, value: maxBankBalance.mul(2)})

      await masterFinance.withdraw(owner.address, maxBankBalance.mul(15));
      await owner.sendTransaction({to: masterFinance.address, value: maxBankBalance.mul(10)})

      await masterFinance.withdraw(owner.address, maxBankBalance.mul(2));
      await owner.sendTransaction({to: masterFinance.address, value: maxBankBalance.mul(4)})

      const balance = (await masterFinance.getBalances())[1].reduce((acc, val) => acc.add(val), BigNumber.from(0))
      await masterFinance.withdraw(owner.address, balance);
    });



    it("finance withdraw()", async function () {
      await expect(masterFinance.withdraw(finance.address, 420)).to.changeEtherBalance(finance, 420)

      await expect(finance.withdraw(owner.address, 420))
        .to.changeEtherBalance(owner, 420)
        .to.emit(finance, "Withdraw").withArgs(owner.address, 420)
    });

    it("finance withdraw() exceed balance", async function () {
      await expect(finance.withdraw(owner.address, 420)).to.be.revertedWith('transfer amount exceeds balance')
    });

    it("finance withdraw() not owner ", async function () {
      const [_, notOwner] = await ethers.getSigners();
      await expect(finance.connect(notOwner).withdraw(owner.address, 420)).to.be.revertedWith('Ownable: caller is not the owner')
    });


    it("bank withdraw() not owner ", async function () {
      const bank = await ethers.getContractAt("Bank", await masterFinance.banks(0));
      await expect(bank.connect(owner).withdraw(owner.address, 420)).to.be.revertedWith('Ownable: caller is not the owner')
    });


  });


});
