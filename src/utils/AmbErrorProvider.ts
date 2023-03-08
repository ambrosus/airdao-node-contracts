import { BigNumber, ethers } from "ethers";

export class AmbErrorProviderWeb3 extends ethers.providers.Web3Provider {
  // Populates "from" if unspecified, and estimates the gas for the transaction
  async estimateGas(transaction: any): Promise<BigNumber> {
    try {
      return await super.estimateGas(transaction);
    } catch (e) {
      await this.call(transaction); // make callStatic request to get error text
      throw e; // shouldn't get here because callStatic should throw amb error
    }
  }

  // Populates "from" if unspecified, and calls with the transaction
  async call(transaction: any, blockTag?: any): Promise<string> {
    try {
      return await super.call(transaction, blockTag);
    } catch (e) {
      throw parseError(e);
    }
  }
}

export class AmbErrorProvider extends ethers.providers.JsonRpcProvider {
  // Populates "from" if unspecified, and estimates the gas for the transaction
  async estimateGas(transaction: any): Promise<BigNumber> {
    try {
      return await super.estimateGas(transaction);
    } catch (e) {
      await this.call(transaction); // make callStatic request to get error text
      throw e; // shouldn't get here because callStatic should throw amb error
    }
  }

  // Populates "from" if unspecified, and calls with the transaction
  async call(transaction: any, blockTag?: any): Promise<string> {
    try {
      return await super.call(transaction, blockTag);
    } catch (e) {
      throw parseError(e);
    }
  }
}

function parseError(error: any): any {
  let ambError;
  try {
    ambError = _parseError(error);
  } catch (e) {
    console.warn("Error while parsing error", e);
    throw error;
  }
  throw ambError;
}

function _parseError(error: any): any {
  if (error.code === "CALL_EXCEPTION") error = error.error;
  if (error.code === "SERVER_ERROR") error = error.error;
  if (error.code === -32603) error = error.data;

  if (error.code !== -32015) throw "Not -32015 code";
  if (!error.data.startsWith("Reverted 0x")) throw "Not starts with Reverted 0x";

  let reason = error.data.substring(9);
  // https://github.com/authereum/eth-revert-reason/blob/e33f4df82426a177dbd69c0f97ff53153592809b/index.js#L93
  // "0x08c379a0" is `Error(string)` method signature, it's called by revert/require
  if (reason.length < 138 || !reason.startsWith("0x08c379a0")) throw "Not error signature";

  reason = ethers.utils.hexDataSlice(reason, 4);
  reason = ethers.utils.defaultAbiCoder.decode(["string"], reason);
  return new Error(reason);
}
