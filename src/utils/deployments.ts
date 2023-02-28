import path from "path";
import fs from "fs";
import {Contract, ethers, Signer} from "ethers";
import deploymentsProd from "../../deployments/prod.json";
import deploymentsTest from "../../deployments/test.json";

export interface Deployment {
  address: string,
  abi: any[],
  deployTx: string
}

export async function deploy(contractName: string, networkName: string, deployPromise: Promise<any>): Promise<any> {
  const {path, deployments} = _loadDeployments(networkName);
  console.assert(deployments[contractName] === undefined, "Already deployed")

  console.log(`deploying ${contractName} in ${networkName}...`)
  const res = await deployPromise;
  await res.deployed();
  console.log(`deployed ${contractName} at`, res.address)

  deployments[contractName] = {
    address: res.address,
    abi: res.interface.format() as string[],
    deployTx: res.deployTransaction.hash,
  };
  fs.writeFileSync(path, JSON.stringify(deployments, null, 2));

  return res
}

export function loadDeployment(contractName: string, networkName: string, signer?: Signer) {
  const {deployments} = _loadDeployments(networkName);
  const contractDeployment = deployments[contractName];
  console.assert(contractDeployment !== undefined, `Can't find deployment for ${contractName} in ${networkName}`)

  return new ethers.Contract(contractDeployment.address, contractDeployment.abi, signer)
}

export function loadAllDeployments(networkName: string, signer?: Signer): { [name: string]: Contract } {
  const {deployments} = _loadDeployments(networkName);
  const result: { [name: string]: Contract } = {};
  for (let name of Object.keys(deployments)) {
    const contractDeployment = deployments[name];
    result[name] = new ethers.Contract(contractDeployment.address, contractDeployment.abi, signer)
  }
  return result;
}


// todo i don't like it
function _loadDeployments(networkName: string): { path: string, deployments: { [name: string]: Deployment } } {
  const deploymentPath = (name:string) => path.resolve(__dirname, `../../deployments/${name}.json`);
  if (networkName == "22040") return {path: deploymentPath("test"), deployments: deploymentsTest};
  if (networkName == "16718") return {path: deploymentPath("prod"), deployments: deploymentsProd};
  throw new Error("unknown chainid");
}
