import { Contract, ethers, Signer } from "ethers";
import deploymentsMain from "../../deployments/main.json";
import deploymentsTest from "../../deployments/test.json";

export interface Deployment {
  address: string;
  abi: any[];
  deployTx: string;
  fullyQualifiedName: string;
  proxy?: {
    implementation: string;
    fullyQualifiedName: string;
  };
}

export function loadDeployment(contractName: string, networkName: string, signer?: Signer) {
  const deployments = _loadDeployments(networkName);
  if (!deployments[contractName]) throw new Error(`Can't find deployment for ${contractName} in ${networkName}`);

  return _contractFromDeployment(deployments[contractName], signer);
}

export function loadAllDeployments(networkName: string, signer?: Signer): { [name: string]: Contract } {
  const deployments = _loadDeployments(networkName);
  const result: { [name: string]: Contract } = {};

  for (const name of Object.keys(deployments)) result[name] = _contractFromDeployment(deployments[name], signer);

  return result;
}

export function _contractFromDeployment(deployment: Deployment, signer?: Signer): Contract {
  return new ethers.Contract(deployment.address, deployment.abi, signer);
}

// todo i don't like it
export function _loadDeployments(networkName: string): { [name: string]: Deployment } {
  if (networkName == "test") return deploymentsTest;
  if (networkName == "main") return deploymentsMain;
  throw new Error(`unknown network name: ${networkName}`);
}

export const chainIDToName: { [chainId: number]: string } = {
  22040: "test",
  16718: "main",
};
export const nameToChainID: { [name: string]: number } = Object.fromEntries(
  Object.entries(chainIDToName).map(([k, v]) => [v, +k])
);
