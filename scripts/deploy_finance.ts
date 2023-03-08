import { ethers } from "hardhat";
import { deploy, loadDeployment } from "../src/utils/deployments";
import { ContractNames } from "../src";
import { Andrii, Igor, Kevin, Lang, Rory, Seth, SharedDevAcc, Stefan } from "./addresses";

async function main() {
  const MultisigFactory = await ethers.getContractFactory("Multisig");
  const MasterFinanceFactory = await ethers.getContractFactory("MasterFinance");
  const FinanceFactory = await ethers.getContractFactory("Finance");

  const networkName = (await ethers.provider.getNetwork()).chainId.toString();
  const [deployer] = await ethers.getSigners();

  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, networkName).address;

  async function deployFinance(
    financeName: ContractNames,
    signers: string[],
    isInitiator: boolean[],
    threshold: number
  ) {
    const multisigName = (financeName + "_Multisig") as ContractNames;
    console.assert(Object.values(ContractNames).includes(multisigName), `can't find ${multisigName} in ContractNames`);

    const multisig = await deploy(
      multisigName,
      networkName,
      MultisigFactory,
      [signers, isInitiator, threshold, masterMultisig],
      deployer
    );
    await deploy(financeName, networkName, FinanceFactory, [multisig.address], deployer);
  }

  if (networkName == "16718") {
    console.log("--- MAINNET DEPLOYMENT ---");

    const maxBankBalance = ethers.utils.parseEther("100000000"); // 100 millions amb per bank
    const bankCount = 50;

    // finance master
    const multisig = await deploy(
      ContractNames.FinanceMasterMultisig,
      networkName,
      MultisigFactory,
      [[Lang, Igor, Rory, Kevin, Stefan], [true, true, true, true, true], 75, masterMultisig],
      deployer
    );
    await deploy(
      ContractNames.FinanceMaster,
      networkName,
      MasterFinanceFactory,
      [multisig.address, bankCount, maxBankBalance],
      deployer
    );

    // other finances
    await deployFinance(ContractNames.FinanceRewards, [Lang, Igor, Andrii], [true, true, false], 75);
    await deployFinance(ContractNames.FinanceInvestors, [Lang, Igor, Rory], [true, true, true], 75);
    await deployFinance(
      ContractNames.FinanceTeam,
      [Lang, Igor, Rory, Kevin, Stefan],
      [true, true, true, true, true],
      75
    );
    await deployFinance(ContractNames.FinanceEcosystem, [Lang, Kevin, Seth], [true, true, false], 75);
  } else {
    const maxBankBalance = ethers.utils.parseEther("100");
    const bankCount = 50;

    // finance master
    const multisig = await deploy(
      ContractNames.FinanceMasterMultisig,
      networkName,
      MultisigFactory,
      [[SharedDevAcc], [true], 100, masterMultisig],
      deployer
    );
    await deploy(
      ContractNames.FinanceMaster,
      networkName,
      MasterFinanceFactory,
      [multisig.address, bankCount, maxBankBalance],
      deployer
    );

    // other finances
    await deployFinance(ContractNames.FinanceRewards, [SharedDevAcc], [true], 100);
    await deployFinance(ContractNames.FinanceInvestors, [Lang, Igor, Rory], [true, true, true], 75);
    await deployFinance(
      ContractNames.FinanceTeam,
      [Lang, Igor, Rory, Kevin, Stefan],
      [true, true, true, true, true],
      75
    );
    await deployFinance(ContractNames.FinanceEcosystem, [Lang, Kevin, Seth], [true, true, false], 75);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
