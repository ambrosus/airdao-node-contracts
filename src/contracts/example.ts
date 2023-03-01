import {getTransactionsFromAllMultisigs} from "../multisig/confirmations";
import {ContractNames} from "./names";
import {getPermissions, setUserGroups} from "../multisig/permissions";
import {ethers} from "ethers";
import {Contracts} from "./contracts";
import {financeWithdraw} from "../multisig/methods";

async function example() {
  const signer = undefined as any;
  const chainId = 22040;

  // save this in global state
  const contracts = new Contracts(signer, chainId);

  // get all transactions (pending)
  const txs = await getTransactionsFromAllMultisigs(contracts)

  // use map like this to provide contract names
  const contractsNames = {
    [contracts.getContractByName(ContractNames.MasterMultisig).address]: "Permissions",
    [contracts.getContractByName(ContractNames.FinanceRewards).address]: "Finance: Rewards",
  }
  const nameToDisplay = contractsNames[txs[0].calledContractAddress]


  // get all permissions
  const {users, groups} = await getPermissions(contracts)


  // edit user permissions

  // example of editing perms
  const user = users[0];
  const oldUserGroups = [...user.groups] // copy of groups that come from contracts
  user.groups.pop()  // delete some group
  user.groups.push({address: "0x111", isInitiator: true}) // add some group
  const newUserGroups = user.groups  // new, edited groups

  await setUserGroups(contracts, user.address, newUserGroups, oldUserGroups)


  // example of finance withdraw method call
  await financeWithdraw(contracts, ContractNames.FinanceRewards, "0x000", ethers.utils.parseEther("69.420"))
}
