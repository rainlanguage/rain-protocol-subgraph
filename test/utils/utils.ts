import { ethers } from "hardhat";
import { Result, concat, hexlify, Hexable, zeroPad } from "ethers/lib/utils";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

import { createApolloFetch, ApolloFetch } from "apollo-fetch";
import type { Artifact } from "hardhat/types";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type {
  Contract,
  Signer,
  BigNumberish,
  BigNumber,
  FixedNumber,
  ContractTransaction,
  BytesLike,
  Overrides,
} from "ethers";

// Typechain rain factories
import { Sale__factory } from "../../typechain/factories/Sale__factory";
import { GatedNFT__factory } from "../../typechain/factories/GatedNFT__factory";
import { EmissionsERC20__factory } from "../../typechain/factories/EmissionsERC20__factory";
import { Verify__factory } from "../../typechain/factories/Verify__factory";
import { VerifyTier__factory } from "../../typechain/factories/VerifyTier__factory";
import { ERC20BalanceTier__factory } from "../../typechain/factories/ERC20BalanceTier__factory";
import { ERC20TransferTier__factory } from "../../typechain/factories/ERC20TransferTier__factory";
import { CombineTier__factory } from "../../typechain/factories/CombineTier__factory";
import { ERC721BalanceTier__factory } from "../../typechain/factories/ERC721BalanceTier__factory";

// A fixed range to Tier Levels
type levelsRange = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// Factory types
import type {
  Factory,
  ImplementationEvent,
  NewChildEvent,
} from "../../typechain/Factory";

// VMState types
import type { StateConfigStruct } from "../../typechain/VMStateBuilder";
export type VMState = StateConfigStruct;
export type State = StateConfigStruct;

// SaleFactory types
import type {
  SaleFactory,
  SaleConfigStruct,
  SaleRedeemableERC20ConfigStruct,
} from "../../typechain/SaleFactory";
import type { Sale } from "../../typechain/Sale";

// EmissionsERC20Factory types
import type {
  EmissionsERC20Factory,
  EmissionsERC20ConfigStruct,
} from "../../typechain/EmissionsERC20Factory";
import type { EmissionsERC20 } from "../../typechain/EmissionsERC20";

// GatedNFTFactory types
import type {
  GatedNFTFactory,
  ConfigStruct,
} from "../../typechain/GatedNFTFactory";
import type { GatedNFT } from "../../typechain/GatedNFT";

// VerifyFactory types
import type {
  VerifyFactory,
  VerifyConfigStruct,
} from "../../typechain/VerifyFactory";
import type { Verify } from "../../typechain/Verify";

// VerifyTierFactory types
import type { VerifyTierFactory } from "../../typechain/VerifyTierFactory";
import type { VerifyTier } from "../../typechain/VerifyTier";

// ERC20BalanceTierFactory types
import type {
  ERC20BalanceTierFactory,
  ERC20BalanceTierConfigStruct,
} from "../../typechain/ERC20BalanceTierFactory";
import type { ERC20BalanceTier } from "../../typechain/ERC20BalanceTier";

// ERC20TransferTierFactory types
import type {
  ERC20TransferTierFactory,
  ERC20TransferTierConfigStruct,
} from "../../typechain/ERC20TransferTierFactory";
import type { ERC20TransferTier } from "../../typechain/ERC20TransferTier";

// CombineTierFactory types
import type { CombineTierFactory } from "../../typechain/CombineTierFactory";
import type { CombineTier } from "../../typechain/CombineTier";

// ERC721BalanceTierFactory types
import type {
  ERC721BalanceTierFactory,
  ERC721BalanceTierConfigStruct,
} from "../../typechain/ERC721BalanceTierFactory";
import type { ERC721BalanceTier } from "../../typechain/ERC721BalanceTier";

// Interfaces
interface SyncedSubgraphType {
  synced: boolean;
}

interface BasicArtifact {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any[];
  bytecode: string;
}

// Helper values
export const sixZeros = "000000";
export const sixteenZeros = "0000000000000000";
export const eighteenZeros = "000000000000000000";

export const zeroAddress = ethers.constants.AddressZero;

// BigNumbers
export const ONE = ethers.BigNumber.from("1" + eighteenZeros);
export const RESERVE_ONE = ethers.BigNumber.from("1" + sixZeros);

// Fixed number (Decimal)
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

// Opcodes
export enum AllStandardOps {
  CONSTANT,
  STACK,
  CONTEXT,
  STORAGE,
  ZIPMAP,
  DEBUG,
  BLOCK_NUMBER,
  BLOCK_TIMESTAMP,
  SENDER,
  THIS_ADDRESS,
  SCALE18_MUL,
  SCALE18_DIV,
  SCALE18,
  SCALEN,
  SCALE_BY,
  ADD,
  SATURATING_ADD,
  SUB,
  SATURATING_SUB,
  MUL,
  SATURATING_MUL,
  DIV,
  MOD,
  EXP,
  MIN,
  MAX,
  ISZERO,
  EAGER_IF,
  EQUAL_TO,
  LESS_THAN,
  GREATER_THAN,
  EVERY,
  ANY,
  REPORT,
  SATURATING_DIFF,
  UPDATE_BLOCKS_FOR_TIER_RANGE,
  SELECT_LTE,
  IERC20_BALANCE_OF,
  IERC20_TOTAL_SUPPLY,
  IERC721_BALANCE_OF,
  IERC721_OWNER_OF,
  IERC1155_BALANCE_OF,
  IERC1155_BALANCE_OF_BATCH,
  length,
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

// Enum that represent the SaleStatus (Sale)
export enum SaleStatus {
  PENDING,
  ACTIVE,
  SUCCESS,
  FAIL,
}

/**
 * Return the Levels tier used by default. LEVELS always will be an array with 8 elements to
 * correspond to the 8 TierLevels
 */
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
 * @param currentLevel (Optional) Current TierLevel, by default if Tier.Zero -  Required to be between 0-8
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
 * @param value value to convert to fixed number
 * @param format (optional) fixed number format. By default is fixed128x32
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
 * @param subgraphName Name of the subgraph
 * @returns connection to subgraph
 */
export const fetchSubgraph = (subgraphName: string): ApolloFetch => {
  return createApolloFetch({
    uri: `http://localhost:8000/subgraphs/name/${subgraphName}`,
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
  seconds = 60,
  subgraphName = "beehive-innovation/rain-protocol-test"
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
              indexingStatusForCurrentVersion(subgraphName: "${subgraphName}") {
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

        if (e instanceof TypeError) {
          reject(
            new Error(
              `${e.message} - Check that the subgraphName provided is correct.`
            )
          );
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
  signer: SignerWithAddress | Signer,
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
 * Create a new Sale
 * @param saleFactory the SaleFactory that will create the child.
 * @param creator The signer that will create the child and will be connected to
 * @param saleConfig the sale configuration
 * @param saleRedeemableERC20Config the Redeemable configuration of this Sale
 * @param override (optional) an object that contain properties to edit in the call. For ex: gasLimit or value
 * @returns The sale child
 */
export const saleDeploy = async (
  saleFactory: SaleFactory,
  creator: SignerWithAddress | Signer,
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

/**
 * Create a new EmissionsERC20 contract
 * @param emissionsERC20Factory The EmissionsERC20Factory that will create the child.
 * @param creator The signer that will create the child and will be connected to
 * @param config the emissionsERC20 configuration
 * @param override override (optional) an object that contain properties to edit in the call. For ex: gasLimit or value
 * @returns The EmissionsERC20 child
 */
export const emissionsDeploy = async (
  emissionsERC20Factory: EmissionsERC20Factory,
  creator: SignerWithAddress | Signer,
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
 * @param verifyFactory The Verify Factory
 * @param creator The signer that will create the child and will be connected to
 * @param adminAddress The verify admin address
 * @param override (optional) an object that contain properties to edit in the call. For ex: gasLimit or value
 * @returns The verify child
 */
export const verifyDeploy = async (
  verifyFactory: VerifyFactory,
  creator: SignerWithAddress | Signer,
  verifyConfig: VerifyConfigStruct,
  override: Overrides = {}
): Promise<Verify> => {
  // Creating child
  const txDeploy = await verifyFactory
    .connect(creator)
    .createChildTyped(verifyConfig, override);

  const verify = new Verify__factory(creator).attach(
    await getChild(verifyFactory, txDeploy)
  );

  await verify.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  verify.deployTransaction = txDeploy;

  return verify;
};

/**
 * Create a new VerifyTier contract
 * @param verifyTierFactory The VerifyTier Factory
 * @param creator The signer that will create the child and will be connected to
 * @param verifyAddress The verify address
 * @param override (optional) an object that contain properties to edit in the call. For ex: gasLimit or value
 * @returns The verifyTier child
 */
export const verifyTierDeploy = async (
  verifyTierFactory: VerifyTierFactory,
  creator: SignerWithAddress | Signer,
  verifyAddress: string,
  override: Overrides = {}
): Promise<VerifyTier> => {
  // Creating child
  const txDeploy = await verifyTierFactory
    .connect(creator)
    .createChildTyped(verifyAddress, override);

  const verifyTier = new VerifyTier__factory(creator).attach(
    await getChild(verifyTierFactory, txDeploy)
  );

  await verifyTier.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  verifyTier.deployTransaction = txDeploy;

  return verifyTier;
};

/**
 * Create a new ERC20BalanceTier contract
 * @param erc20BalanceTierFactory The ERC20BalanceTier Factory
 * @param creator The signer that will create the child and will be connected to
 * @param erc20BalanceTierConfig The ERC20BalanceTier configuration
 * @param override (optional) an object that contain properties to edit in the call. For ex: gasLimit or value
 * @returns The erc20BalanceTier child
 */
export const erc20BalanceTierDeploy = async (
  erc20BalanceTierFactory: ERC20BalanceTierFactory,
  creator: SignerWithAddress | Signer,
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

/**
 * Create a new ERC20TransferTier contract
 * @param erc20TransferTierFactory The ERC20TransferTier Factory
 * @param creator The signer that will create the child and will be connected to
 * @param erc20TransferTierConfigStruct The ERC20TransferTier configuration
 * @param override (optional) an object that contain properties to edit in the call. For ex: gasLimit or value
 * @returns The erc20TransferTier child
 */
export const erc20TransferTierDeploy = async (
  erc20TransferTierFactory: ERC20TransferTierFactory,
  creator: SignerWithAddress | Signer,
  erc20TransferTierConfigStruct: ERC20TransferTierConfigStruct,
  override: Overrides = {}
): Promise<ERC20TransferTier> => {
  // Creating child
  const txDeploy = await erc20TransferTierFactory
    .connect(creator)
    .createChildTyped(erc20TransferTierConfigStruct, override);

  const erc20TransferTier = new ERC20TransferTier__factory(creator).attach(
    await getChild(erc20TransferTierFactory, txDeploy)
  );

  await erc20TransferTier.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  erc20TransferTier.deployTransaction = txDeploy;

  return erc20TransferTier;
};

/**
 * Create a new CombineTier contract
 * @param combineTierFactory The CombineTier Factory
 * @param creator The signer that will create the child and will be connected to
 * @param stateConfigStruct The CombineTier configuration
 * @param override (optional) an object that contain properties to edit in the call. For ex: gasLimit or value
 * @returns The combineTier child
 */
export const combineTierDeploy = async (
  combineTierFactory: CombineTierFactory,
  creator: SignerWithAddress | Signer,
  stateConfigStruct: StateConfigStruct,
  override: Overrides = {}
): Promise<CombineTier> => {
  // Creating child
  const txDeploy = await combineTierFactory
    .connect(creator)
    .createChildTyped(stateConfigStruct, override);

  const combineTier = new CombineTier__factory(creator).attach(
    await getChild(combineTierFactory, txDeploy)
  );

  await combineTier.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  combineTier.deployTransaction = txDeploy;

  return combineTier;
};

/**
 * Create a new ERC721BalanceTier contract
 * @param erc721BalanceTierFactory The ERC721BalanceTier Factory
 * @param creator The signer that will create the child and will be connected to
 * @param erc721BalanceTierConfigStruct The ERC721BalanceTier configuration
 * @param override (optional) an object that contain properties to edit in the call. For ex: gasLimit or value
 * @returns The erc721BalanceTier child
 */
export const erc721BalanceTierDeploy = async (
  erc721BalanceTierFactory: ERC721BalanceTierFactory,
  creator: SignerWithAddress | Signer,
  erc721BalanceTierConfigStruct: ERC721BalanceTierConfigStruct,
  override: Overrides = {}
): Promise<ERC721BalanceTier> => {
  // Creating child
  const txDeploy = await erc721BalanceTierFactory
    .connect(creator)
    .createChildTyped(erc721BalanceTierConfigStruct, override);

  const erc721BalanceTier = new ERC721BalanceTier__factory(creator).attach(
    await getChild(erc721BalanceTierFactory, txDeploy)
  );

  await erc721BalanceTier.deployed();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  erc721BalanceTier.deployTransaction = txDeploy;

  return erc721BalanceTier;
};

/**
 * Create a new GatedNFT contract
 * @param gatedNFTFactory The GatedNFT Factory
 * @param creator The signer that will create the child and will be connected to
 * @param config The ERC721BalanceTier configuratio
 * @param tier The tier contract address
 * @param minimumStatus The minimum TierLevel to mint
 * @param maxPerAddress The max mint allowed per address
 * @param transferrable Allow transfer the NFT
 * @param maxMintable The total max allowed to mint
 * @param royaltyRecipient The royalty recipient address
 * @param royaltyBPS The royaltyBPS
 * @param override (optional) an object that contain properties to edit in the call. For ex: gasLimit or value
 * @returns The gatedNFT child
 */
export const gatedNFTDeploy = async (
  gatedNFTFactory: GatedNFTFactory,
  creator: SignerWithAddress | Signer,
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
 * Send empty transactions to mine new blocks. Mainly used in HH network
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
 * Wait until reach an specific blockNumber, useful to live networks. ** Note:** since HH network increase
 * block when mined, try calling `createEmptyBlock` insted
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

  await delay(2000);

  return await waitForBlock(blockNumber);
};

/**
 * Create a promise to wait a determinated `ms`
 * @param ms Amount of time to wait in miliseconds
 */
export function delay(ms: number): Promise<void> {
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
 * @param tx transaction where event occurs
 * @param eventName name of event
 * @param contract contract object holding the address, filters, interface
 * @param contractAddressOverride (optional) override the contract address which emits this event
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

export const wait = 1000;

/**
 * Converts a value to raw bytes representation. Assumes `value` is less than or equal to 1 byte, unless a desired `bytesLength` is specified.
 * @param value value to convert to raw bytes format
 * @param bytesLength (defaults to 1) number of bytes to left pad if `value` doesn't completely fill the desired amount of memory. Will throw `InvalidArgument` error if value already exceeds bytes length.
 * @returns {Uint8Array} raw bytes representation
 */
export function bytify(
  value: number | BytesLike | Hexable,
  bytesLength = 1
): BytesLike {
  return zeroPad(hexlify(value), bytesLength);
}

/**
 * Converts an opcode and operand to bytes, and returns their concatenation.
 * @param code the opcode
 * @param erand the operand, currently limited to 1 byte (defaults to 0)
 */
export function op(code: number, erand = 0): Uint8Array {
  return concat([bytify(code), bytify(erand)]);
}

/**
 * Convert a VMState to an State. This replicate the creationg made it by VMState contract
 * @param vmStateConfig The VMState configuration to convert
 * @returns The new State created from the VMState configuration
 */
export function encodeStateExpected(vmStateConfig: VMState): State {
  const sources = vmStateConfig.sources.map((x) => ethers.utils.hexlify(x));
  const constants = vmStateConfig.constants.map((x) =>
    ethers.BigNumber.from(x)
  );

  return {
    sources: sources,
    constants: constants,
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
 * Convert an config that is a VMState to get all their components as string. Useful to testing
 * @param config Config on a VMState to convert
 * @returns the configuration with all the components as string
 */
export const convertConfig = (
  config: VMState
): {
  sources: string[];
  constants: string[];
} => {
  const sources = config.sources.map((x: BytesLike) => ethers.utils.hexlify(x));
  const constants = config.constants.map((x) => x.toString());

  return {
    sources,
    constants,
  };
};

export const afterBlockNumberSource = (constant: number): Uint8Array => {
  // prettier-ignore
  return concat([
    // (BLOCK_NUMBER blockNumberSub1 gt)
      op(AllStandardOps.BLOCK_NUMBER),
      op(AllStandardOps.CONSTANT, constant),
    op(AllStandardOps.GREATER_THAN),
  ]);
};

export const betweenBlockNumbersSource = (
  vStart: Uint8Array,
  vEnd: Uint8Array
): Uint8Array => {
  // prettier-ignore
  return concat([
        op(AllStandardOps.BLOCK_NUMBER),
        vStart,
      op(AllStandardOps.GREATER_THAN),
        op(AllStandardOps.BLOCK_NUMBER),
        vEnd,
      op(AllStandardOps.LESS_THAN),
    op(AllStandardOps.EVERY, 2),
  ])
};
