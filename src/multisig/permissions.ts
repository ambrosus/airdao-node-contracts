import {MasterMultisig, Multisig} from "../../typechain-types";
import {Contracts} from "../contracts/contracts";
import {ContractNames, multisigsNames} from "../contracts/names";
import {submitTransaction} from "./methods";


interface Perm {
  // address is
  //  - user address for list of users in group modal
  //  - multisig (group) address for list of groups in user modal
  address: string,
  isInitiator: boolean
}

interface Group {
  multisig: string,
  users: Perm[],
  thresholdPercent: number,
  threshold: number,
}

interface User {
  address: string,
  groups: Perm[],
}

// VIEW

export async function getPermissions(contracts: Contracts, multisigAddresses?: string[]) {
  if (!multisigAddresses)
    multisigAddresses = multisigsNames.map(mn => contracts.getContractByName(mn).address)

  const masterMultisig = contracts.getContractByName(ContractNames.MasterMultisig) as MasterMultisig;
  const contractResults = await masterMultisig.getAllSigners(multisigAddresses)

  const groups = getGroups(multisigAddresses, contractResults);
  const users = getUsers(Object.values(groups));

  return {groups, users};
}


// more convenient interface for frontend
// oldGroups is list of user groups that come from contract and shows in modal BEFORE ANY UPDATES by admin
// newGroups is actual list of user groups that admin chooses in modal
export async function setUserGroups(contracts: Contracts, userAddress: string, newGroups: Perm[], oldGroups: Perm[]) {
  const newGroupAddresses = newGroups.map(g => g.address);

  const result: MasterMultisig.ChangeSignersStructStruct[] = [];

  for (let oldGroup of oldGroups) {
    // oldGroup not exists in newGroups, so remove user from it
    if (!newGroupAddresses.includes(oldGroup.address))
      result.push({contract_: oldGroup.address, isInitiatorFlags: [], signersToAdd: [], signersToRemove: [userAddress]})
  }

  for (let newGroup of newGroups) {
    // newGroup not exist in oldGroups or isInitiator value changed, so add user to group (with actual isInitiator)
    const needToAddOrChange = oldGroups.find(o => o.address == newGroup.address)?.isInitiator !== newGroup.isInitiator;
    if (needToAddOrChange)
      result.push({
        contract_: newGroup.address,
        isInitiatorFlags: [newGroup.isInitiator],
        signersToAdd: [userAddress],
        signersToRemove: []
      })
  }

  if (result.length == 0) throw new Error("Nothing changed");

  return await setPermissions(contracts, result);
}

// NON VIEW

export async function setPermissions(contracts: Contracts, changes: MasterMultisig.ChangeSignersStructStruct[]) {
  const masterMultisig = contracts.getContractByName(ContractNames.MasterMultisig) as MasterMultisig;
  const calldata = (await masterMultisig.populateTransaction.changeSignersMaster(changes)).data!
  return await submitTransaction(masterMultisig, masterMultisig.address, 0, calldata);
}

export async function setThreshold(contracts: Contracts, multisigToChange: ContractNames, newThreshold: number) {
  const masterMultisig = contracts.getContractByName(ContractNames.MasterMultisig) as MasterMultisig;
  const slaveMultisig = contracts.getContractByName(multisigToChange) as Multisig;

  const calldata = (await masterMultisig.populateTransaction.changeThreshold(newThreshold)).data!
  return await submitTransaction(masterMultisig, slaveMultisig.address, 0, calldata);
}


// INTERNAL

function getGroups(multisigAddresses: string[], contractResults: any[]): { [address: string]: Group } {
  const parseUsers = (signers: string[], isInitiators: boolean[]): Perm[] => signers.map((v, i) => ({
    address: signers[i],
    isInitiator: isInitiators[i]
  }));


  const groupList = contractResults.map((r, i) => ({
    multisig: multisigAddresses[i],
    users: parseUsers(r.signers, r.isInitiatorFlags),
    thresholdPercent: +r.threshold,
    threshold: Math.ceil(r.signers.length * +r.threshold / 100)
  }));

  const groups: { [address: string]: Group } = {};
  groupList.forEach(g => groups[g.multisig] = g);
  return groups;
}

function getUsers(groups: Group[]): { [address: string]: User } {
  const users: { [address: string]: User } = {};

  for (let group of groups) {
    for (let user of group.users) {

      if (users[user.address] == undefined)
        users[user.address] = {
          address: user.address,
          groups: []
        }

      users[user.address].groups.push({
        address: group.multisig,
        isInitiator: user.isInitiator
      });

    }
  }

  return users
}

