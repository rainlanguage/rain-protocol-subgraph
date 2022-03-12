import {
  Contract,
  Signer,
  BigNumberish,
  BigNumber,
  FixedNumber,
  ContractTransaction,
  BytesLike,
  Overrides,
} from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Result, concat, hexlify, Hexable, zeroPad } from "ethers/lib/utils";
import { createApolloFetch, ApolloFetch } from "apollo-fetch";

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { ethers } from "hardhat";
import { Artifact } from "hardhat/types";

// Balancer contracts
import BFactory from "@beehiveinnovation/balancer-core/artifacts/BFactory.json";
import SmartPoolManager from "@beehiveinnovation/configurable-rights-pool/artifacts/SmartPoolManager.json";
import BalancerSafeMath from "@beehiveinnovation/configurable-rights-pool/artifacts/BalancerSafeMath.json";
import RightsManager from "@beehiveinnovation/configurable-rights-pool/artifacts/RightsManager.json";
import CRPFactory from "@beehiveinnovation/configurable-rights-pool/artifacts/CRPFactory.json";
import ConfigurableRightsPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/ConfigurableRightsPool.json";
import BPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/BPool.json";

// Typechain factories
import { ReserveTokenTest__factory } from "../../typechain/factories/ReserveTokenTest__factory";
import { RedeemableERC20Factory__factory } from "../../typechain/factories/RedeemableERC20Factory__factory";
import { SeedERC20Factory__factory } from "../../typechain/factories/SeedERC20Factory__factory";
import { TrustFactory__factory } from "../../typechain/factories/TrustFactory__factory";

import { ERC20BalanceTier__factory } from "../../typechain/factories/ERC20BalanceTier__factory";
import { Trust__factory } from "../../typechain/factories/Trust__factory";
import { Sale__factory } from "../../typechain/factories/Sale__factory";
import { GatedNFT__factory } from "../../typechain/factories/GatedNFT__factory";
import { Verify__factory } from "../../typechain/factories/Verify__factory";
import { RedeemableERC20__factory } from "../../typechain/factories/RedeemableERC20__factory";
import { EmissionsERC20__factory } from "../../typechain/factories/EmissionsERC20__factory";
//
import {
  Factory,
  ImplementationEvent,
  NewChildEvent,
} from "../../typechain/Factory";

// Rain protocol contracts Artifacts
import RedeemableERC20FactoryJson from "../../artifacts/contracts/redeemableERC20/RedeemableERC20Factory.sol/RedeemableERC20Factory.json";
import SeedERC20FactoryJson from "../../artifacts/contracts/seed/SeedERC20Factory.sol/SeedERC20Factory.json";
import TrustFactoryJson from "../../artifacts/contracts/trust/TrustFactory.sol/TrustFactory.json";

import TrustJson from "../../artifacts/contracts/trust/Trust.sol/Trust.json";
import SaleJson from "../../artifacts/contracts/sale/Sale.sol/Sale.json";
import gatedNFTJson from "../../artifacts/contracts/rain-statusfi/GatedNFT.sol/GatedNFT.json";
import reserveToken from "../../artifacts/contracts/test/ReserveTokenTest.sol/ReserveTokenTest.json";

import verifyJson from "../../artifacts/contracts/verify/Verify.sol/Verify.json";
import verifyTierJson from "../../artifacts/contracts/tier/VerifyTier.sol/VerifyTier.json";
import redeemableTokenJson from "../../artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json";
import erc20BalanceTierJson from "../../artifacts/contracts/tier/ERC20BalanceTier.sol/ERC20BalanceTier.json";
import erc20TransferTierJson from "../../artifacts/contracts/tier/ERC20TransferTier.sol/ERC20TransferTier.json";
import combineTierJson from "../../artifacts/contracts/tier/CombineTier.sol/CombineTier.json";
import erc721BalanceTierJson from "../../artifacts/contracts/tier/ERC721BalanceTier.sol/ERC721BalanceTier.json";

// Types
import {
  ERC20BalanceTierFactory,
  ERC20BalanceTierConfigStruct,
} from "../../typechain/ERC20BalanceTierFactory";
import { ERC20TransferTierFactory } from "../../typechain/ERC20TransferTierFactory";
import { CombineTierFactory } from "../../typechain/CombineTierFactory";
import { VerifyTierFactory } from "../../typechain/VerifyTierFactory";
import { VerifyFactory } from "../../typechain/VerifyFactory";
import { ERC721BalanceTierFactory } from "../../typechain/ERC721BalanceTierFactory";

import { RedeemableERC20Factory } from "../../typechain/RedeemableERC20Factory";
import { SeedERC20Factory } from "../../typechain/SeedERC20Factory";
import {
  TrustFactory,
  TrustConfigStruct,
  TrustRedeemableERC20ConfigStruct,
  TrustSeedERC20ConfigStruct,
} from "../../typechain/TrustFactory";
import {
  SaleFactory,
  SaleConfigStruct,
  SaleRedeemableERC20ConfigStruct,
  StateConfigStruct,
} from "../../typechain/SaleFactory";
import {
  EmissionsERC20Factory,
  EmissionsERC20ConfigStruct,
} from "../../typechain/EmissionsERC20Factory";
import { GatedNFTFactory, ConfigStruct } from "../../typechain/GatedNFTFactory";

import { ERC20BalanceTier } from "../../typechain/ERC20BalanceTier";

import { ERC20TransferTier } from "../../typechain/ERC20TransferTier";

import { CombineTier } from "../../typechain/CombineTier";

import { ERC721BalanceTier } from "../../typechain/ERC721BalanceTier";

import { GatedNFT } from "../../typechain/GatedNFT";
import { VerifyTier } from "../../typechain/VerifyTier";
import { Verify } from "../../typechain/Verify";
import { ReadWriteTier } from "../../typechain/ReadWriteTier";
import { RedeemableERC20 } from "../../typechain/RedeemableERC20";
import { ReserveTokenTest } from "../../typechain/ReserveTokenTest";

import type { ConfigurableRightsPool } from "../../typechain/ConfigurableRightsPool";
import type { BPool } from "../../typechain/BPool";
import type { Trust } from "../../typechain/Trust";

import type { Sale } from "../../typechain/Sale";
import type { EmissionsERC20 } from "../../typechain/EmissionsERC20";

import { StateStruct } from "../../typechain/VMState";

interface SyncedSubgraphType {
  synced: boolean;
}

export const sixZeros = "000000";
export const sixteenZeros = "0000000000000000";
export const eighteenZeros = "000000000000000000";

export const zeroAddress = ethers.constants.AddressZero;

export const ONE = ethers.BigNumber.from("1" + eighteenZeros);
export const RESERVE_ONE = ethers.BigNumber.from("1" + sixZeros);

export const oneHundredFN = ethers.FixedNumber.from(100, "fixed128x32");

export const CREATOR_FUNDS_RELEASE_TIMEOUT_TESTING = 100;
export const MAX_RAISE_DURATION_TESTING = 100;

// Verify Roles
export const DEFAULT_ADMIN_ROLE = ethers.utils.hexZeroPad("0x00", 32);

export const APPROVER_ADMIN = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("APPROVER_ADMIN")
);
export const APPROVER = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("APPROVER")
);

export const REMOVER_ADMIN = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("REMOVER_ADMIN")
);
export const REMOVER = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("REMOVER")
);

export const BANNER_ADMIN = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("BANNER_ADMIN")
);
export const BANNER = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("BANNER")
);

export enum RequestType {
  APPROVE,
  BAN,
  REMOVE,
}

export enum RequestStatus {
  NONE,
  APPROVE,
  BAN,
  REMOVE,
}

export enum VerifyStatus {
  NIL,
  ADDED,
  APPROVED,
  BANNED,
}

export enum VerifyRole {
  NONE,
  APPROVER_ADMIN,
  REMOVER_ADMIN,
  BANNER_ADMIN,
  APPROVER,
  REMOVER,
  BANNER,
}

export enum Tier {
  ZERO, // NIL
  ONE, // COPPER
  TWO, // BRONZE
  THREE, // SILVER
  FOUR, // GOLD
  FIVE, // PLATINUM
  SIX, // DIAMOND
  SEVEN, // CHAD
  EIGHT, // JAWAD
}

export enum OpcodeSale {
  SKIP,
  VAL,
  DUP,
  ZIPMAP,
  BLOCK_NUMBER,
  BLOCK_TIMESTAMP,
  SENDER,
  IS_ZERO,
  EAGER_IF,
  EQUAL_TO,
  LESS_THAN,
  GREATER_THAN,
  EVERY,
  ANY,
  ADD,
  SUB,
  MUL,
  DIV,
  MOD,
  POW,
  MIN,
  MAX,
  REPORT,
  NEVER,
  ALWAYS,
  SATURATING_DIFF,
  UPDATE_BLOCKS_FOR_TIER_RANGE,
  SELECT_LTE,
  ERC20_BALANCE_OF,
  ERC20_TOTAL_SUPPLY,
  ERC721_BALANCE_OF,
  ERC721_OWNER_OF,
  ERC1155_BALANCE_OF,
  ERC1155_BALANCE_OF_BATCH,
  REMAINING_UNITS,
  TOTAL_RESERVE_IN,
  LAST_BUY_BLOCK,
  LAST_BUY_UNITS,
  LAST_BUY_PRICE,
  CURRENT_BUY_UNITS,
  TOKEN_ADDRESS,
  RESERVE_ADDRESS,
}

export enum OpcodeTier {
  END,
  VAL,
  DUP,
  ZIPMAP,
  BLOCK_NUMBER,
  BLOCK_TIMESTAMP,
  REPORT,
  NEVER,
  ALWAYS,
  DIFF,
  UPDATE_BLOCKS_FOR_TIER_RANGE,
  SELECT_LTE,
  ACCOUNT,
}

export enum OpcodeEmissionsERC20 {
  SKIP,
  VAL,
  DUP,
  ZIPMAP,
  BLOCK_NUMBER,
  BLOCK_TIMESTAMP,
  THIS_ADDRESS,
  REPORT,
  NEVER,
  ALWAYS,
  SATURATING_DIFF,
  UPDATE_BLOCKS_FOR_TIER_RANGE,
  SELECT_LTE,
  ADD,
  SUB,
  MUL,
  DIV,
  MOD,
  POW,
  MIN,
  MAX,
  SCALE18_MUL,
  SCALE18_DIV,
  SCALE18,
  SCALEN,
  SCALE_BY,
  SCALE18_ONE,
  SCALE18_DECIMALS,
  CLAIMANT_ACCOUNT,
  CONSTRUCTION_BLOCK_NUMBER,
}

export enum SaleStatus {
  PENDING,
  ACTIVE,
  SUCCESS,
  FAIL,
}

export type VMState = StateConfigStruct;

export type State = StateStruct;

interface CRPLibraries {
  [key: string]: string;
  SmartPoolManager: string;
  BalancerSafeMath: string;
  RightsManager: string;
}

interface BasicArtifact {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any[];
  bytecode: string;
}

// A fixed range to Tier Levels
type levelsRange = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// Use the correct type and LEVELS always will be an array with 8 elements
export const LEVELS: string[] = Array.from(Array(8).keys()).map((value) =>
  ethers.BigNumber.from(++value + eighteenZeros).toString()
); // [1,2,3,4,5,6,7,8]

/**
 * Convert an array of BigNumberih to an array to string. This will facilitate the test.
 * **NOTE:** This ONLY will convert the value to the expression in string.
 * @param arr The array of the BigNumberish
 * @returns New array of string with the respected value
 */
export const arrayToString = (arr: BigNumberish[]): string[] => {
  return arr.map((x: BigNumberish) => x.toString());
};

/**
 * Calculate the amount necessary to send or refund for get a `desiredLevel` from `currentLevel` on a TierContract
 * @param desiredLvl Desired TierLevel. Required to be between 0-8
 * @param currentLevel - (Optional) Current TierLevel, by default if Tier.Zero -  Required to be between 0-8
 * @returns The difference of tokens between the acutal level and desired level
 */
export const amountToLevel = (
  desiredLvl: levelsRange,
  currentLevel: levelsRange = 0
): string => {
  if (currentLevel == desiredLvl) {
    return "0";
  }
  const BN = ethers.BigNumber;

  let valueFrom =
    currentLevel == 0 ? BN.from("0") : BN.from(LEVELS[currentLevel - 1]);

  let valueTo =
    desiredLvl == 0 ? BN.from("0") : BN.from(LEVELS[desiredLvl - 1]);

  if (valueFrom.gt(valueTo)) {
    [valueFrom, valueTo] = [valueTo, valueFrom];
  }

  return valueTo.sub(valueFrom).toString();
};

/**
 * Create a fixed number with ethers. This intend to reduce the code and
 * manage the same format different to default one used by ethers
 * @param value - value to convert to fixed number
 * @param format - (optional) fixed number format. By default is fixed128x32
 * @returns a new fixedNumber object that represent the value
 */
export const fixedNumber = (
  value: BigNumber | string | number,
  format = "fixed128x32"
): FixedNumber => {
  return ethers.FixedNumber.from(value, format);
};

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
 * Connect to an existing subgraph deployed in localhost
 * @param subgraphUser Assigned user that deployed the Subgraph
 * @param subgraphName Name of the subgraph
 * @returns connection to subgraph
 */
export const fetchSubgraph = (
  subgraphUser: string,
  subgraphName: string
): ApolloFetch => {
  return createApolloFetch({
    uri: `http://localhost:8000/subgraphs/name/${subgraphUser}/${subgraphName}`,
  });
};

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
    // Function to check if the subgraph is synced
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

    // Periodically check whether the subgraph has synced
    // setTimeout(checkSubgraphSynced, timeDelay * 1000);
    checkSubgraphSynced();
  });

  return resp;
};

// Contracts Management
export const deploy = async (
  artifact: Artifact | BasicArtifact,
  signer: SignerWithAddress,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  argmts: any[] | any
): Promise<Contract> => {
  const iface = new ethers.utils.Interface(artifact.abi);
  const factory = new ethers.ContractFactory(iface, artifact.bytecode, signer);
  const contract = await factory.deploy(...argmts);
  await contract.deployed();
  return contract;
};

export const balancerDeploy = async (
  signer: SignerWithAddress
): Promise<[Contract, Contract]> => {
  const bFactory: Contract = await deploy(BFactory, signer, []);

  const smartPoolManager: Contract = await deploy(SmartPoolManager, signer, []);
  const balancerSafeMath: Contract = await deploy(BalancerSafeMath, signer, []);
  const rightsManager: Contract = await deploy(RightsManager, signer, []);

  const libs: CRPLibraries = {
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

export const factoriesDeploy = async (
  crpFactory: Contract,
  balancerFactory: Contract,
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
 * Get the implementation address correpond to a Factory contract
 * @param factory The factory contract that have the implementation. For ex: a TrustFactory or SaleFactory
 * @returns The implementation address
 */
export const getImplementation = async (factory: Factory): Promise<string> => {
  const { implementation } = (await getEventArgs(
    factory.deployTransaction,
    "Implementation",
    factory
  )) as ImplementationEvent["args"];

  if (!ethers.utils.isAddress(implementation)) {
    throw new Error(
      `invalid implementation address: ${implementation} (${implementation.length} chars)`
    );
  }

  return implementation;
};

/**
 * Get the child address created by a factory contract in the correspond `transaction`
 * @param factory factory The factory contract that create the child. For ex: a TrustFactory or SaleFactory
 * @param transaction Transaction where the child was created
 * @returns Child address
 */
export const getChild = async (
  factory: Factory,
  transaction: ContractTransaction
): Promise<string> => {
  const { child } = (await getEventArgs(
    transaction,
    "NewChild",
    factory
  )) as NewChildEvent["args"];

  if (!ethers.utils.isAddress(child)) {
    throw new Error(`invalid address: ${child} (${child.length} chars)`);
  }

  return child;
};

/**
 * Create a new Trust
 * @param trustFactory - the TrustFactory that will create the child.
 * @param creator - The signer that will create the child and will be connected to
 * @param trustConfig - the trust configuration
 * @param trustRedeemableERC20Config - the Redeemable configuration of this Trust
 * @param trustSeedERC20Config -the Seed configuration of this Trust
 * @param override - (optional) an object that contain properties to edit in the call. For ex: gasLimit or value
 * @returns The trust child
 */
export const trustDeploy = async (
  trustFactory: TrustFactory,
  creator: SignerWithAddress,
  trustConfig: TrustConfigStruct,
  trustRedeemableERC20Config: TrustRedeemableERC20ConfigStruct,
  trustSeedERC20Config: TrustSeedERC20ConfigStruct,
  override: Overrides = {}
): Promise<Trust> => {
  // Creating child
  const txDeploy = await trustFactory
    .connect(creator)
    .createChildTyped(
      trustConfig,
      trustRedeemableERC20Config,
      trustSeedERC20Config,
      override
    );

  const trust = new Trust__factory(creator).attach(
    await getChild(trustFactory, txDeploy)
  );

  await trust.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  trust.deployTransaction = txDeploy;

  return trust;
};

/**
 * Create a new Sale
 * @param saleFactory - the SaleFactory that will create the child.
 * @param creator - The signer that will create the child and will be connected to
 * @param saleConfig - the sale configuration
 * @param saleRedeemableERC20Config - the Redeemable configuration of this Sale
 * @param override - (optional) an object that contain properties to edit in the call. For ex: gasLimit or value
 * @returns The sale child
 */
export const saleDeploy = async (
  saleFactory: SaleFactory,
  creator: SignerWithAddress,
  saleConfig: SaleConfigStruct,
  saleRedeemableERC20Config: SaleRedeemableERC20ConfigStruct,
  override: Overrides = {}
): Promise<Sale> => {
  // Creating child
  const txDeploy = await saleFactory
    .connect(creator)
    .createChildTyped(saleConfig, saleRedeemableERC20Config, override);

  const sale = new Sale__factory(creator).attach(
    await getChild(saleFactory, txDeploy)
  );

  await sale.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  sale.deployTransaction = txDeploy;

  return sale;
};

export const emissionsDeploy = async (
  emissionsERC20Factory: EmissionsERC20Factory,
  creator: SignerWithAddress,
  config: EmissionsERC20ConfigStruct,
  override: Overrides = {}
): Promise<EmissionsERC20> => {
  // Creating child
  const txDeploy = await emissionsERC20Factory
    .connect(creator)
    .createChildTyped(config, override);

  const emissionsERC20 = new EmissionsERC20__factory(creator).attach(
    await getChild(emissionsERC20Factory, txDeploy)
  );

  await emissionsERC20.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  emissionsERC20.deployTransaction = txDeploy;

  return emissionsERC20;
};

/**
 * Create a new Verify contract
 * @param verifyFactory - The Verify Factory
 * @param creator - the signer that will create the Verify
 * @param adminAddress - the verify admin address
 * @param override - (optional) override transaction values as gasLimit
 * @returns The verify child
 */
export const verifyDeploy = async (
  verifyFactory: VerifyFactory,
  creator: SignerWithAddress,
  adminAddress: string,
  override: Overrides = {}
): Promise<Verify> => {
  // Creating child
  const txDeploy = await verifyFactory
    .connect(creator)
    .createChildTyped(adminAddress, override);

  const verify = new Verify__factory(creator).attach(
    await getChild(verifyFactory, txDeploy)
  );

  await verify.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  verify.deployTransaction = txDeploy;

  return verify;
};

export const verifyTierDeploy = async (
  verifyTierFactory: VerifyTierFactory,
  creator: SignerWithAddress,
  verifyAddress: string,
  override: Overrides = {}
): Promise<VerifyTier> => {
  // Creating child
  const verifyTier = (await createChildTyped(
    verifyTierFactory,
    verifyTierJson,
    [verifyAddress, override],
    creator
  )) as VerifyTier & Contract;

  return verifyTier;
};

export const erc20BalanceTierDeploy = async (
  erc20BalanceTierFactory: ERC20BalanceTierFactory,
  creator: SignerWithAddress,
  erc20BalanceTierConfig: ERC20BalanceTierConfigStruct,
  override: Overrides = {}
): Promise<ERC20BalanceTier> => {
  // Creating child
  const txDeploy = await erc20BalanceTierFactory
    .connect(creator)
    .createChildTyped(erc20BalanceTierConfig, override);

  const erc20BalanceTier = new ERC20BalanceTier__factory(creator).attach(
    await getChild(erc20BalanceTierFactory, txDeploy)
  );

  await erc20BalanceTier.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  erc20BalanceTier.deployTransaction = txDeploy;

  return erc20BalanceTier;
};

export const erc20TransferTierDeploy = async (
  erc20TransferTierFactory: ERC20TransferTierFactory,
  creator: SignerWithAddress,
  erc20TransferTierConfigStruct: Parameters<
    ERC20TransferTierFactory["createChildTyped"]
  >[0],
  override: Overrides = {}
): Promise<ERC20TransferTier> => {
  // Creating child
  const erc20TransferTier = (await createChildTyped(
    erc20TransferTierFactory,
    erc20TransferTierJson,
    [erc20TransferTierConfigStruct, override],
    creator
  )) as ERC20TransferTier & Contract;

  return erc20TransferTier;
};

export const combineTierDeploy = async (
  combineTierFactory: CombineTierFactory,
  creator: SignerWithAddress,
  stateConfigStruct: Parameters<CombineTierFactory["createChildTyped"]>[0],
  override: Overrides = {}
): Promise<CombineTier> => {
  // Creating child
  const combineTier = (await createChildTyped(
    combineTierFactory,
    combineTierJson,
    [stateConfigStruct, override],
    creator
  )) as CombineTier & Contract;

  return combineTier;
};

export const erc721BalanceTierDeploy = async (
  erc721BalanceTierFactory: ERC721BalanceTierFactory,
  creator: SignerWithAddress,
  erc721BalanceTierConfigStruct: Parameters<
    ERC721BalanceTierFactory["createChildTyped"]
  >[0],
  override: Overrides = {}
): Promise<ERC721BalanceTier> => {
  // Creating child
  const erc721BalanceTier = (await createChildTyped(
    erc721BalanceTierFactory,
    erc721BalanceTierJson,
    [erc721BalanceTierConfigStruct, override],
    creator
  )) as ERC721BalanceTier & Contract;

  return erc721BalanceTier;
};

export const gatedNFTDeploy = async (
  gatedNFTFactory: GatedNFTFactory,
  creator: SignerWithAddress,
  config: ConfigStruct,
  tier: string,
  minimumStatus: BigNumberish,
  maxPerAddress: BigNumberish,
  transferrable: BigNumberish,
  maxMintable: BigNumberish,
  royaltyRecipient: string,
  royaltyBPS: BigNumberish,
  override: Overrides = {}
): Promise<GatedNFT> => {
  // Creating child
  const txDeploy = await gatedNFTFactory
    .connect(creator)
    .createChildTyped(
      config,
      tier,
      minimumStatus,
      maxPerAddress,
      transferrable,
      maxMintable,
      royaltyRecipient,
      royaltyBPS,
      override
    );

  const gatedNFT = new GatedNFT__factory(creator).attach(
    await getChild(gatedNFTFactory, txDeploy)
  );

  await gatedNFT.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  gatedNFT.deployTransaction = txDeploy;

  return gatedNFT;
};

/**
 * @param factory - the factory that contain the `createChildTyped()` function to create a child.
 * @param childtArtifact - the child artifact that will be created.
 * @param args - the arguments necessaries to create the child. Should be passed inside an array.
 * @param creator - (optional) the signer that will create the child and will be connected to. Same as contractFactory if not provided
 * @returns The child contract connected to the signer
 */
export const createChildTyped = async (
  factory: Contract,
  childtArtifact: Artifact,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
  creator: SignerWithAddress = null
): Promise<Contract> => {
  factory = creator === null ? factory : factory.connect(creator);
  const txDeploy = await factory.createChildTyped(...args);

  const child = (await getContractChild(
    txDeploy,
    factory,
    childtArtifact,
    creator
  )) as Contract;

  return child;
};

/**
 * Get the ConfigurableRightPool and BPool of the a `trust`.
 * - **NOTE:** It is absolutely responsability of the user manage if the DutchAuction already started.
 *   In case that DutchAuction has not started yet, the bPool contract will be connected to a ZeroAddress
 *   and any transaction will be reverted
 * @param trust Trust Contract that will get the CRP and BPool
 * @param signer (optional) The signer that will be connected to the contracts
 * @returns A CRP and BPool contracts
 */
export const poolContracts = async (
  trust: Trust & Contract,
  signer: Signer | SignerWithAddress = null
): Promise<{
  crp: ConfigurableRightsPool & Contract;
  bPool: BPool & Contract;
}> => {
  const crp = new ethers.Contract(
    await trust.crp(),
    ConfigurableRightsPoolJson.abi,
    signer
  ) as ConfigurableRightsPool & Contract;

  const bPool = new ethers.Contract(
    await crp.bPool(),
    BPoolJson.abi,
    signer
  ) as BPool & Contract;

  // ** NOTE WARNING **
  // Can only get the deploy transaction of the CRP because we dont know when
  // the bPool will be created. It is absolutely responsability of the user
  // manage if the DutchAuction already started.

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  crp.deployTransaction = trust.deployTransaction;

  return { crp, bPool };
};

/**
 * Create empty transactions to get a specific blockNumber
 * @param blockNumber amount of block to wait
 */
export const waitForBlock = async (blockNumber: number): Promise<void> => {
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

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      x.topics[0] === contract.filters[eventName]().topics[0] &&
      x.address === (contractAddressOverride || contract.address)
  );

  if (!eventObj) {
    throw new Error(`Could not find event with name ${eventName}`);
  }

  // Return all events indexed and not indexed
  return contract.interface.decodeEventLog(
    eventName,
    eventObj.data,
    eventObj.topics
  );
};

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const wait = 1000;

/**
 * Send empty transactions to mine new blocks
 * @param count (optional) amount of block to be mined. If not provided, will just mine one block
 */
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

/**
 *
 * @param tx - transaction where the child was created
 * @param contractFactory - contract factory that create the child
 * @param contractArtifact - the artifact of the child contract
 * @param signer - (optional) the signer that will be connected the child contract. Same as contractFactory if not provided
 * @param eventName - (optional) the event where the address was emitted. By default "NewChild"
 * @param eventArg - (optional) the arg of the event that contain the address. By default "child"
 * @returns The child contract connected to the signer
 */
export const getContractChild = async (
  tx: ContractTransaction,
  contractFactory: Contract,
  contractArtifact: Artifact,
  signer?: SignerWithAddress,
  eventName = "NewChild",
  eventArg = "child"
): Promise<Contract> => {
  const contractChild = new ethers.Contract(
    ethers.utils.hexZeroPad(
      ethers.utils.hexStripZeros(
        (await getEventArgs(tx, eventName, contractFactory))[eventArg]
      ),
      20 // address bytes length
    ),
    contractArtifact.abi,
    signer || contractFactory.signer
  ) as Contract;

  if (!ethers.utils.isAddress(contractChild.address)) {
    throw new Error(
      `invalid trust address: ${contractChild.address} (${contractChild.address.length} chars)`
    );
  }

  await contractChild.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  contractChild.deployTransaction = tx;

  return contractChild;
};

/**
 * Converts a value to raw bytes representation. Assumes `value` is less than or equal to 1 byte, unless a desired `bytesLength` is specified.
 *
 * @param value - value to convert to raw bytes format
 * @param bytesLength - (defaults to 1) number of bytes to left pad if `value` doesn't completely fill the desired amount of memory. Will throw `InvalidArgument` error if value already exceeds bytes length.
 * @returns {Uint8Array} - raw bytes representation
 */
export function bytify(
  value: number | BytesLike | Hexable,
  bytesLength = 1
): BytesLike {
  return zeroPad(hexlify(value), bytesLength);
}

/**
 * Converts an opcode and operand to bytes, and returns their concatenation.
 * @param code - the opcode
 * @param erand - the operand, currently limited to 1 byte (defaults to 0)
 */
export function op(code: number, erand = 0): Uint8Array {
  return concat([bytify(code), bytify(erand)]);
}

export function encodeStateExpected(vmStateConfig: VMState): State {
  const stackIndex = ethers.BigNumber.from(0);
  const stack = new Array(vmStateConfig.stackLength).fill(
    ethers.BigNumber.from(0)
  );
  const sources = vmStateConfig.sources.map((x) => ethers.utils.hexlify(x));
  const constants = vmStateConfig.constants.map((x) =>
    ethers.BigNumber.from(x)
  );
  const args = new Array(vmStateConfig.argumentsLength).fill(
    ethers.BigNumber.from(0)
  );
  return {
    stackIndex: stackIndex,
    stack: stack,
    sources: sources,
    constants: constants,
    arguments: args,
  };
}

/**
 * Get the block and timestamp of a specific transaction
 * @param tx Transaction that will be use to get the block and timestamp
 * @returns The block and timestamp of the transaction
 */
export const getTxTimeblock = async (
  tx: ContractTransaction
): Promise<[number, number]> => {
  const block = tx.blockNumber;
  const timestamp = (await ethers.provider.getBlock(block)).timestamp;
  return [block, timestamp];
};

/**
 * Basic setup to RedeemableERC20ClainEscrow queries test
 * @param deployer - signer that will deploy the contracts in the basic Setup
 * @param creator - creator of the trust in the basic Setup
 * @param seeder - seeder of the trust in the basic setup
 * @param trustFactory - The trust factory that will be use
 * @param tier - A valid tier contract
 * @returns
 */
export const basicSetup = async (
  deployer: SignerWithAddress,
  creator: SignerWithAddress,
  seeder: SignerWithAddress,
  trustFactory: TrustFactory,
  tier: ReadWriteTier
): Promise<{
  reserve: ReserveTokenTest;
  trust: Trust;
  crp: ConfigurableRightsPool;
  bPool: BPool;
  redeemableERC20: RedeemableERC20;
  minimumTradingDuration: number;
  minimumCreatorRaise: BigNumber;
  successLevel: BigNumber;
}> => {
  const reserve = await new ReserveTokenTest__factory(deployer).deploy();

  const minimumTier = Tier.FOUR;

  const totalTokenSupply = ethers.BigNumber.from("2000" + eighteenZeros);
  const redeemableERC20Config = {
    name: "Token",
    symbol: "TKN",
    distributor: zeroAddress,
    initialSupply: totalTokenSupply,
  };
  const seederUnits = 0;
  const seedERC20Config = {
    name: "SeedToken",
    symbol: "SDT",
    distributor: zeroAddress,
    initialSupply: seederUnits,
  };

  const reserveInit = ethers.BigNumber.from("2000" + sixZeros);
  const redeemInit = ethers.BigNumber.from("2000" + sixZeros);
  const initialValuation = ethers.BigNumber.from("20000" + sixZeros);
  const minimumCreatorRaise = ethers.BigNumber.from("100" + sixZeros);

  const seederFee = ethers.BigNumber.from("100" + sixZeros);
  const seederCooldownDuration = 0;

  const successLevel = reserveInit
    .add(seederFee)
    .add(redeemInit)
    .add(minimumCreatorRaise);

  const minimumTradingDuration = 100;

  const trust = await trustDeploy(
    trustFactory,
    creator,
    {
      creator: creator.address,
      minimumCreatorRaise,
      seederFee,
      redeemInit,
      reserve: reserve.address,
      reserveInit,
      initialValuation,
      finalValuation: successLevel,
      minimumTradingDuration,
    },
    {
      erc20Config: redeemableERC20Config,
      tier: tier.address,
      minimumTier,
    },
    {
      seeder: seeder.address,
      cooldownDuration: seederCooldownDuration,
      erc20Config: seedERC20Config,
    },
    { gasLimit: 15000000 }
  );

  await trust.deployed();

  // seeder needs some cash, give enough to seeder
  await reserve.transfer(seeder.address, reserveInit);

  const reserveSeeder = reserve.connect(seeder);

  const redeemableERC20 = new RedeemableERC20__factory(creator).attach(
    await trust.token()
  );

  // seeder must transfer funds to pool
  await reserveSeeder.transfer(trust.address, reserveInit);

  await trust.startDutchAuction({ gasLimit: 15000000 });

  // crp and bPool are now defined
  const { crp, bPool } = await poolContracts(trust, deployer);

  return {
    reserve,
    trust,
    crp,
    bPool,
    redeemableERC20,
    minimumTradingDuration,
    minimumCreatorRaise,
    successLevel,
  };
};

/**
 * Make a swap of `tokenIn` to `tokenOut` in their valid `bPool`. This function handle that the `signer` have
 * the `spend` amount in the `reserve` before swap, so it is not necessary tranfer outside this function -  just
 * make sure that the connected user to the `tokenIn` have balance
 * @param crp
 * @param bPool
 * @param tokenIn
 * @param tokenOut
 * @param signer
 * @param spend
 */
export const swapReserveForTokens = async (
  crp: ConfigurableRightsPool,
  bPool: BPool,
  tokenIn: Contract,
  tokenOut: RedeemableERC20, // Token Address to out
  signer: SignerWithAddress,
  spend: BigNumber
): Promise<void> => {
  // give to signer some reserve
  await tokenIn.transfer(signer.address, spend);
  await tokenIn.connect(signer).approve(bPool.address, spend);

  const crpSigner = crp.connect(signer);
  const bPoolSigner = bPool.connect(signer);

  await crpSigner.pokeWeights();
  await bPoolSigner.swapExactAmountIn(
    tokenIn.address,
    spend,
    tokenOut.address,
    ethers.BigNumber.from("1"),
    ethers.BigNumber.from("1000000" + sixZeros)
  );
};

export const determineReserveDust = (
  bPoolReserveBalance: BigNumber
): BigNumber => {
  const RESERVE_MIN_BALANCE = ethers.BigNumber.from("1" + sixZeros);
  let dust = bPoolReserveBalance.mul(ONE).div(1e7).div(ONE);
  if (dust.lt(RESERVE_MIN_BALANCE)) {
    dust = RESERVE_MIN_BALANCE;
  }
  return dust;
};

export const afterBlockNumberConfig = (blockNumber: number): VMState => {
  return {
    sources: [
      concat([
        // (BLOCK_NUMBER blockNumberSub1 gt)
        op(OpcodeSale.BLOCK_NUMBER),
        op(OpcodeSale.VAL, 0),
        op(OpcodeSale.GREATER_THAN),
      ]),
    ],
    constants: [blockNumber - 1],
    stackLength: 3,
    argumentsLength: 0,
  };
};

/**
 * Auxiliar function that convert an config that is a VMState to get all their
 * components as string
 * @param config Config on a VMState to convert
 * @returns the configuration with all the components as string
 */
export const convertConfig = (
  config: VMState
): {
  sources: string[];
  constants: string[];
  stackLength: string;
  argumentsLength: string;
} => {
  const sources = config.sources.map((x: BytesLike) => ethers.utils.hexlify(x));
  const constants = config.constants.map((x) => x.toString());
  const stackLength = config.stackLength.toString();
  const argumentsLength = config.argumentsLength.toString();

  return {
    sources,
    constants,
    stackLength,
    argumentsLength,
  };
};
