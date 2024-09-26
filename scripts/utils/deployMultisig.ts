import { Multisig__factory } from "../../typechain-types";
import { ContractNames } from "../../src";
import { EcosystemMultisigSettings, Roadmap2023MultisigSettings } from "./addresses";
import { Signer } from "ethers";
import { loadDeployment, deploy } from "@airdao/deployments/deploying";


export async function deployMultisig(contractName: string, signer: Signer, version: "common" | "eco" = "common") {

  const chainId = (await signer.provider!.getNetwork()).chainId;


  let deployArgs: any = [];

  if (version === "eco") {
    const ecosystemMasterMultisig = loadDeployment(ContractNames.Ecosystem_MasterMultisig, chainId).address;
    deployArgs = [...EcosystemMultisigSettings, ecosystemMasterMultisig];
  } else {
    const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;
    deployArgs = [...Roadmap2023MultisigSettings, masterMultisig];
  }

  const isMainnet = chainId === 16718;
  if (!isMainnet) deployArgs[2] = 1;  // threshold


  return await deploy<Multisig__factory>({
    artifactName: "Multisig",
    contractName, deployArgs, signer,
    loadIfAlreadyDeployed: true,
  });

}
