import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { ethers } from "hardhat";
import { Multisig__factory, Fees__factory } from "../typechain-types";
import { ContractNames } from "../src";
import { Roadmap2023MultisigSettings } from "./addresses";

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
  
  const gasPrice = 10;
  const payAddress = "0x407d73d8a49eeb85d32cf465507dd71d507100c1";
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
