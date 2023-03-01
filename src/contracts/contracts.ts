import {Contract, Signer} from "ethers";
import {loadAllDeployments} from "../utils/deployments";


export class Contracts {

  private contracts: { [contractName: string]: Contract }
  private nameByAddress: { [address: string]: string }

  constructor(signer: Signer, chainId: number) {
    this.contracts = loadAllDeployments(chainId.toString(), signer)
    this.nameByAddress = {};

    for (let [name, contract] of Object.entries(this.contracts))
      this.nameByAddress[contract.address] = name;

  }

  public getContractByName(name: string): Contract {
    const contract = this.contracts[name];
    if (!contract) throw new Error(`Unknown contract name ${name}`)
    return contract
  }

  public getContractByAddress(address: string): Contract {
    const name = this.nameByAddress[address]
    if (!name) throw new Error(`Unknown contract address ${address}`)
    return this.getContractByName(name)
  }

}
