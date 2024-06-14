## RPC

AirDAO network RPC is Ethereum compatible and supports all Ethereum JSON-RPC methods. You can use it without authentication.  

> [!NOTE]
> If you want to query older blocks you need to use **archive** node.

> [!WARNING]
> There is limit on how much logs you can query in one request. If you need to query more logs you need to use pagination.

- **Mainnet** (chainID: 16718)
  - https://network.ambrosus.io/
  - https://network-archive.ambrosus.io/ - archive, slower
- **Testnet** (chainID: 22040)
  - https://network.ambrosus-test.io/
  - https://network-archive.ambrosus-test.io/  - archive, slower
- **Devnet** (chainID: 30746)
  - https://network.ambrosus-dev.io/
  - https://network-archive.ambrosus-dev.io/  - archive, slower

Or you can use your own node.




### Launching Your Own Node
AirDAO use an [OpenEthereum fork](https://github.com/ambrosus/openethereum) as node software. 

#### Launch Validator Node
A validator node will produce blocks and earn AMB rewards!

To launch a validator node, you will need:
- **At least 400,000 AMB** for node stake.
- **A server** to host the node (a typical DigitalOcean node with 2 GB RAM, 2 CPUs, 60 GB SSD disk, and 3 TB transfer should work good).

You can find the node launching page on our explorer: [Node Setup](https://airdao.io/explorer/node-setup/).

Follow the instruction at launching page, you will be asked to stake some amber and install node software using our [Node Operating Package (NOP)](https://github.com/ambrosus/airdao-nop)

#### Launch Non-Validator Node
If you need super fast RPC, you can setup your own node for this.
Follow one of this guides:
- [Launch node from docker image](https://github.com/ambrosus/openethereum/blob/main/docs/AirDAO_OpenEthereum_Setup_Guide.md)
- [Compile node from sources](https://github.com/ambrosus/openethereum/blob/main/docs/AirDAO_OpenEthereum_binary_setup_guide.md)




## EIPs and EVM version

AirDAO network is based on Ethereum network and currently supports **EVM version** up to **Constantinople** / **Petersburg** in the mainnet and testnet.

> [!CAUTION]
> Istanbul and higher EVM versions are not supported.

That means that newer opcodes like `CHAINID` (`block.chainid`) or `BASEFEE` (`block.basefee`) will not work.

If you encounter any issues with the network, please check the EVM version and make sure that you are using the correct EVM version.

You can find more information about EVM versions in the following link:
https://docs.blockscout.com/for-developers/information-and-settings/evm-version-information


More information about supported EIPS you can find in the networks chainspecs:
-  **Mainnet** https://chainspec.ambrosus.io/
-  **Testnet** https://chainspec.ambrosus-test.io/
-  **Devnet** https://chainspec.ambrosus-dev.io/






## Explorer
- **Mainnet** https://airdao.io/explorer
- **Testnet** https://testnet.airdao.io/explorer
- **Devnet** https://devnet.airdao.io/explorer

### Contracts verification
AirDAO Explorer supports contracts verification.  
Verified contract will have it source code and ABI displayed on the contract page and possibility to call contract methods directly from the explorer.

If you want to verify your contract, visit the contract page and click on the `Verify` button. 
You will be asked to provide the contract artifact file.  
(example location for hardhat project: `/artifacts/build-info/123abc456def789abc123def123abc45.json`).


You can also use out sourcify API: https://sourcify.ambrosus.io




## Faucet:
You can get free AMB here:
-  **Testnet** https://faucet.ambrosus-test.io/
-  **Devnet** https://faucet.ambrosus-dev.io/




## Troubleshooting


### Reverted transaction with no reason

> [!IMPORTANT]  
> Currently our RPC doesn't return the revert reason for `estimateGas` method. We are working on it.

For now, you can use the following workaround:
- Use static call (`eth_call`) method with the same parameters as the transaction you want to send.
```javascript
// example using ethers.js
await yourContract.callStatic.yourMethodName(arg1, arg2, {from: sender, gasLimit: 0x1337, blockTag: 'latest'})
```
- You probably will get the revert reason but in hex format, like `Reverted 0x08c379a0123abc123abc123abc`
- You can decode it using online hex to string converter or use this code snippet: https://github.com/authereum/eth-revert-reason/blob/e33f4df82426a177dbd69c0f97ff53153592809b/index.js#L93



If this not help, check EIPs article above.



