/* eslint-disable @typescript-eslint/no-explicit-any */
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getFullyQualifiedName } from "hardhat/utils/contract-names";

function ensureTrailingSlash(s: string): string {
  return s.endsWith("/") ? s : s + "/";
}

const defaultEndpoint = "https://sourcify.dev/server/";

export async function sourcify(
  hre: HardhatRuntimeEnvironment,
  config: {
    endpoint?: string;
    sourceName: string; // path ./contracts/Greeter.sol
    contractName: string; // name Greeter
    address: string;
    chainId: number;
  }
) {
  const fullyQualifiedName = getFullyQualifiedName(config.sourceName, config.contractName);
  const url = config.endpoint ? ensureTrailingSlash(config.endpoint) : defaultEndpoint;

  try {
    const checkResponse = await fetch(
      `${url}checkByAddresses?addresses=${config.address.toLowerCase()}&chainIds=${config.chainId}`
    ).then((r) => r.json());

    if (checkResponse[0].status === "perfect") {
      console.log(`Already verified: ${fullyQualifiedName} (${config.address}), skipping.`);
      return;
    }
  } catch (e) {
    console.error(
      `Failed to check ${fullyQualifiedName} (${config.address})`,
      ((e as any).response && JSON.stringify((e as any).response.data)) || e
    );
  }

  const buildInfo = await hre.artifacts.getBuildInfo(fullyQualifiedName);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore   `metadata` field real exist lol
  const metadataStr = buildInfo?.output.contracts[config.sourceName][config.contractName].metadata;
  if (!metadataStr) throw `No metadata for contract ${fullyQualifiedName}`;

  const metadata = JSON.parse(metadataStr);
  Object.keys(metadata.sources).forEach((contractSource: string) => {
    metadata.sources[contractSource].content = buildInfo?.input.sources[contractSource].content;
    delete metadata.sources[contractSource].urls;
  });

  console.info(`Verifying ${fullyQualifiedName} (${config.address} on chain ${config.chainId}) ...`);

  const data = {
    address: config.address,
    chain: config.chainId,
    files: { "metadata.json": JSON.stringify(metadata) },
  };

  try {
    const submissionResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json());

    if (submissionResponse.result[0].status === "perfect") {
      console.log(` => contract ${fullyQualifiedName} is now verified`);
    } else {
      console.log(` => contract ${fullyQualifiedName} is not verified`);
    }
  } catch (e) {
    console.error(
      `Failed to verify ${fullyQualifiedName} (${config.address})`,
      ((e as any).response && JSON.stringify((e as any).response.data)) || e
    );
  }
}
