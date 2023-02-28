import {MasterMultisig} from "../../typechain-types";


export async function getPermissions(masterMultisig: MasterMultisig, multisigAddresses: string[]) {
  const contractResults = await masterMultisig.getAllSigners(multisigAddresses)

  const groups = getGroups(multisigAddresses, contractResults);
  const users = getUsers(groups);

  return {groups, users};
}

export async function setPermissions(masterMultisig: MasterMultisig, changes: MasterMultisig.ChangeSignersStructStruct[]) {
  const calldata = (await masterMultisig.populateTransaction.changeSignersMaster(changes)).data!
  return await masterMultisig.submitTransaction(masterMultisig.address, 0, calldata)
}

export async function setThreshold(masterMultisig: MasterMultisig, multisigToChangeAddress: string, newThreshold: number) {
  const calldata = (await masterMultisig.populateTransaction.changeThreshold(newThreshold)).data!
  return await masterMultisig.submitTransaction(multisigToChangeAddress, 0, calldata)
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

