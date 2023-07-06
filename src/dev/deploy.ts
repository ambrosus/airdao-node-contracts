import { ContractFactory, Signer } from "ethers";
import fs from "fs";
import { _contractFromDeployment, _loadDeployments, Deployment } from "../utils/deployments";
import { GetARGsTypeFromFactory, GetContractTypeFromFactory } from "../../typechain-types/common";
import { artifacts, ethers, upgrades } from "hardhat";
import { ContractNames } from "../contracts/names";
import path from "path";
import { getFullyQualifiedName } from "hardhat/utils/contract-names";

// this file use method from hardhat, so
// don't include it into SDK build

// returns initialize method arguments type if contract has initialize method
// otherwise returns constructor arguments type
type Initializable = { initialize(...a: any[]): Promise<any> };
type GetDeployArgsType<T> = GetContractTypeFromFactory<T> extends Initializable
  ? Parameters<GetContractTypeFromFactory<T>["initialize"]>
  : GetARGsTypeFromFactory<T>;

/**
 * @param contractName - The name under which to save the contract. Must be unique.
 * @param networkId - Network chain id used as filename in deployments folder.
 * @param artifactName - Name of the contract artifact. For example, ERC20.
 * @param deployArgs - Deploy arguments
 * @param signer - Signer, that will deploy contract (or with witch contract will be loaded from deployment)
 * @param loadIfAlreadyDeployed - Load contract if it already deployed; Otherwise throw exception
 * @param upgradeableProxy - Deploy contract as upgradeable proxy
 * @returns Deployed contract or contract loaded from deployments
 */
export async function deploy<N extends ContractFactory>(
  contractName: ContractNames,
  networkId: number,
  artifactName: string,
  deployArgs: GetDeployArgsType<N>,
  signer: Signer,
  loadIfAlreadyDeployed = false,
  upgradeableProxy = false
): Promise<GetContractTypeFromFactory<N>> {
  const deployments = _loadDeployments(networkId);

  if (deployments[contractName]) {
    if (loadIfAlreadyDeployed) {
      console.log(`Already deployed ${contractName}`);
      return _contractFromDeployment(deployments[contractName], signer) as GetContractTypeFromFactory<N>;
    }
    throw new Error(`Already deployed ${contractName}`);
  }

  const factory = await ethers.getContractFactory(artifactName);
  const artifact = await artifacts.readArtifact(artifactName);
  const fullyQualifiedName = getFullyQualifiedName(artifact.sourceName, artifact.contractName);

  console.log(`deploying ${contractName} in network ${networkId}...`);

  const contract = upgradeableProxy
    ? await upgrades.deployProxy(factory, deployArgs)
    : await factory.deploy(...deployArgs);

  await contract.deployed();

  const deployment: Deployment = {
    address: contract.address,
    abi: contract.interface.format() as string[],
    deployTx: contract.deployTransaction.hash,
    fullyQualifiedName: fullyQualifiedName,
  };

  if (upgradeableProxy) {
    const implAddr = await upgrades.erc1967.getImplementationAddress(contract.address);
    console.log(`deployed ${contractName} at`, contract.address, "implementation at", implAddr);

    deployment.proxy = {
      implementation: implAddr,
      fullyQualifiedName:
        "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
    };
  } else {
    console.log(`deployed ${contractName} at`, contract.address);
  }

  deployments[contractName] = deployment;

  const deploymentPath = path.resolve(__dirname, `../../deployments/${networkId}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deployments, null, 2));

  return contract.connect(signer) as GetContractTypeFromFactory<N>;
}
