import {loadFixture, setBalance} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {Finance, MasterFinance} from "../../typechain-types";


// todo test that rewards contract setBalance just like hardhat

describe("Finance", function () {
  const maxBankBalance = ethers.utils.parseEther("100000000"); // hello biden its zelensky we need 100 millions ambers
  const bankCount = 50;

  let masterFinance: MasterFinance;
  let finance: Finance;
  let owner: SignerWithAddress;

  async function deploy() {
    const masterFinanceFactory = await ethers.getContractFactory("MasterFinance");
    const masterFinance = await masterFinanceFactory.deploy(owner.address);
    const financeFactory = await ethers.getContractFactory("Finance");
    const finance = await financeFactory.deploy(owner.address);
    return {masterFinance, finance};
  }

  beforeEach(async function () {
    ([owner] = await ethers.getSigners());
    ({masterFinance, finance} = await loadFixture(deploy));
  });

  describe("create banks", function () {

    it("should work", async function () {
      await setBalance(masterFinance.address, maxBankBalance.mul(bankCount));
      await masterFinance.createBanks();

      for (let i = 0; i < bankCount; i++) {
        const bank = await masterFinance.banks(i);
        expect(await ethers.provider.getBalance(bank), "bank-check-" + i).to.be.eq(maxBankBalance)
      }

      await expect(masterFinance.banks(bankCount), "bank-check-excess").to.be.reverted;
    });

    it("should crash coz balance exceed amount", async function () {
      await setBalance(masterFinance.address, maxBankBalance.mul(bankCount - 1));
      await expect(masterFinance.createBanks()).to.be.revertedWith('Not enough funds on this contract');
    });

  });


  describe("withdraw", function () {

    beforeEach(async function () {
      await setBalance(masterFinance.address, maxBankBalance.mul(bankCount));
      await masterFinance.createBanks();
    });


    it("masterfinance withdraw()", async function () {
      await expect(masterFinance.withdraw(owner.address, 420))
        .to.changeEtherBalance(owner, 420)
        .to.emit(masterFinance, "Withdraw").withArgs(owner.address, 420)
    });

    it("masterfinance withdraw() more than maxBankBalance ", async function () {
      const amount = ethers.utils.parseEther("150000000");
      await expect(masterFinance.withdraw(owner.address, amount)).to.changeEtherBalance(owner, amount)
    });

    it("masterfinance withdraw() exceed balance ", async function () {
      const amount = maxBankBalance.mul(bankCount).add(1)
      await expect(masterFinance.withdraw(owner.address, amount)).to.be.revertedWith('No money :(')
    });

    it("masterfinance withdraw() not owner ", async function () {
      const [_, notOwner] = await ethers.getSigners();
      await expect(masterFinance.connect(notOwner).withdraw(owner.address, 420)).to.be.revertedWith('Ownable: caller is not the owner')
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
