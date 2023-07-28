import { Contract, Signer } from "ethers";

import { ContractNames } from "./names";
import { loadAllDeploymentsFromFile } from "@airdao/deployments";

export class Contracts {
  private contracts: { [contractName: string]: Contract };
  private nameByAddress: { [address: string]: ContractNames };

  constructor(signer: Signer, chainId: number) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const deploymentFile = require(`../../../deployments/${chainId}.json`);
    this.contracts = loadAllDeploymentsFromFile(deploymentFile, signer);
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
}
