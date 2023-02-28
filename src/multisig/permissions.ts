import {MasterMultisig, Multisig} from "../../typechain-types";
import {Contracts} from "../contracts/contracts";


export async function getPermissions(contracts: Contracts, multisigAddresses: string[]) {
  const masterMultisig = contracts.getContractByName(ContractNames.MasterMultisig) as MasterMultisig;
  const contractResults = await masterMultisig.getAllSigners(multisigAddresses)

  const groups = getGroups(multisigAddresses, contractResults);
  const users = getUsers(groups);

  return {groups, users};
}

// todo provide convenient interface for frontend
export async function setPermissions(contracts: Contracts, changes: MasterMultisig.ChangeSignersStructStruct[]) {
  const masterMultisig = contracts.getContractByName(ContractNames.MasterMultisig) as MasterMultisig;
  const calldata = (await masterMultisig.populateTransaction.changeSignersMaster(changes)).data!
  return await masterMultisig.submitTransaction(masterMultisig.address, 0, calldata)
}

export async function setThreshold(contracts: Contracts, multisigToChange: ContractNames, newThreshold: number) {
  const masterMultisig = contracts.getContractByName(ContractNames.MasterMultisig) as MasterMultisig;
  const slaveMultisig = contracts.getContractByName(multisigToChange) as Multisig;

  const calldata = (await masterMultisig.populateTransaction.changeThreshold(newThreshold)).data!
  return await masterMultisig.submitTransaction(slaveMultisig.address, 0, calldata)
}



function getGroups(multisigAddresses: string[], contractResults: any[]) {
  const parseUsers = (signers: string[], isInitiators: boolean[]) =>  signers.map((v, i) => ({
    address: signers[i],
    isInitiator: isInitiators[i]
  }));

  return contractResults.map((r, i) => ({
    multisig: multisigAddresses[i],
    users: parseUsers(r.signers, r.isInitiatorFlags),
    thresholdPercent: +r.threshold,
    threshold: Math.floor(r.signers.length * +r.threshold / 100)
  }));

}

function getUsers(groups: any[]) {
  const users: { [address: string]: any } = {};

  for (let group of groups) {
    for (let user of group.users) {

      if (users[user.address] == undefined)
        users[user.address] = {address: user.address, groups: []}

      users[user.address].groups.push({group: group.multisig, isInitiator: user.isInitiator});

    }
  }

  return Object.values(users)
}

