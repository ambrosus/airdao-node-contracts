import {BaseContract, Signer} from "ethers";
import {loadAllDeployments} from "../utils/deployments";


export class Contracts {

  private contracts: {[contractName: string]: BaseContract}
  private nameByAddress: {[address: string]: string}

  constructor(signer: Signer, chainId: number) {
    this.contracts = loadAllDeployments(chainId.toString(), signer)
    this.nameByAddress = {};

    for (let [name, contract] of Object.entries(this.contracts))
      this.nameByAddress[contract.address] = name;

  }

  public getContractByName(name: string): BaseContract {
    return this.contracts[name];
  }

  public getContractByAddress(address: string): BaseContract {
    return this.getContractByName(this.nameByAddress[address])
  }

}

