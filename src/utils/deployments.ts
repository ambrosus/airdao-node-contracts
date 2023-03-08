import path from "path";
import fs from "fs";
import { Contract, ContractFactory, ethers, Signer } from "ethers";
import deploymentsProd from "../../deployments/prod.json";
import deploymentsTest from "../../deployments/test.json";

export interface Deployment {
  address: string;
  abi: any[];
  deployTx: string;
}

// deploy contract via ethers deploy function
// save information about deploy into `deployments/${networkName}.json` file with `contractName` name;
// if deployment with this name already exists it can be loaded if `loadSigner` argument provided
export async function deploy<T extends ContractFactory>(
  contractName: string,
  networkName: string,
  factory: T,
  deployArgs: Parameters<T["deploy"]>,
  loadSigner?: Signer
): Promise<ReturnType<T["deploy"]>> {
  const { path, deployments } = _loadDeployments(networkName);

  if (deployments[contractName]) {
    if (loadSigner) {
      console.log(`Already deployed ${contractName}. Returning it with ${await loadSigner.getAddress()} signer`);
      return _contractFromDeployment(deployments[contractName], loadSigner) as ReturnType<T["deploy"]>;
    }
    throw new Error(`Already deployed ${contractName}`);
  }

  console.log(`deploying ${contractName} in ${networkName}...`);
  const res = await factory.deploy(...deployArgs);
  await res.deployed();
  console.log(`deployed ${contractName} at`, res.address);

  deployments[contractName] = {
    address: res.address,
    abi: res.interface.format() as string[],
    deployTx: res.deployTransaction.hash,
  };
  fs.writeFileSync(path, JSON.stringify(deployments, null, 2));

  return res as ReturnType<T["deploy"]>;
}

export function loadDeployment(contractName: string, networkName: string, signer?: Signer) {
  const { deployments } = _loadDeployments(networkName);
  if (!deployments[contractName]) throw new Error(`Can't find deployment for ${contractName} in ${networkName}`);

  return _contractFromDeployment(deployments[contractName], signer);
}

export function loadAllDeployments(networkName: string, signer?: Signer): { [name: string]: Contract } {
  const { deployments } = _loadDeployments(networkName);
  const result: { [name: string]: Contract } = {};

  for (const name of Object.keys(deployments)) result[name] = _contractFromDeployment(deployments[name], signer);

  return result;
}

function _contractFromDeployment(deployment: Deployment, signer?: Signer): Contract {
  return new ethers.Contract(deployment.address, deployment.abi, signer);
}

// todo i don't like it
function _loadDeployments(networkName: string): { path: string; deployments: { [name: string]: Deployment } } {
  const deploymentPath = (name: string) => path.resolve(__dirname, `../../deployments/${name}.json`);
  if (networkName == "22040") return { path: deploymentPath("test"), deployments: deploymentsTest };
  if (networkName == "16718") return { path: deploymentPath("prod"), deployments: deploymentsProd };
  throw new Error("unknown chainid");
}
