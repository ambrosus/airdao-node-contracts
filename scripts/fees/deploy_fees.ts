import {deploy, loadDeployment} from "@airdao/deployments/deploying";
import {ethers} from "hardhat";
import {Fees__factory, Finance__factory, Multisig__factory} from "../../typechain-types";
import {ContractNames} from "../../src";
import {Roadmap2023MultisigSettings} from "../addresses";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.FeesMultisig,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const treasure = await deploy<Finance__factory>({
    contractName: ContractNames.FeesTreasure,
    artifactName: "Finance",
    deployArgs: [multisig.address],
    signer: deployer,
  });

  const gasPrice = 10;
  const payAddress = treasure.address;
  const feePercent = 300000;

  const fees = await deploy<Fees__factory>({
    contractName: ContractNames.Fees,
    artifactName: "Fees",
    deployArgs: [gasPrice, payAddress, feePercent],
    signer: deployer,
    isUpgradeableProxy: true,
  });

  await (await fees.grantRole(await fees.FEES_MANAGER_ROLE(), multisig.address)).wait();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
