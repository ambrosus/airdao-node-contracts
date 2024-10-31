import { ethers } from "hardhat";
import { ContractNames } from "../../../src";
import { upgrade } from "@airdao/deployments/deploying";
import hre from "hardhat";

async function main() {
  const {chainId} = await ethers.provider.getNetwork();
  console.log("Chain ID: ", chainId);
  const [deployer] = await ethers.getSigners();

  const multisigAddr = "0x623f45fBCFa5f3B5eD518C7Ef753307dc438EF2C";

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [multisigAddr],
  });

  await hre.network.provider.request({
    method: "hardhat_setBalance",
    params: [multisigAddr, "0x56bc75e2d63100000"],
  });

  const multisigSigner = await ethers.provider.getSigner(multisigAddr);


  await upgrade({
    contractName: ContractNames.Ecosystem_LiquidPool,
    networkId: chainId,
    signer: multisigSigner,
  });

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

