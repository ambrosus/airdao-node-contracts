import { ethers } from "hardhat";
import { loadDeployment } from "../src/utils/deployments";
import { ContractNames } from "../src";
import { Andrii, AndriiTest, DimaTest, Igor, Kevin, Lang, Rory, Seth, SharedDev, Stefan } from "./addresses";
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
        [
          SharedDev,
          AndriiTest,
          "0x60bBa9ca40D4A5ef331b6065dC58a13c91a67B3C",
          "0x4fB246FAf8FAc198f8e5B524E74ABC6755956696",
          Igor,
          Lang,
          Rory,
          "0x8468D3B30A6308e3a1d4e3Ebf2B7C14E5e842C2B",
        ],
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
      [
        SharedDev,
        AndriiTest,
        "0x60bBa9ca40D4A5ef331b6065dC58a13c91a67B3C",
        "0x4fB246FAf8FAc198f8e5B524E74ABC6755956696",
        Igor,
        Lang,
        Rory,
        "0x8468D3B30A6308e3a1d4e3Ebf2B7C14E5e842C2B",
      ],
      [true, true, true, true, true, true, true, false],
      100
    );
    await deployFinance(
      ContractNames.FinanceInvestors,
      [
        "0x4fB246FAf8FAc198f8e5B524E74ABC6755956696",
        AndriiTest,
        SharedDev,
        "0x60bBa9ca40D4A5ef331b6065dC58a13c91a67B3C",
        "0x8468D3B30A6308e3a1d4e3Ebf2B7C14E5e842C2B",
        Igor,
        Lang,
        Rory,
      ],
      [true, true, true, false, false, true, true, true],
      75
    );
    await deployFinance(
      ContractNames.FinanceTeam,
      [
        "0x4fB246FAf8FAc198f8e5B524E74ABC6755956696",
        "0x60bBa9ca40D4A5ef331b6065dC58a13c91a67B3C",
        AndriiTest,
        SharedDev,
        Igor,
        Lang,
        Rory,
      ],
      [false, false, true, true, true, true, true],
      75
    );
    await deployFinance(
      ContractNames.FinanceEcosystem,
      [
        AndriiTest,
        "0x4fB246FAf8FAc198f8e5B524E74ABC6755956696",
        SharedDev,
        "0x8468D3B30A6308e3a1d4e3Ebf2B7C14E5e842C2B",
        Igor,
        DimaTest,
        "0x60bBa9ca40D4A5ef331b6065dC58a13c91a67B3C",
        "0xE6b7De299a3c76d8ee42Fd1B769b42Eec25baB08",
        Lang,
        Rory,
      ],
      [true, false, true, false, true, false, false, false, true, true],
      75
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
