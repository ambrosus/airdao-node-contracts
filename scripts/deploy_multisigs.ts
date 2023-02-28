import {ethers} from "hardhat";
import {deploy} from "../src/utils/deployments";

async function main() {

  const addresses = [
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
  ];

  const MultisigMasterFactory = await ethers.getContractFactory("MasterMultisig");
  const MultisigFactory = await ethers.getContractFactory("Multisig");

  const networkName = (await ethers.provider.getNetwork()).chainId.toString();

  const masterMultisig = await deploy("MasterMultisig", networkName,
    MultisigMasterFactory.deploy(["0x295C2707319ad4BecA6b5bb4086617fD6F240CfE", "0xc9E2CB16dEC44be85b8994D1EcDD4cA7a690c28b"], [true, true], 100)
  );

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
