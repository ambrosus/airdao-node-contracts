import { Contract, ethers, Signer } from "ethers";

import { ContractNames, MultisigVersions } from "./names";

type Deployment = {
  address: string;
  abi: Array<string>;
  deployTx: string;
  fullyQualifiedName: string;
};

export class Contracts {
  private contracts: { [contractName: string]: Contract };
  private nameByAddress: { [address: string]: ContractNames };
  public multisigVersion: MultisigVersions;

  constructor(signer: Signer, chainId: number, multisigVersion: MultisigVersions = MultisigVersions.common) {
    this.multisigVersion = multisigVersion;
    this.contracts = loadAllDeploymentsFromFile(chainId, signer, this.multisigVersion);
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

  static getContract(chainId: number, contractName: ContractNames, multisigVersion: MultisigVersions = MultisigVersions.common) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const deployments = require(`../../deployments/${chainId}.json`);
    let contractNameVersioned = contractName as string;
    if (multisigVersion != MultisigVersions.common) contractNameVersioned += `_${multisigVersion}`;
    return { address: deployments[contractNameVersioned].address, abi: deployments[contractNameVersioned].abi };
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
  const filteredNames = Object
    .keys(deployments)
    .filter((name) =>
      multisigVersion != MultisigVersions.common
        ? name.includes(`_${multisigVersion}`)
        : Object
          .values(MultisigVersions)
          .every(version => !name.includes(`_${version}`))
    );
  for (const name of filteredNames){
    const deployment = deployments[name] as Deployment;
    const normalizedName = name.replace(`_${multisigVersion}`, '');
    result[normalizedName] = new ethers.Contract(deployment.address, deployment.abi, signer);
  }
  return result;
}
