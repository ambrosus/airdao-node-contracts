import { ethers } from "hardhat";
import { loadDeployment } from "../src/utils/deployments";
import { ContractNames } from "../src";
import {
  Andrii,
  AndriiTest,
  DimaTest,
  DimaTest08,
  DimaTest2B,
  DimaTest3C,
  DimaTest96,
  Igor,
  Kevin,
  Lang,
  Rory,
  Seth,
  SharedDev,
  Stefan,
} from "./addresses";
import { deploy } from "../src/dev/deploy";
import { Finance__factory, MasterFinance__factory, Multisig__factory } from "../typechain-types";

async function main() {
  const networkName = ethers.provider.network.name;
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

    const multisig = await deploy<Multisig__factory>(
      multisigName,
      networkName,
      "Multisig",
      [signers, isInitiator, threshold, masterMultisig],
      deployer
    );
    await deploy<Finance__factory>(financeName, networkName, "Finance", [multisig.address], deployer);
  }

  if (networkName == "16718") {
    console.log("--- MAINNET DEPLOYMENT ---");

    const maxBankBalance = ethers.utils.parseEther("100000000"); // 100 millions amb per bank
    const bankCount = 50;

    // finance master
    const multisig = await deploy<Multisig__factory>(
      ContractNames.FinanceMasterMultisig,
      networkName,
      "Multisig",
      [[Lang, Igor, Rory, Kevin, Stefan], [true, true, true, true, true], 75, masterMultisig],
      deployer
    );
    await deploy<MasterFinance__factory>(
      ContractNames.FinanceMaster,
      networkName,
      "MasterFinance",
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
    const multisig = await deploy<Multisig__factory>(
      ContractNames.FinanceMasterMultisig,
      networkName,
      "Multisig",
      [
        [SharedDev, AndriiTest, DimaTest3C, DimaTest96, Igor, Lang, Rory, DimaTest2B],
        [true, true, true, true, true, true, true, false],
        100,
        masterMultisig,
      ],
      deployer
    );
    await deploy<MasterFinance__factory>(
      ContractNames.FinanceMaster,
      networkName,
      "MasterFinance",
      [multisig.address, bankCount, maxBankBalance],
      deployer
    );

    // other finances
    await deployFinance(
      ContractNames.FinanceRewards,
      [SharedDev, AndriiTest, DimaTest3C, DimaTest96, Igor, Lang, Rory, DimaTest2B],
      [true, true, true, true, true, true, true, false],
      100
    );
    await deployFinance(
      ContractNames.FinanceInvestors,
      [DimaTest96, AndriiTest, SharedDev, DimaTest3C, DimaTest2B, Igor, Lang, Rory],
      [true, true, true, false, false, true, true, true],
      75
    );
    await deployFinance(
      ContractNames.FinanceTeam,
      [DimaTest96, DimaTest3C, AndriiTest, SharedDev, Igor, Lang, Rory],
      [false, false, true, true, true, true, true],
      75
    );
    await deployFinance(
      ContractNames.FinanceEcosystem,
      [AndriiTest, DimaTest96, SharedDev, DimaTest2B, Igor, DimaTest, DimaTest3C, DimaTest08, Lang, Rory],
      [true, false, true, false, true, false, false, false, true, true],
      75
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
