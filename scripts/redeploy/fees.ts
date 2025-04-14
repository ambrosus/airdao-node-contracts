import { ethers, upgrades } from "hardhat";
import { ContractNames } from "../../src";
import { loadDeployment, upgrade } from "@airdao/deployments/deploying";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();


  const FORCEIMPORT_PREV_DEPLOYMENT = false;
  if (FORCEIMPORT_PREV_DEPLOYMENT) {
    const prevDeployment = loadDeployment(ContractNames.Fees, chainId).address;
    const factory = await ethers.getContractFactory("Fees");
    await upgrades.forceImport(prevDeployment, factory);
  }
  else {

    await upgrade({
      contractName: ContractNames.Fees,
      networkId: chainId,
      signer: deployer,
      opts: {
        // unsafeAllowRenames: true,
      }
    });
  }

}


main()
