import {
  Contract,
  Signer,
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

// Rain protocol contracts Artifacts
import RedeemableERC20FactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20Factory.sol/RedeemableERC20Factory.json";
import SeedERC20FactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/seed/SeedERC20Factory.sol/SeedERC20Factory.json";
import TrustFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/trust/TrustFactory.sol/TrustFactory.json";

import TrustJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/trust/Trust.sol/Trust.json";
import SaleJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/sale/Sale.sol/Sale.json";
import verifyJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/verify/Verify.sol/Verify.json";
import reserveToken from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveTokenTest.sol/ReserveTokenTest.json";
import redeemableTokenJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json";

// Types
import { ERC20BalanceTierFactory } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTierFactory";
import { ERC20TransferTierFactory } from "@beehiveinnovation/rain-protocol/typechain/ERC20TransferTierFactory";
import { CombineTierFactory } from "@beehiveinnovation/rain-protocol/typechain/CombineTierFactory";
import { VerifyTierFactory } from "@beehiveinnovation/rain-protocol/typechain/VerifyTierFactory";
import { VerifyFactory } from "@beehiveinnovation/rain-protocol/typechain/VerifyFactory";

import { RedeemableERC20Factory } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20Factory";
import { SeedERC20Factory } from "@beehiveinnovation/rain-protocol/typechain/SeedERC20Factory";
import { TrustFactory } from "@beehiveinnovation/rain-protocol/typechain/TrustFactory";
import { SaleFactory } from "@beehiveinnovation/rain-protocol/typechain/SaleFactory";

import { ERC20BalanceTier } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTier";
import { ERC20TransferTier } from "@beehiveinnovation/rain-protocol/typechain/ERC20TransferTier";
import { CombineTier } from "@beehiveinnovation/rain-protocol/typechain/CombineTier";
import { VerifyTier } from "@beehiveinnovation/rain-protocol/typechain/VerifyTier";
import { Verify } from "@beehiveinnovation/rain-protocol/typechain/Verify";
import { ReadWriteTier } from "@beehiveinnovation/rain-protocol/typechain/ReadWriteTier";
import { RedeemableERC20 } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20";
import { ReserveTokenTest } from "@beehiveinnovation/rain-protocol/typechain/ReserveTokenTest";

import type { ConfigurableRightsPool } from "@beehiveinnovation/rain-protocol/typechain/ConfigurableRightsPool";
import type { BPool } from "@beehiveinnovation/rain-protocol/typechain/BPool";
import type {
  Trust,
  TrustConfigStruct,
  TrustRedeemableERC20ConfigStruct,
  TrustSeedERC20ConfigStruct,
} from "@beehiveinnovation/rain-protocol/typechain/Trust";

import type {
  Sale,
  SaleConfigStruct,
  SaleRedeemableERC20ConfigStruct,
} from "@beehiveinnovation/rain-protocol/typechain/Sale";

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

export interface VMState {
  sources: Uint8Array[];
  constants: BigNumber[];
  stackLength: number;
  argumentsLength: number;
}

interface State {
  stackIndex: BigNumber;
  stack: BigNumber[];
  sources: BytesLike[];
  constants: BigNumber[];
  arguments: BigNumber[];
}

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

export const LEVELS = Array.from(Array(8).keys()).map((value) =>
  ethers.BigNumber.from(++value + eighteenZeros).toString()
); // [1,2,3,4,5,6,7,8]

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

// Execute Child Processes
const srcDir = path.join(__dirname, "..");
export const exec = (cmd: string): string | Buffer => {
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

export const fetchSubgraph = (
  subgraphUser: string,
  subgraphName: string
): ApolloFetch => {
  return createApolloFetch({
    uri: `http://localhost:8000/subgraphs/name/${subgraphUser}/${subgraphName}`,
  });
};

/**
 * Function that wait until the Subgraph index the current block in the network
 * @param delay - (optional: 1000ms by default) Time between queries to Subgraph about sync
 */
export const waitForSubgraphToBeSynced = async (
  delay = 1000
): Promise<SyncedSubgraphType> =>
  new Promise<{ synced: boolean }>((resolve, reject) => {
    // Wait for 5s
    const deadline = Date.now() + 30 * 1000;

    let currentBlock: number;
    ethers.provider.getBlockNumber().then((x) => (currentBlock = x));

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
        const blocksSG = result.data.indexingStatusForCurrentVersion.chains[0];
        if (
          result.data.indexingStatusForCurrentVersion.synced === true &&
          blocksSG.latestBlock.number == currentBlock
        ) {
          resolve({ synced: true });
        } else {
          throw new Error(`subgraph is not sync`);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown Error";
        if (message.includes("connect ECONNREFUSED")) {
          reject(new Error(`Unable to connect to Subgraph node: ${message}`));
        }

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
  const redeemableERC20Factory = (await deploy(
    RedeemableERC20FactoryJson,
    signer,
    []
  )) as RedeemableERC20Factory;

  const seedERC20Factory = (await deploy(
    SeedERC20FactoryJson,
    signer,
    []
  )) as SeedERC20Factory;

  const TrustFactoryArgs = {
    redeemableERC20Factory: redeemableERC20Factory.address,
    seedERC20Factory: seedERC20Factory.address,
    crpFactory: crpFactory.address,
    balancerFactory: balancerFactory.address,
    creatorFundsReleaseTimeout: CREATOR_FUNDS_RELEASE_TIMEOUT_TESTING,
    maxRaiseDuration: MAX_RAISE_DURATION_TESTING,
  };

  const iface = new ethers.utils.Interface(TrustFactoryJson.abi);
  const trustFactoryFactory = new ethers.ContractFactory(
    iface,
    TrustFactoryJson.bytecode,
    signer
  );
  const trustFactory = (await trustFactoryFactory.deploy(
    TrustFactoryArgs
  )) as TrustFactory;
  await trustFactory.deployed();
  return {
    redeemableERC20Factory,
    seedERC20Factory,
    trustFactory,
  };
};

/**
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
  // Creating the trust contract child
  const trust = (await createChildTyped(
    trustFactory,
    TrustJson,
    [trustConfig, trustRedeemableERC20Config, trustSeedERC20Config, override],
    creator
  )) as Trust & Contract;

  return trust;
};

/**
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
  // Creating the sale contract child
  const sale = (await createChildTyped(
    saleFactory,
    SaleJson,
    [saleConfig, saleRedeemableERC20Config, override],
    creator
  )) as Sale & Contract;

  return sale;
};

/**
 * @param verifyFactory - The Verify Factory
 * @param creator - the signer that will create the Verify
 * @param adminAddress - the verify admin address
 * @param override - (optional) override transaction values as gasLimit
 * @returns
 */
export const verifyDeploy = async (
  verifyFactory: VerifyFactory,
  creator: SignerWithAddress,
  adminAddress: string,
  override: Overrides = {}
): Promise<Verify> => {
  // Creating child
  const verify = (await createChildTyped(
    verifyFactory,
    verifyJson,
    [adminAddress, override],
    creator
  )) as Verify & Contract;

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
    verifyJson,
    [verifyAddress, override],
    creator
  )) as VerifyTier & Contract;

  return verifyTier;
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

export const poolContracts = async (
  signer: Signer | SignerWithAddress,
  trust: Trust & Contract
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

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  crp.deployTransaction = trust.deployTransaction;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  bPool.deployTransaction = trust.deployTransaction;

  return { crp, bPool };
};

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

export const fetchFile = (_path: string): string => {
  try {
    return fs.readFileSync(_path).toString();
  } catch (error) {
    console.log(error);
    return "";
  }
};

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

  const iface = contract.interface;
  if (eventObj.data !== "0x") {
    return iface.decodeEventLog(eventName, eventObj.data);
  } else {
    return iface.decodeEventLog(eventName, eventObj.data, eventObj.topics);
  }
};

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const wait = 1000;

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
  trustFactory: TrustFactory & Contract,
  tier: ReadWriteTier & Contract
): Promise<{
  reserve: ReserveTokenTest;
  trust: Trust;
  crp: ConfigurableRightsPool & Contract;
  bPool: BPool & Contract;
  redeemableERC20: RedeemableERC20;
  minimumTradingDuration: number;
  minimumCreatorRaise: BigNumber;
  successLevel: BigNumber;
}> => {
  const reserve = (await deploy(
    reserveToken,
    deployer,
    []
  )) as ReserveTokenTest;

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

  const trustFactory1 = trustFactory.connect(deployer);

  const trust = await trustDeploy(
    trustFactory1,
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

  const reserveSeeder = new ethers.Contract(
    reserve.address,
    reserve.interface,
    seeder
  ) as ReserveTokenTest & Contract;

  const redeemableERC20Address = await trust.token();

  const redeemableERC20 = new ethers.Contract(
    redeemableERC20Address,
    redeemableTokenJson.abi,
    creator
  ) as RedeemableERC20 & Contract;

  // seeder must transfer funds to pool
  await reserveSeeder.transfer(trust.address, reserveInit);

  await trust.startDutchAuction({ gasLimit: 15000000 });

  // crp and bPool are now defined
  const { crp, bPool } = await poolContracts(deployer, trust);

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

export const uint8ArrayToHex = (array: Uint8Array): string => {
  let str = "0x";
  array.forEach((element) => {
    const hex = parseInt(element.toString(), 10).toString(16);
    if (hex.length < 2) {
      str = str + ("0" + hex);
    } else {
      str = str + hex;
    }
  });
  return str;
};
