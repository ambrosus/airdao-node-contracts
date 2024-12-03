import { ContractNames } from "../../src";
import { EcosystemMultisigSettings, Roadmap2023MultisigSettings } from "./addresses";
import { Signer } from "ethers";
import { loadDeployment, getMultisigFactory, MultisigSettings } from "@airdao/deployments/deploying";

export async function deployMultisig(contractName: string, signer: Signer, version: "common" | "eco" = "common") {

  const chainId = (await signer.provider!.getNetwork()).chainId;

  const settings: MultisigSettings = {
    owner: "",
    signers: [],
    isInitiatorFlags: [],
    threshold: 0,
  };

  if (version === "eco") {
    const ecosystemMasterMultisig = loadDeployment(ContractNames.Ecosystem_MasterMultisig, chainId).address;
    settings.owner = ecosystemMasterMultisig;
    settings.signers = EcosystemMultisigSettings[0];
    settings.isInitiatorFlags = EcosystemMultisigSettings[1];
    settings.threshold = EcosystemMultisigSettings[2];
  } else {
    const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;
    settings.owner = masterMultisig;
    settings.signers = Roadmap2023MultisigSettings[0];
    settings.isInitiatorFlags = Roadmap2023MultisigSettings[1];
    settings.threshold = Roadmap2023MultisigSettings[2];
  }

  const factory = getMultisigFactory(chainId);

  const isMainnet = chainId === 16718;
  if (!isMainnet) settings.threshold = 1;// threshold

}
