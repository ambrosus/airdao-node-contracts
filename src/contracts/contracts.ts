import {Contract, Signer} from "ethers";
import {loadAllDeployments} from "../utils/deployments";


export class Contracts {

  private contracts: {[contractName: string]: Contract}
  private nameByAddress: {[address: string]: string}

  constructor(signer: Signer, chainId: number) {
    this.contracts = loadAllDeployments(chainId.toString(), signer)
    this.nameByAddress = {};

    for (let [name, contract] of Object.entries(this.contracts))
      this.nameByAddress[contract.address] = name;

  }

  public getContractByName(name: string): Contract {
    return this.contracts[name];
  }

  public getContractByAddress(address: string): Contract {
    return this.getContractByName(this.nameByAddress[address])
  }

}
//
// const contracts = new Contracts();
//
// const contractsNames = {
//   [contracts.getContractByName(ContractNames.MasterMultisig).address]: "Permissions",
//   [contracts.getContractByName(ContractNames.FinanceRewardsMultisig).address]: "Finance: Rewards",
// }
//
// // вкладка Rewards Wallet
// const contractAddress = contracts.getContractByName("Finance_Rewards").address
