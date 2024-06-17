import {ethers, network} from "hardhat";
import {deploy, loadDeployment} from "@airdao/deployments/deploying";
import {ContractNames} from "../../src";
import {
  Alex,
  Alina,
  DimaTest96,
  Igor,
  Matthieu,
  Michael,
  Oleksii,
  OleksiiD,
  Seth,
  SharedDev,
  Sophie,
} from "../addresses";
import {Finance__factory, MasterFinance__factory, Multisig__factory} from "../../typechain-types";
import { MultisigVersions } from "../../src/contracts/names";

async function main() {
  let { chainId } = await ethers.provider.getNetwork();
  // if (process.env.MULTISIGS && process.env.MULTISIGS !== "v1") {
  //   chainId = (chainId.toString() + `_${process.env.MULTISIGS}`) as any;
  // }

  const [deployer] = await ethers.getSigners();

  const masterMultisig = loadDeployment(
    ContractNames.MasterMultisig +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    chainId
  ).address;

  async function deployFinance(
    financeName: ContractNames,
    signers: string[],
    isInitiator: boolean[],
    threshold: number
  ) {
    const multisigName = (financeName + "_Multisig") as ContractNames;
    console.assert(Object.values(ContractNames).includes(multisigName), `can't find ${multisigName} in ContractNames`);

    const multisig = await deploy<Multisig__factory>({
      contractName:
        multisigName +
        (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
      networkId: chainId,
      artifactName: "Multisig",
      signer: deployer,
      deployArgs: [signers, isInitiator, threshold, masterMultisig],
      loadIfAlreadyDeployed: true,
    });
    await deploy<Finance__factory>({
      contractName:
        financeName +
        (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
      networkId: chainId,
      artifactName: "Finance",
      signer: deployer,
      deployArgs: [multisig.address],
      loadIfAlreadyDeployed: true,
    });
  }

  const multisigSettings: [string[], boolean[], number] = network.name == "main" ?
    [[Michael, Igor, Alina, Alex, Matthieu, Oleksii, Seth, Sophie, OleksiiD], [true, true, true, true, true, true, true, true, true], 75] :
    [[SharedDev, DimaTest96], [true, true], 1];


  const maxBankBalance = ethers.utils.parseEther("100000000"); // 100 millions amb per bank
  const bankCount = 50;

  // finance master
  const multisig = await deploy<Multisig__factory>({
    contractName:
      ContractNames.FinanceMasterMultisig +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "Multisig",
    deployArgs: [...multisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });
  await deploy<MasterFinance__factory>({
    contractName:
      ContractNames.FinanceMaster +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "MasterFinance",
    deployArgs: [multisig.address, bankCount, maxBankBalance],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  // other finances
  await deployFinance(ContractNames.FinanceRewards, ...multisigSettings);
  await deployFinance(ContractNames.FinanceInvestors, ...multisigSettings);
  await deployFinance(ContractNames.FinanceTeam, ...multisigSettings);
  await deployFinance(ContractNames.FinanceEcosystem, ...multisigSettings);
  await deployFinance(ContractNames.FinanceRevenue, ...multisigSettings);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
