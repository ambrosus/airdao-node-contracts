import { ethers, network } from "hardhat";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { ContractNames } from "../../src";
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
  SharedDev,
} from "../addresses";
import { Finance__factory, MasterFinance__factory, Multisig__factory } from "../../typechain-types";

async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  async function deployFinance(
    financeName: ContractNames,
    signers: string[],
    isInitiator: boolean[],
    threshold: number
  ) {
    const multisigName = (financeName + "_Multisig") as ContractNames;
    console.assert(Object.values(ContractNames).includes(multisigName), `can't find ${multisigName} in ContractNames`);

    const multisig = await deploy<Multisig__factory>({
      contractName: multisigName,
      artifactName: "Multisig",
      signer: deployer,
      deployArgs: [signers, isInitiator, threshold, masterMultisig],
    });
    await deploy<Finance__factory>({
      contractName: financeName,
      artifactName: "Finance",
      signer: deployer,
      deployArgs: [multisig.address],
    });
  }

  if (network.name == "main") {
    console.log("--- MAINNET DEPLOYMENT ---");

    const maxBankBalance = ethers.utils.parseEther("100000000"); // 100 millions amb per bank
    const bankCount = 50;

    // finance master
    const multisig = await deploy<Multisig__factory>({
      contractName: ContractNames.FinanceMasterMultisig,
      artifactName: "Multisig",
      deployArgs: [[Lang, Igor, Rory, Kevin], [true, true, true, true], 75, masterMultisig],
      signer: deployer,
    });
    await deploy<MasterFinance__factory>({
      contractName: ContractNames.FinanceMaster,
      artifactName: "MasterFinance",
      deployArgs: [multisig.address, bankCount, maxBankBalance],
      signer: deployer,
    });

    // other finances
    await deployFinance(ContractNames.FinanceRewards, [Lang, Igor, Andrii], [true, true, false], 75);
    await deployFinance(ContractNames.FinanceInvestors, [Lang, Igor, Rory], [true, true, true], 75);
    await deployFinance(ContractNames.FinanceTeam, [Lang, Igor, Rory, Kevin], [true, true, true, true], 75);
    await deployFinance(ContractNames.FinanceEcosystem, [Lang, Igor, Kevin], [true, true, true], 75);
  } else {
    const maxBankBalance = ethers.utils.parseEther("100");
    const bankCount = 50;

    // finance master
    const multisig = await deploy<Multisig__factory>({
      contractName: ContractNames.FinanceMasterMultisig,
      artifactName: "Multisig",
      deployArgs: [
        [SharedDev, AndriiTest, DimaTest3C, DimaTest96, Igor, Lang, Rory, DimaTest2B],
        [true, true, true, true, true, true, true, false],
        100,
        masterMultisig,
      ],
      signer: deployer,
    });
    await deploy<MasterFinance__factory>({
      contractName: ContractNames.FinanceMaster,
      artifactName: "MasterFinance",
      deployArgs: [multisig.address, bankCount, maxBankBalance],
      signer: deployer,
    });

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

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
