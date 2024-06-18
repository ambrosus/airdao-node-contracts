import { Contract, ethers, Signer } from "ethers";

import { ContractNames, MultisigVersions } from "./names";

type Deployment = {
  address: string;
  abi: Array<string>;
  deployTx: string;
  fullyQualifiedName: string;
};

function allowedMultisigNames(multisigVersion: MultisigVersions) {
  let allowedNames: ContractNames[] = [];
  switch (multisigVersion) {
    case MultisigVersions.ecosystem:
      allowedNames = Object.values(ContractNames).filter((name) => name.startsWith("Ecosystem_"));
      break;
    case MultisigVersions.common:
      allowedNames = Object.values(ContractNames).filter((name) => !name.startsWith("Ecosystem_"));
      break;
    default:
      allowedNames = Object.values(ContractNames).filter((name) => !name.startsWith("Ecosystem_"));
      break;
  }
  return allowedNames;
}

export class Contracts {
  private contracts: { [contractName: string]: Contract };
  private nameByAddress: { [address: string]: ContractNames };
  public multisigVersion: MultisigVersions;
  public masterMultisig: Contract;

  constructor(signer: Signer, chainId: number, multisigVersion: MultisigVersions = MultisigVersions.common) {
    this.multisigVersion = multisigVersion;
    this.contracts = loadAllDeploymentsFromFile(chainId, signer, this.multisigVersion);
    switch (this.multisigVersion) {
      case MultisigVersions.ecosystem:
        this.masterMultisig = this.contracts[ContractNames.Ecosystem_MasterMultisig];
        break;
      case MultisigVersions.common:
        this.masterMultisig = this.contracts[ContractNames.MasterMultisig];
        break;
      default:
        this.masterMultisig = this.contracts[ContractNames.MasterMultisig];
        break;
    }
    this.nameByAddress = {};
    for (const [name, contract] of Object.entries(this.contracts))
      this.nameByAddress[contract.address] = name as ContractNames;
  }

  public getContractByName(name: ContractNames): Contract {
    const contract = this.contracts[name];
    if (!contract) throw new Error(`Unknown contract name ${name}`);
    return contract;
  }

  public getContractByNameSafe(name: ContractNames): Contract | undefined {
    return this.contracts[name];
  }

  public getContractByAddress(address: string): Contract {
    const name = this.getNameByAddress(address);
    return this.getContractByName(name);
  }

  public getContractByAddressSafe(address: string): Contract | undefined {
    const name = this.getNameByAddress(address);
    return this.getContractByNameSafe(name);
  }

  public getNameByAddress(address: string): ContractNames {
    const name = this.nameByAddress[address];
    if (!name) throw new Error(`Unknown contract address ${address}`);
    return name;
  }

  public getNameByAddressSafe(address: string): ContractNames | undefined {
    return this.nameByAddress[address];
  }

  static getContract(
    chainId: number,
    contractName: ContractNames,
    multisigVersion: MultisigVersions = MultisigVersions.common
  ) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const deployments = require(`../../deployments/${chainId}.json`);
    const versionNames = allowedMultisigNames(multisigVersion);
    if (!versionNames.includes(contractName)) return undefined;
    return { address: deployments[contractName].address, abi: deployments[contractName].abi };
  }
}

export function loadAllDeploymentsFromFile(
  chainId: number,
  signer?: Signer,
  multisigVersion: MultisigVersions = MultisigVersions.common
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const deployments = require(`../../deployments/${chainId}.json`);
  const result: any = {};
  const allowedNames = allowedMultisigNames(multisigVersion);
  const filteredNames = Object.keys(deployments).filter((name) => allowedNames.includes(name as ContractNames));
  for (const name of filteredNames) {
    const deployment = deployments[name] as Deployment;
    result[name] = new ethers.Contract(deployment.address, deployment.abi, signer);
  }
  return result;
}
