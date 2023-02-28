import {ethers} from "hardhat";
import {deploy, loadDeployment} from "../src/utils/deployments";
import {ContractNames} from "../src/contracts/names";

async function main() {


  // todo
  const Lang = "";
  const Igor = "";
  const Andrii = "";
  const Rory = "";
  const Kevin = "";
  const Stefan = "";
  const Seth = "";



  const MultisigFactory = await ethers.getContractFactory("Multisig");
  const MasterFinanceFactory = await ethers.getContractFactory("MasterFinance");
  const FinanceFactory = await ethers.getContractFactory("Finance");

  const networkName = (await ethers.provider.getNetwork()).chainId.toString();

  const masterMultisig = loadDeployment(networkName, ContractNames.MasterMultisig).address


  async function deployFinance(financeName: ContractNames, signers: string[], isInitiator: boolean[], threshold: number) {
    const multisigName = financeName + "_Multisig" as ContractNames;
    console.assert(Object.values(ContractNames).includes(multisigName), `can't find ${multisigName} in ContractNames`)

    const multisig = await deploy(multisigName, networkName, MultisigFactory.deploy(signers, isInitiator, threshold, masterMultisig));
    await deploy(financeName, networkName, MasterFinanceFactory.deploy(multisig.address));
  }

  // master
  const multisig = await deploy(ContractNames.FinanceMasterMultisig, networkName, MultisigFactory.deploy(
    [Lang, Igor, Rory, Kevin, Stefan], [true, true, true, true, true], 75, masterMultisig));
  await deploy(ContractNames.FinanceMaster, networkName, FinanceFactory.deploy(multisig.address));

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
