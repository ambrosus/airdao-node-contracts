import {Contracts} from "../contracts/contracts";
import {Interface} from "ethers/lib/utils";
import {Multisig} from "../../typechain-types";
import {BigNumber} from "ethers";
import {ContractNames, multisigsNames} from "../contracts/names";


export async function getTransactionsFromAllMultisigs(contracts: Contracts) {

  // todo get events and provide timestmap and other info
  // const masterMultisig = contracts.getContractByName(ContractNames.MasterMultisig) as Contract;
  // const filter = masterMultisig.filters.Submission()

  // note: its possible to filter events from array of addresses, but in hacky way;
  // will wait for ethers v6 for this feature; for now imho timestamp are not so important

  const multisigTransactions = await Promise.all(multisigsNames.map((mn) => getTransactions(contracts, mn)));
  return multisigTransactions.flat();
}


export async function getTransactions(contracts: Contracts, multisigName: ContractNames) {
  const multisigContract = contracts.getContractByName(multisigName) as Multisig;

  const txIds = await multisigContract.getTransactionIds(0, 0, true, false);
  const txPromises = txIds.map(txId => multisigContract.getTransactionData(txId))
  const txs = await Promise.all(txPromises)

  const parsedTxs = txs.map((tx, i) => {
    const [txData, confirmations] = tx;
    const destinationContract = contracts.getContractByAddress(txData.destination);
    return {
      multisigAddress: multisigContract.address,
      calledContractAddress: txData.destination,
      txId: txIds[i],
      parsedCalldata: parseCalldata(destinationContract.interface, txData.data),
      executed: txData.executed,
      value: txData.value,
      confirmations
    }
  })

  return parsedTxs;

}


export async function confirm(multisig: Multisig, txId: BigNumber) {
  await multisig.confirmTransaction(txId);
}

export async function revokeConfirm(multisig: Multisig, txId: BigNumber) {
  await multisig.revokeConfirmation(txId);
}

export async function reExecute(multisig: Multisig, txId: BigNumber) {
  await multisig.executeTransaction(txId);
}


// internal


function parseTxData(contracts: Contracts, txData: any) {
  const destinationContract = contracts.getContractByAddress(txData.destination);
  const parsedCalldata = parseCalldata(destinationContract.interface, txData.data);
  return {
    contractAddress: destinationContract.address,
    parsedCalldata: parsedCalldata
  }
}


function parseCalldata(iface: Interface, calldata: any) {
  function parse(calldata_: any): any {
    try {
      const calledMethod = iface.getFunction(calldata_.substring(0, 10));
      const calledArgs = iface.decodeFunctionData(calledMethod.name, calldata_);

      return {
        calldata: calldata_,
        name: calledMethod.name,
        inputs: calledMethod.inputs.map((input, i) => ({
          name: input.name,
          type: input.type,
          value: calledArgs[i],
          methodCall: parse(calledArgs[i])
        }))
      }
    } catch (e) {
      return undefined;
    }
  }

  return parse(calldata);
}
