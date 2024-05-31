import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { sourcifyOne, loadAllDeployments } from "@airdao/deployments/deploying";
import { HardhatRuntimeEnvironment } from "hardhat/types";

dotenv.config();

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      forking: {
        url: "https://network.ambrosus.io",
      },
    },
    local: {
      url: "http://127.0.0.1:8545",
      accounts: [
        "0x80f702eb861f36fe8fbbe1a7ccceb04ef7ddef714604010501a5f67c8065d446",
        "0x78a689fa56a36ac3a82aaa7b7b4bfefde66e57bd589bc08c14ae49d1b9c96026",
        "0x5b18f0adcca221f65373b20158f95313ecd51bde42b96a4c16f5eb851576bc06",
      ],
      hardfork: "byzantium",
    },
    dev: {
      url: "https://network.ambrosus-dev.io",
      hardfork: "byzantium",
      gasPrice: 0,
      accounts: [
        process.env.PRIVATEKEY_OWNER_AMB || ethers.constants.HashZero,
        // process.env.PRIVATEKEY_TEST_MULTISIG1 || ethers.constants.HashZero,
        // process.env.PRIVATEKEY_TEST_MULTISIG2 || ethers.constants.HashZero,
      ],
    },
    test: {
      url: "https://network.ambrosus-test.io",
      hardfork: "byzantium",
      gasPrice: 0,
      accounts: [
        process.env.PRIVATEKEY_OWNER_AMB || ethers.constants.HashZero,
        process.env.PRIVATEKEY_TEST_MULTISIG1 || ethers.constants.HashZero,
        process.env.PRIVATEKEY_TEST_MULTISIG2 || ethers.constants.HashZero,
      ],
    },
    main: {
      url: "https://network.ambrosus.io",
      hardfork: "byzantium",
      gasPrice: 0,
      accounts: [process.env.PRIVATEKEY_OWNER_AMB_PROD || ethers.constants.HashZero],
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
      {
        version: "0.4.24",
      },
    ],
  },
};

task("sourcify", "verify contracts using sourcify").setAction(async (args: any, hre: HardhatRuntimeEnvironment) => {
  await hre.run("compile"); // compile contract first
  // @ts-ignore
  let { chainId } = await hre.ethers.provider.getNetwork();
  if (process.env.MULTISIGS && process.env.MULTISIGS !== "v1") {
    chainId = (chainId.toString() + `_${process.env.MULTISIGS}`) as any;
  }
  const deployments = require(`./deployments/${chainId}.json`) as Record<string, any>;

  for (const [contractName, deployment] of Object.entries(deployments))
    if (deployment.proxy) {
      await sourcifyOne(hre, deployment.proxy.fullyQualifiedName, deployment.address, chainId, contractName + " Proxy");
      await sourcifyOne(hre, deployment.fullyQualifiedName, deployment.proxy.implementation, chainId, contractName);
    } else {
      await sourcifyOne(hre, deployment.fullyQualifiedName, deployment.address, chainId, contractName);
    }
});

export default config;
