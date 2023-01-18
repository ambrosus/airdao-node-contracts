import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {

  networks: {
    "local": {
      url: "http://127.0.0.1:8545",
      accounts: [
        "0x80f702eb861f36fe8fbbe1a7ccceb04ef7ddef714604010501a5f67c8065d446",
        "0x5b18f0adcca221f65373b20158f95313ecd51bde42b96a4c16f5eb851576bc06"
      ],
      hardfork: "byzantium",
    },
  },


  solidity: {
    compilers: [
      {
        version: "0.8.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,  // todo bigger
          },
          // Note: for amb deploy
          evmVersion: "byzantium"
        },
      }, {
        version: "0.4.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          // Note: for amb deploy
          evmVersion: "byzantium"
        },
      },
    ],
  },
};

export default config;
