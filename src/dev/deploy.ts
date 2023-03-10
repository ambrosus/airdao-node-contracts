import { ContractFactory, Signer } from "ethers";
import fs from "fs";
import { _contractFromDeployment, _loadDeployments } from "../utils/deployments";
import { GetARGsTypeFromFactory, GetContractTypeFromFactory } from "../../typechain-types/common";
import { ethers } from "hardhat";
import { ContractNames } from "../contracts/names";

// this file use method from hardhat, so
// don't include it into SDK build
// todo ignore file
// todo update deploy files

/**
 * @param contractName - The name under which to save the contract. Must be unique.
 * @param networkName - Network name used as filename in deployments folder.
 * @param artifactName - Name of the contract artifact. For example, ERC20.
 * @param deployArgs - Deploy arguments
 * @param signer - Signer, that will deploy contract (or with witch contract will be loaded from deployment)
 * @param loadIfAlreadyDeployed - Load contract if it already deployed; Otherwise throw exception
 * @returns Deployed contract or contract loaded from deployments
 */
export async function deploy<N extends ContractFactory>(
  contractName: ContractNames,
  networkName: string,
  artifactName: string,
  deployArgs: GetARGsTypeFromFactory<N>,
  signer: Signer,
  loadIfAlreadyDeployed = false
): Promise<GetContractTypeFromFactory<N>> {
  const { path, deployments } = _loadDeployments(networkName);

  if (deployments[contractName]) {
    if (loadIfAlreadyDeployed) {
      console.log(`Already deployed ${contractName}`);
      return _contractFromDeployment(deployments[contractName], signer) as GetContractTypeFromFactory<N>;
    }
    throw new Error(`Already deployed ${contractName}`);
  }

  const factory = await ethers.getContractFactory(artifactName);

  console.log(`deploying ${contractName} in ${networkName}...`);
  const res = await factory.deploy(...deployArgs);
  await res.deployed();
  console.log(`deployed ${contractName} at`, res.address);

  // todo save artifact name
  deployments[contractName] = {
    address: res.address,
    abi: res.interface.format() as string[],
    deployTx: res.deployTransaction.hash,
  };
  fs.writeFileSync(path, JSON.stringify(deployments, null, 2));

  return res as GetContractTypeFromFactory<N>;
}
