import { Signer } from "ethers";

import { createApolloFetch } from "apollo-fetch";
import path from "path";
import { execSync } from "child_process";

// Balancer contracts
import BFactory from "@beehiveinnovation/balancer-core/artifacts/BFactory.json";
import SmartPoolManager from "@beehiveinnovation/configurable-rights-pool/artifacts/SmartPoolManager.json";
import BalancerSafeMath from "@beehiveinnovation/configurable-rights-pool/artifacts/BalancerSafeMath.json";
import RightsManager from "@beehiveinnovation/configurable-rights-pool/artifacts/RightsManager.json";
import CRPFactory from "@beehiveinnovation/configurable-rights-pool/artifacts/CRPFactory.json";
import ConfigurableRightsPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/ConfigurableRightsPool.json";
import BPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/BPool.json";

// Rain protocol contracts
import RedeemableERC20Factory from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20Factory.sol/RedeemableERC20Factory.json";
import SeedERC20Factory from "@beehiveinnovation/rain-protocol/artifacts/contracts/seed/SeedERC20Factory.sol/SeedERC20Factory.json";
import TrustFactory from "@beehiveinnovation/rain-protocol/artifacts/contracts/trust/TrustFactory.sol/TrustFactory.json";
import TrustJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/trust/Trust.sol/Trust.json";

// Types
import type { ConfigurableRightsPool } from "@beehiveinnovation/rain-protocol//typechain/ConfigurableRightsPool";
import type { BPool } from "@beehiveinnovation/rain-protocol//typechain/BPool";
import type {
  Trust,
  TrustConfigStruct,
  TrustRedeemableERC20ConfigStruct,
  TrustSeedERC20ConfigStruct,
} from "@beehiveinnovation/rain-protocol/typechain/Trust";
import type {
  BigNumber,
  Contract,
  BytesLike,
  BigNumberish,
  ContractTransaction,
} from "ethers";
import { concat, Hexable, hexlify, Result, zeroPad } from "ethers/lib/utils";

interface SyncedSubgraphType {
  synced: boolean;
}

const { ethers } = require("hardhat");

export const eighteenZeros = "000000000000000000";
export const sixZeros = "000000";
export const zeroAddress = ethers.constants.AddressZero;
export const CREATOR_FUNDS_RELEASE_TIMEOUT_TESTING = 100;
export const MAX_RAISE_DURATION_TESTING = 100;

// Execute Child Processes
const srcDir = path.join(__dirname, "..");
export const exec = (cmd: string) => {
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

export const fetchSubgraph = (subgraphUser: string, subgraphName: string) => {
  return createApolloFetch({
    uri: `http://localhost:8000/subgraphs/name/${subgraphUser}/${subgraphName}`,
  });
};

const checkIfAllSynced = (subgraphs: SyncedSubgraphType[]) => {
  const result = subgraphs.find(
    (el: SyncedSubgraphType) => el.synced === false
  );
  return Boolean(!result);
};

export const waitForSubgraphToBeSynced = async (delay: number) =>
  new Promise<{ synced: boolean }>((resolve, reject) => {
    // Wait for 5s
    const deadline = Date.now() + 15 * 1000;

    // Function to check if the subgraph is synced
    const checkSubgraphSynced = async () => {
      try {
        const result = await fetchSubgraphs({
          query: `{
            indexingStatusForCurrentVersion(subgraphName: "vishalkale151071/rain-protocol") {
              synced
              health
              fatalError{
                message
                handler
              }
            } 
          }`,
        });
        if (result.data.indexingStatusForCurrentVersion.synced == true) {
          resolve({ synced: true });
        } else {
          throw new Error("reject or retry");
        }
      } catch (e) {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for the subgraph to sync`));
        } else {
          setTimeout(checkSubgraphSynced, delay);
        }
      }
    };

    // Periodically check whether the subgraph has synced
    setTimeout(checkSubgraphSynced, delay);
  });

// Contracts Management
export const deploy = async (
  artifact: any,
  signer: any,
  argmts: any[] | any
): Promise<Contract> => {
  const iface = new ethers.utils.Interface(artifact.abi);
  const factory = new ethers.ContractFactory(iface, artifact.bytecode, signer);
  const contract = await factory.deploy(...argmts);
  await contract.deployTransaction.wait();
  return contract;
};

export const balancerDeploy = async (
  signer: Signer
): Promise<[Contract, Contract]> => {
  const bFactory: Contract = await deploy(BFactory, signer, []);

  const smartPoolManager: Contract = await deploy(SmartPoolManager, signer, []);
  const balancerSafeMath: Contract = await deploy(BalancerSafeMath, signer, []);
  const rightsManager: Contract = await deploy(RightsManager, signer, []);

  const libs = {
    SmartPoolManager: smartPoolManager.address,
    BalancerSafeMath: balancerSafeMath.address,
    RightsManager: rightsManager.address,
  };
  const crpFactory: Contract = await deploy(
    linkBytecode(CRPFactory, libs),
    signer,
    []
  );
  return [crpFactory, bFactory];
};

const linkBytecode = (artifact: any, links: any) => {
  Object.keys(links).forEach((library_name) => {
    const library_address = links[library_name];
    const regex = new RegExp(`__${library_name}_+`, "g");
    artifact.bytecode = artifact.bytecode.replace(
      regex,
      library_address.replace("0x", "")
    );
  });
  return artifact;
};

export const factoriesDeploy = async (
  crpFactory: Contract,
  balancerFactory: Contract,
  signer: Signer
): Promise<any> => {
  const redeemableERC20Factory = await deploy(
    RedeemableERC20Factory,
    signer,
    []
  );
  await redeemableERC20Factory.deployed();

  const seedERC20Factory = await deploy(SeedERC20Factory, signer, []);
  await seedERC20Factory.deployed();

  const TrustFactoryArgs = {
    redeemableERC20Factory: redeemableERC20Factory.address,
    seedERC20Factory: seedERC20Factory.address,
    crpFactory: crpFactory.address,
    balancerFactory: balancerFactory.address,
    creatorFundsReleaseTimeout: CREATOR_FUNDS_RELEASE_TIMEOUT_TESTING,
    maxRaiseDuration: MAX_RAISE_DURATION_TESTING,
  };
  const trustFactory = await deploy(TrustFactory, signer, [TrustFactoryArgs]);
  await trustFactory.deployed();

  return {
    redeemableERC20Factory,
    seedERC20Factory,
    trustFactory,
  };
};

export const trustDeploy = async (
  trustFactory: Contract,
  creator: Signer,
  trustConfig: TrustConfigStruct,
  trustRedeemableERC20Config: TrustRedeemableERC20ConfigStruct,
  trustSeedERC20Config: TrustSeedERC20ConfigStruct,
  ...args: any
): Promise<Trust & Contract> => {
  const txDeploy = await trustFactory.createChildTyped(
    trustConfig,
    trustRedeemableERC20Config,
    trustSeedERC20Config,
    ...args
  );

  const trust = new ethers.Contract(
    ethers.utils.hexZeroPad(
      ethers.utils.hexStripZeros(
        (await getEventArgs(txDeploy, "NewChild", trustFactory)).child
      ),
      20 // address bytes length
    ),
    TrustJson.abi,
    creator
  ) as Trust & Contract;

  if (!ethers.utils.isAddress(trust.address)) {
    throw new Error(
      `invalid trust address: ${trust.address} (${trust.address.length} chars)`
    );
  }

  await trust.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  trust.deployTransaction = txDeploy;

  return trust;
};

export const poolContracts = async (
  signers: any[],
  trust: Trust & Contract
): Promise<[ConfigurableRightsPool & Contract, BPool & Contract]> => {
  const crp = new ethers.Contract(
    await trust.crp(),
    ConfigurableRightsPoolJson.abi,
    signers[0]
  ) as ConfigurableRightsPool & Contract;
  const bPool = new ethers.Contract(
    await crp.bPool(),
    BPoolJson.abi,
    signers[0]
  ) as BPool & Contract;
  return [crp, bPool];
};

export const waitForBlock = async (blockNumber: any): Promise<any> => {
  const currentBlock = await ethers.provider.getBlockNumber();

  if (currentBlock >= blockNumber) {
    return;
  }

  console.log({
    currentBlock,
    awaitingBlock: blockNumber,
  });

  await timeout(2000);

  return await waitForBlock(blockNumber);
};

function timeout(ms: any) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const containObject = (arr: any[], obj: any): Boolean => {
  const keys = Object.keys(obj);
  let result = false;

  for (let i = 0; i < arr.length; i++) {
    if (Object.keys(arr[i]).length === keys.length) {
      for (let j = 0; j < keys.length; j++) {
        if (arr[i][keys[j]] === obj[keys[j]]) {
          result = true;
        } else {
          result = false;
        }
      }
    }
    if (result) {
      return result;
    }
  }
  return result;
};

/**
 *
 * @param tx - transaction where event occurs
 * @param eventName - name of event
 * @param contract - contract object holding the address, filters, interface
 * @param contractAddressOverride - (optional) override the contract address which emits this event
 * @returns Event arguments, can be deconstructed by array index or by object key
 */
export const getEventArgs = async (
  tx: ContractTransaction,
  eventName: string,
  contract: Contract,
  contractAddressOverride: string = null
): Promise<Result> => {
  const eventObj = (await tx.wait()).events.find(
    (x) =>
      x.topics[0] == contract.filters[eventName]().topics[0] &&
      x.address == (contractAddressOverride || contract.address)
  );

  if (!eventObj) {
    throw new Error(`Could not find event with name ${eventName}`);
  }

  return contract.interface.decodeEventLog(eventName, eventObj.data);
};

export const createEmptyBlock = async (count?: number): Promise<void> => {
  const signers = await ethers.getSigners();
  const tx = { to: signers[1].address };
  if (count > 0) {
    for (let i = 0; i < count; i++) {
      await signers[0].sendTransaction(tx);
    }
  } else {
    await signers[0].sendTransaction(tx);
  }
};
