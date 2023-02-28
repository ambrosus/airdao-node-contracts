import {Contracts} from "../contracts/contracts";
import { Interface } from "ethers/lib/utils";
import {Multisig} from "../../typechain-types";
import {BigNumber} from "ethers";


// todo function that get transactions from all multisigs + get events and provide timestmap and other info

export async function getTransactions(contracts: Contracts, multisigName: ContractNames) {
  const multisigContract = contracts.getContractByName(multisigName) as Multisig;

  const txIds = await multisigContract.getTransactionIds(0, 0, true, false);
  const txPromises = txIds.map(txId => multisigContract.getTransactionData(txId))
  const txs = await Promise.all(txPromises)

  // todo find events for timestamp

  const parsedTxs = txs.map((tx, i) => {
    const [txData, confirmations] = tx;
    return {
      contractAddress: multisigContract.address,
      txId: txIds[i],
      parsedTxData: parseTxData(contracts, txData),
      confirmations
    }
  })

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
