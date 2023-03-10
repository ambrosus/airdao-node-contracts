import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { sourcifyAll } from "./src/dev/sourcify";
import { HardhatRuntimeEnvironment } from "hardhat/types";

dotenv.config();

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
    test: {
      url: "https://network.ambrosus-test.io",
      hardfork: "byzantium",
      accounts: [process.env.PRIVATEKEY_OWNER_AMB || ethers.constants.HashZero],
    },
    main: {
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
            runs: 5000,
          },
          // Note: for amb deploy
          evmVersion: process.env.COVERAGE ? undefined : "byzantium", // coverage don't work with byzantium
        },
      },
    ],
  },
};

task("sourcify", "verify contracts using sourcify").setAction(async (args: any, hre: HardhatRuntimeEnvironment) => {
  await hre.run("compile"); // compile contract first
  await sourcifyAll(hre);
});

export default config;
