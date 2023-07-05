import { Contract, ethers, Signer } from "ethers";

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

export function loadAllDeployments(networkId: number, signer?: Signer): { [ name: string ]: Contract } {
  const deployments = _loadDeployments(networkId);
  const result: { [name: string]: Contract } = {};

  for (const name of Object.keys(deployments)) result[name] = _contractFromDeployment(deployments[name], signer);

  return result;
}

export function _contractFromDeployment(deployment: Deployment, signer?: Signer): Contract {
  return new ethers.Contract(deployment.address, deployment.abi, signer);
}

export function _loadDeployments(chainId: number): { [ name: string ]: Deployment } {
  return require(`../../deployments/${chainId}.json`);
}
