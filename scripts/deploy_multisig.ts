import {ethers} from "hardhat";
import {deploy} from "../src/utils/deployments";
import {ContractNames} from "../src";
import {Andrii, DimaTestAcc, Igor, Lang, SharedDevAcc} from "./addresses";

async function main() {
  const MultisigMasterFactory = await ethers.getContractFactory("MasterMultisig");

  const networkName = (await ethers.provider.getNetwork()).chainId.toString();


  if (networkName == "16718") {
    console.log("--- MAINNET DEPLOYMENT ---")

    await deploy(ContractNames.MasterMultisig, networkName, MultisigMasterFactory,
      [
        [Lang, Igor, Andrii],
        [true, true, true], 51]
    );

  } else {
    await deploy(ContractNames.MasterMultisig, networkName, MultisigMasterFactory,
      [
        [SharedDevAcc, DimaTestAcc, Andrii],
        [true, true, true], 51]
    );
  }


}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
