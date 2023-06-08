/* eslint-disable @typescript-eslint/no-explicit-any */
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { parseFullyQualifiedName } from "hardhat/utils/contract-names";
import { _loadDeployments, nameToChainID } from "../utils/deployments";

const ENDPOINT = "https://sourcify.ambrosus.io/";

export async function sourcifyAll(hre: HardhatRuntimeEnvironment) {
  const networkName = hre.network.name;
  const chainId = nameToChainID[networkName];
  if (!chainId) throw `${networkName} not in nameToChainID dict`;
  const deployments = _loadDeployments(networkName);

  for (const [contractName, deployment] of Object.entries(deployments))
    if (deployment.proxy) {
      await sourcifyOne(hre, deployment.proxy.fullyQualifiedName, deployment.address, chainId, contractName + " Proxy");
      await sourcifyOne(hre, deployment.fullyQualifiedName, deployment.proxy.implementation, chainId, contractName);
    } else {
      await sourcifyOne(hre, deployment.fullyQualifiedName, deployment.address, chainId, contractName);
    }
}

export async function sourcifyOne(
  hre: HardhatRuntimeEnvironment,
  fullyQualifiedName: string,
  address: string,
  chainId: number,
  name?: string
) {
  name = name || fullyQualifiedName;

  if (await isVerified(address, chainId)) {
    console.log(`Already verified: ${name} (${address})`);
    return;
  }

  try {
    console.info(`Verifying ${name} (${address} on chain ${chainId}) ...`);
    const metadata = await loadMetadata(hre, fullyQualifiedName);
    const result = await verify(chainId, address, metadata);
    if (result == "perfect") console.info(`  Contract ${name} is now verified`);
    if (result == "partial") console.warn(`  Contract ${name} is now partial verified`);
  } catch (e) {
    console.error(
      `  Failed to verify ${fullyQualifiedName} (${address})`,
      ((e as any).response && JSON.stringify((e as any).response.data)) || e
    );
  }
}

// INTERNAL

async function isVerified(address: string, chainId: number): Promise<boolean> {
  const checkResponse = await fetch(
    `${ENDPOINT}checkByAddresses?addresses=${address.toLowerCase()}&chainIds=${chainId}`
  ).then((r) => r.json());

  return checkResponse[0].status === "perfect";
}

async function verify(chainId: number, address: string, metadata: string): Promise<string> {
  const data = {
    address: address,
    chain: chainId.toString(),
    files: { "metadata.json": metadata },
  };

  const submissionResponse = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => r.json());

  if (submissionResponse.error) throw new Error(submissionResponse.error);
  return submissionResponse.result[0].status;
}

async function loadMetadata(hre: HardhatRuntimeEnvironment, fullyQualifiedName: string): Promise<string> {
  const buildInfo = await getBuildInfo(hre, fullyQualifiedName);
  const { sourceName, contractName } = parseFullyQualifiedName(fullyQualifiedName);

  const metadataStr = buildInfo.output.contracts[sourceName][contractName].metadata;
  if (!metadataStr) throw `No metadata for contract ${fullyQualifiedName}`;

  const metadata = JSON.parse(metadataStr);
  Object.keys(metadata.sources).forEach((contractSource: string) => {
    metadata.sources[contractSource].content = buildInfo?.input.sources[contractSource].content;
    delete metadata.sources[contractSource].urls;
  });

  return JSON.stringify(metadata);
}

async function getBuildInfo(hre: HardhatRuntimeEnvironment, fullyQualifiedName: string): Promise<any> {
  if (
    fullyQualifiedName ==
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy"
  )
    return require("@openzeppelin/upgrades-core/artifacts/build-info.json");

  return await hre.artifacts.getBuildInfo(fullyQualifiedName);
}
