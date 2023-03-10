import { HardhatUserConfig, task, types } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { sourcify } from "./src/dev/sourcify";
import { HardhatRuntimeEnvironment } from "hardhat/types";

dotenv.config();

const SOURCIFY_ENDPOINT = "https://sourcify.ambrosus.io/";

const config: HardhatUserConfig = {
  networks: {
    local: {
      url: "http://127.0.0.1:8545",
      accounts: [
        "0x80f702eb861f36fe8fbbe1a7ccceb04ef7ddef714604010501a5f67c8065d446",
        "0x5b18f0adcca221f65373b20158f95313ecd51bde42b96a4c16f5eb851576bc06",
      ],
      hardfork: "byzantium",
    },
    "test/amb": {
      url: "https://network.ambrosus-test.io",
      hardfork: "byzantium",
      accounts: [process.env.PRIVATEKEY_OWNER_AMB || ethers.constants.HashZero],
    },
    "main/amb": {
      url: "https://network.ambrosus.io",
      hardfork: "byzantium",
      accounts: [process.env.PRIVATEKEY_OWNER_AMB || ethers.constants.HashZero],
    },
  },

  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000, // todo bigger
          },
          // Note: for amb deploy
          evmVersion: process.env.COVERAGE ? undefined : "byzantium", // coverage don't work with byzantium
        },
      },
    ],
  },
};

// todo less args
// todo add task that verify all contracts
// hardhat sourcify --source "contracts/finance/Finance.sol" --name "Finance" --address 0x5e67aa0723a8263d60285172f687d73cc4db7413 --chainid 22040
task("sourcify", "verify contract using sourcify")
  .addParam("source", "e.g contract/Greeter.sol", undefined, types.string)
  .addParam("name", "Name of the contract you want to verify", undefined, types.string)
  .addParam("address", "address of the contract", undefined, types.string)
  .addParam("chainid", "the chainId of the network that your contract deployed on", undefined, types.string)
  .setAction(async (args: any, hre: HardhatRuntimeEnvironment) => {
    await hre.run("compile"); // compile contract first

    await sourcify(hre, {
      endpoint: SOURCIFY_ENDPOINT,
      sourceName: args.source,
      contractName: args.name,
      address: args.address,
      chainId: args.chainid,
    });
  });

export default config;
