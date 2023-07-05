import { Contract, ethers, Signer } from "ethers";
import deploymentsMain from "../../deployments/16718.json";
import deploymentsTest from "../../deployments/22040.json";
import deploymentsDev from "../../deployments/30746.json";
import deploymentsLocal from "../../deployments/5256.json";

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

export function loadDeployment(contractName: string, networkId: number, signer?: Signer) {
  const deployments = _loadDeployments(networkId);
  if (!deployments[contractName]) throw new Error(`Can't find deployment for ${contractName} in network ${networkId}`);

  return _contractFromDeployment(deployments[contractName], signer);
}

export function loadAllDeployments(networkId: number, signer?: Signer): { [name: string]: Contract } {
  const deployments = _loadDeployments(networkId);
  const result: { [name: string]: Contract } = {};

  for (const name of Object.keys(deployments)) result[name] = _contractFromDeployment(deployments[name], signer);

  return result;
}

export function _contractFromDeployment(deployment: Deployment, signer?: Signer): Contract {
  return new ethers.Contract(deployment.address, deployment.abi, signer);
}

// todo i don't like it
export function _loadDeployments(networkId: number): { [name: string]: Deployment } {
  if (networkId == 30746) return deploymentsDev;
  if (networkId == 22040) return deploymentsTest;
  if (networkId == 16718) return deploymentsMain;
  if (networkId == 0x1488) return deploymentsLocal;
  throw new Error(`unknown network id: ${networkId}`);
}
