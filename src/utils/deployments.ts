import path from "path";
import { Contract, ethers, Signer } from "ethers";
import deploymentsProd from "../../deployments/prod.json";
import deploymentsTest from "../../deployments/test.json";

export interface Deployment {
  address: string;
  abi: any[];
  deployTx: string;
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

export function _contractFromDeployment(deployment: Deployment, signer?: Signer): Contract {
  return new ethers.Contract(deployment.address, deployment.abi, signer);
}

// todo i don't like it
export function _loadDeployments(networkName: string): { path: string; deployments: { [name: string]: Deployment } } {
  const deploymentPath = (name: string) => path.resolve(__dirname, `../../deployments/${name}.json`);
  if (networkName == "22040") return { path: deploymentPath("test"), deployments: deploymentsTest };
  if (networkName == "16718") return { path: deploymentPath("prod"), deployments: deploymentsProd };
  throw new Error("unknown chainid");
}
