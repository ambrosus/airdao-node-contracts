import {ethers} from "hardhat";
import {deploy} from "../src/utils/deployments";
import {ContractNames} from "../src";

async function main() {
  const MultisigMasterFactory = await ethers.getContractFactory("MasterMultisig");

  const networkName = (await ethers.provider.getNetwork()).chainId.toString();

  const masterMultisig = await deploy(ContractNames.MasterMultisig, networkName, MultisigMasterFactory,
    [["0x295C2707319ad4BecA6b5bb4086617fD6F240CfE", "0xc9E2CB16dEC44be85b8994D1EcDD4cA7a690c28b"], [true, true], 100]
  );

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
