import { Contract, ethers, Signer } from "ethers";

import { ContractNames } from "./names";

export class Contracts {
  private contracts: { [contractName: string]: Contract };
  private nameByAddress: { [address: string]: ContractNames };

  constructor(signer: Signer, chainId: number) {
    this.contracts = loadAllDeploymentsFromFile(chainId, signer);
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

  static getContract(chainId: number, contractName: ContractNames) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const deployments = require(`../../deployments/${chainId}.json`);
    return { address: deployments[contractName].address, abi: deployments[contractName].abi };
  }
}

export function loadAllDeploymentsFromFile(chainId: number, signer?: Signer) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const deployments = require(`../../deployments/${chainId}.json`);
  const result: any = {};

  for (const name of Object.keys(deployments)) {
    const deployment = deployments[name] as any;
    result[name] = new ethers.Contract(deployment.address, deployment.abi, signer);
  }
  return result;
}
