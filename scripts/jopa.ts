import {upgrade} from "@airdao/deployments/deploying";
import {ethers} from "hardhat";
import {ContractNames} from "../src";

async function main() {
  const {chainId} = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  await upgrade({
    contractName: ContractNames.LiquidNodesManager,
    artifactName: "LiquidNodesManager",
    networkId: chainId,
    signer: deployer,
    opts: {
      unsafeSkipStorageCheck: true,
      call: "_fix",
    }
  });


}

main();