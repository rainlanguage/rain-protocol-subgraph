import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

import type { Contract } from "ethers";
import type { Artifact } from "hardhat/types";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { createApolloFetch } from "apollo-fetch";
import { execSync } from "child_process";

// Balancer contracts artifacts
import bFactoryJson from "@beehiveinnovation/balancer-core/artifacts/BFactory.json";
import smartPoolManagerJson from "@beehiveinnovation/configurable-rights-pool/artifacts/SmartPoolManager.json";
import balancerSafeMathJson from "@beehiveinnovation/configurable-rights-pool/artifacts/BalancerSafeMath.json";
import rightsManagerJson from "@beehiveinnovation/configurable-rights-pool/artifacts/RightsManager.json";
import crpFactoryJson from "@beehiveinnovation/configurable-rights-pool/artifacts/CRPFactory.json";
import configurableRightsPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/ConfigurableRightsPool.json";
import bPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/BPool.json";

// Balancer types
import type { BFactory } from "../typechain/BFactory";
import type { BPool } from "../typechain/BPool";
import type { CRPFactory } from "../typechain/CRPFactory";
import type { ConfigurableRightsPool } from "../typechain/ConfigurableRightsPool";

// TrustFactory types
import type {
  TrustFactory,
  TrustConfigStruct,
  TrustRedeemableERC20ConfigStruct,
  TrustSeedERC20ConfigStruct,
} from "../typechain/TrustFactory";
import { RedeemableERC20Factory__factory } from "../typechain/factories/RedeemableERC20Factory__factory";
import { SeedERC20Factory__factory } from "../typechain/factories/SeedERC20Factory__factory";
import { TrustFactory__factory } from "../typechain/factories/TrustFactory__factory";

import type { RedeemableERC20Factory } from "../typechain/RedeemableERC20Factory";
import type { RedeemableERC20 } from "../typechain/RedeemableERC20";
import type { SeedERC20Factory } from "../typechain/SeedERC20Factory";

export const eighteenZeros = "000000000000000000";
export const sixZeros = "000000";
export const CREATOR_FUNDS_RELEASE_TIMEOUT_TESTING = 100;
export const MAX_RAISE_DURATION_TESTING = 100;

// Interfaces
interface SyncedSubgraphType {
  synced: boolean;
}

interface BasicArtifact {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any[];
  bytecode: string;
}

interface CRPLibraries {
  [key: string]: string;
  SmartPoolManager: string;
  BalancerSafeMath: string;
  RightsManager: string;
}

/**
 * Create a promise to wait a determinated `ms`
 * @param ms Amount of time to wait in miliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute Child Processes
 * @param cmd Command to execute
 * @returns The command ran it
 */
export const exec = (cmd: string): string | Buffer => {
  const srcDir = path.join(__dirname, "..");
  try {
    return execSync(cmd, { cwd: srcDir, stdio: "inherit" });
  } catch (e) {
    throw new Error(`Failed to run command \`${cmd}\``);
  }
};

// Subgraph Management
export const fetchSubgraphs = createApolloFetch({
  uri: "http://localhost:8030/graphql",
});

/**
 * Wait for the synchronization of the subgraph when it is delayed with respect to the chain. It must be used
 * after a transaction and want to be query the result immediately after that
 * @param wait Amount of time in seconds to wait before ask to the subgraph about synchronization
 * @param timeDelay Amount of time in seconds to wait between queries
 * @param seconds Max time in seconds to wait by synchronization
 * @returns Subgraph Synchronized
 */
export const waitForSubgraphToBeSynced = async (
  wait = 0,
  timeDelay = 1,
  seconds = 60
): Promise<SyncedSubgraphType> => {
  if (wait > 0) {
    await delay(wait);
  }
  /**
   * Waiting for 60s by default
   * Does not care about waiting the 60s -  the function already try to handle if does not receive
   * a response. If the subgraph need to wait for a big number of blocks, would be good increse
   * the seconds to wait by sync.
   */
  const deadline = Date.now() + seconds * 1000;
  const currentBlock = await ethers.provider.getBlockNumber();

  const resp = new Promise<SyncedSubgraphType>((resolve, reject) => {
    // Function to check if the subgraph is synced asking to the GraphNode
    const checkSubgraphSynced = async () => {
      try {
        const result = await fetchSubgraphs({
          query: `
            {
              indexingStatusForCurrentVersion(subgraphName: "vishalkale151071/rain-protocol") {
                synced
                health
                fatalError{
                  message
                  handler
                }
                chains {
                  chainHeadBlock {
                    number
                  }
                  latestBlock {
                    number
                  }
                }
              } 
            } 
          `,
        });
        const data = result.data.indexingStatusForCurrentVersion;
        if (
          data.synced === true &&
          data.chains[0].latestBlock.number == currentBlock
        ) {
          resolve({ synced: true });
        } else if (data.health === "failed") {
          reject(new Error(`Subgraph fatalError - ${data.fatalError.message}`));
        } else {
          throw new Error(`subgraph is not sync`);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown Error";
        if (message.includes("connect ECONNREFUSED")) {
          reject(new Error(`Unable to connect to Subgraph node: ${message}`));
        }

        if (message == "Unknown Error") {
          reject(new Error(`${message} - ${e}`));
        }

        if (!currentBlock) {
          reject(new Error(`current block is undefined`));
        }

        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for the subgraph to sync`));
        } else {
          setTimeout(checkSubgraphSynced, timeDelay * 1000);
        }
      }
    };

    checkSubgraphSynced();
  });

  return resp;
};

/**
 * Deploy a contract with they artifact (JSON)
 * @param artifact The artifact of the contract to deploy. It should contain the ABI and bytecode. The
 * user should manage the type contract when returned.
 * @param signer Signer that will deploy the contract
 * @param argmts (Optional) Arguments to deploy the contract
 * @returns A deployed contract instance
 */
export const deploy = async (
  artifact: Artifact | BasicArtifact,
  signer: SignerWithAddress,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  argmts: any[] = []
): Promise<Contract> => {
  const iface = new ethers.utils.Interface(artifact.abi);
  const factory = new ethers.ContractFactory(iface, artifact.bytecode, signer);
  const contract = await factory.deploy(...argmts);
  await contract.deployed();
  return contract;
};

/**
 * Deploy and return the balancer contracts as BFactory and CRPFactory with his libraries.
 * @param signer Signer that will deploy the contracts
 * @returns CRPFactory and Bfactory contract instances
 */
export const balancerDeploy = async (
  signer: SignerWithAddress
): Promise<[CRPFactory, BFactory]> => {
  const bFactory = (await deploy(bFactoryJson, signer, [])) as BFactory;

  const smartPoolManager = await deploy(smartPoolManagerJson, signer, []);
  const balancerSafeMath = await deploy(balancerSafeMathJson, signer, []);
  const rightsManager = await deploy(rightsManagerJson, signer, []);

  const libs: CRPLibraries = {
    SmartPoolManager: smartPoolManager.address,
    BalancerSafeMath: balancerSafeMath.address,
    RightsManager: rightsManager.address,
  };

  const crpFactory = (await deploy(
    linkBytecode(crpFactoryJson, libs),
    signer,
    []
  )) as CRPFactory;

  return [crpFactory, bFactory];
};

/**
 * Linking libraries to CRPFactory bytecode
 * @param artifact CRPFactory artifacts that contain the bytecode to link
 * @param links The libraries addresses to link
 * @returns The artifacts with the bytecode linked with libraries
 */
const linkBytecode = (
  artifact: Artifact | BasicArtifact,
  links: CRPLibraries
) => {
  Object.keys(links).forEach((libraryName) => {
    const libraryAddress = links[libraryName];
    const regex = new RegExp(`__${libraryName}_+`, "g");
    artifact.bytecode = artifact.bytecode.replace(
      regex,
      libraryAddress.replace("0x", "")
    );
  });
  return artifact;
};

/**
 * Deploy all the factories that corresponding to the TrustFactory with a default values as constructor
 * @param crpFactory The CRPFactory contract instances to use in the TrustFactory. It should ensure that is a valid CRPFactory
 * @param balancerFactory The BFactory contract instances to use in the TrustFactory. It should ensure that is a valid BFactory
 * @param signer The signer that will deploy all the contracts
 * @returns A RedeemableERC20Factory, SeedERC20Factory and TrustFactory contract instances
 */
export const trustFactoriesDeploy = async (
  crpFactory: CRPFactory,
  balancerFactory: BFactory,
  signer: SignerWithAddress
): Promise<{
  redeemableERC20Factory: RedeemableERC20Factory;
  seedERC20Factory: SeedERC20Factory;
  trustFactory: TrustFactory;
}> => {
  const redeemableERC20Factory = await new RedeemableERC20Factory__factory(
    signer
  ).deploy();

  const seedERC20Factory = await new SeedERC20Factory__factory(signer).deploy();

  const TrustFactoryArgs = {
    crpFactory: crpFactory.address,
    balancerFactory: balancerFactory.address,
    redeemableERC20Factory: redeemableERC20Factory.address,
    seedERC20Factory: seedERC20Factory.address,
    creatorFundsReleaseTimeout: CREATOR_FUNDS_RELEASE_TIMEOUT_TESTING,
    maxRaiseDuration: MAX_RAISE_DURATION_TESTING,
  };

  const trustFactory = await new TrustFactory__factory(signer).deploy(
    TrustFactoryArgs
  );

  return {
    redeemableERC20Factory,
    seedERC20Factory,
    trustFactory,
  };
};

/**
 * Read a file a return it as string
 * @param _path Location of the file
 * @returns The file as string
 */
export const fetchFile = (_path: string): string => {
  try {
    return fs.readFileSync(_path).toString();
  } catch (error) {
    console.log(error);
    return "";
  }
};

/**
 * Write a file
 * @param _path Location of the file
 * @param file The file
 */
// eslint-disable-next-line
export const writeFile = (_path: string, file: any): void => {
  try {
    fs.writeFileSync(_path, file);
  } catch (error) {
    console.log(error);
  }
};
