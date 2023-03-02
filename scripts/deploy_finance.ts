import {ethers} from "hardhat";
import {deploy, loadDeployment} from "../src/utils/deployments";
import {ContractNames} from "../src/contracts/names";

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
    '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',
    '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
    '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
  ];

  // todo
  const Lang = addresses[0];
  const Igor = addresses[1];
  const Andrii = addresses[2];
  const Rory = addresses[3];
  const Kevin = addresses[4];
  const Stefan = addresses[5];
  const Seth = addresses[6];


  const MultisigFactory = await ethers.getContractFactory("Multisig");
  const MasterFinanceFactory = await ethers.getContractFactory("MasterFinance");
  const FinanceFactory = await ethers.getContractFactory("Finance");

  const networkName = (await ethers.provider.getNetwork()).chainId.toString();

  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, networkName).address


  async function deployFinance(financeName: ContractNames, signers: string[], isInitiator: boolean[], threshold: number) {
    const multisigName = financeName + "_Multisig" as ContractNames;
    console.assert(Object.values(ContractNames).includes(multisigName), `can't find ${multisigName} in ContractNames`)

    const multisig = await deploy(multisigName, networkName, MultisigFactory.deploy(signers, isInitiator, threshold, masterMultisig));
    await deploy(financeName, networkName, FinanceFactory.deploy(multisig.address));
  }

  // master
  const multisig = await deploy(ContractNames.FinanceMasterMultisig, networkName, MultisigFactory.deploy(
    [Lang, Igor, Rory, Kevin, Stefan], [true, true, true, true, true], 75, masterMultisig));
  await deploy(ContractNames.FinanceMaster, networkName, MasterFinanceFactory.deploy(multisig.address));

  await deployFinance(ContractNames.FinanceRewards,
    [Lang, Igor, Andrii], [true, true, false], 75);
  await deployFinance(ContractNames.FinanceInvestors,
    [Lang, Igor, Rory], [true, true, true], 75);
  await deployFinance(ContractNames.FinanceTeam,
    [Lang, Igor, Rory, Kevin, Stefan], [true, true, true, true, true], 75);
  await deployFinance(ContractNames.FinanceEcosystem,
    [Lang, Kevin, Seth], [true, true, false], 75);


}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
