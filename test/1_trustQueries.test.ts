/* eslint-disable node/no-missing-import */
/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */

import { expect } from "chai";
import { ethers } from "hardhat";
import { ApolloFetch, FetchResult } from "apollo-fetch";
import * as path from "path";

import * as Util from "./utils/utils";
import {
  deploy,
  waitForSubgraphToBeSynced,
  Tier,
  sixZeros,
  eighteenZeros,
  LEVELS,
  getTxTimeblock,
  getContractChild,
} from "./utils/utils";

// Artifacts
import reserveTokenJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveTokenTest.sol/ReserveTokenTest.json";
import readWriteTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ReadWriteTier.sol/ReadWriteTier.json";
import seedERC20Json from "@beehiveinnovation/rain-protocol/artifacts/contracts/seed/SeedERC20.sol/SeedERC20.json";
import redeemableTokenJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json";
import configurableRightsPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/ConfigurableRightsPool.json";
import bPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/BPool.json";
import bPoolFeeEscrowJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/escrow/BPoolFeeEscrow.sol/BPoolFeeEscrow.json";
import TrustJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/trust/Trust.sol/Trust.json";

import erc20BalanceTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20BalanceTierFactory.sol/ERC20BalanceTierFactory.json";
import erc20TransferTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20TransferTierFactory.sol/ERC20TransferTierFactory.json";
import combineTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/CombineTierFactory.sol/CombineTierFactory.json";
import verifyTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/VerifyTierFactory.sol/VerifyTierFactory.json";
import verifyFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/verify/VerifyFactory.sol/VerifyFactory.json";
import saleFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/sale/SaleFactory.sol/SaleFactory.json";
import gatedNFTFactoryJson from "@beehiveinnovation/rain-statusfi/artifacts/contracts/GatedNFTFactory.sol/GatedNFTFactory.json";
import redeemableERC20ClaimEscrowJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/escrow/RedeemableERC20ClaimEscrow.sol/RedeemableERC20ClaimEscrow.json";
import erc20BalanceTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20BalanceTier.sol/ERC20BalanceTier.json";

// Types
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type {
  BigNumber,
  Contract,
  ContractTransaction,
  ContractReceipt,
} from "ethers";

import { BFactory } from "@beehiveinnovation/rain-protocol/typechain/BFactory";
import { CRPFactory } from "@beehiveinnovation/rain-protocol/typechain/CRPFactory";
import { RedeemableERC20Factory } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20Factory";
import { SeedERC20Factory } from "@beehiveinnovation/rain-protocol/typechain/SeedERC20Factory";
import { TrustFactory } from "@beehiveinnovation/rain-protocol/typechain/TrustFactory";

import { ERC20BalanceTierFactory } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTierFactory";
import { ERC20TransferTierFactory } from "@beehiveinnovation/rain-protocol/typechain/ERC20TransferTierFactory";
import { CombineTierFactory } from "@beehiveinnovation/rain-protocol/typechain/CombineTierFactory";
import { VerifyTierFactory } from "@beehiveinnovation/rain-protocol/typechain/VerifyTierFactory";
import { VerifyFactory } from "@beehiveinnovation/rain-protocol/typechain/VerifyFactory";
import { SaleFactory } from "@beehiveinnovation/rain-protocol/typechain/SaleFactory";
import { GatedNFTFactory } from "@beehiveinnovation/rain-statusfi/typechain/GatedNFTFactory";
import { RedeemableERC20ClaimEscrow } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20ClaimEscrow";

import { ReserveTokenTest } from "@beehiveinnovation/rain-protocol/typechain/ReserveTokenTest";
import { Trust } from "@beehiveinnovation/rain-protocol/typechain/Trust";
import { ReadWriteTier } from "@beehiveinnovation/rain-protocol/typechain/ReadWriteTier";
import { SeedERC20 } from "@beehiveinnovation/rain-protocol/typechain/SeedERC20";
import { RedeemableERC20 } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20";
import { ConfigurableRightsPool } from "@beehiveinnovation/rain-protocol/typechain/ConfigurableRightsPool";
import { BPool } from "@beehiveinnovation/rain-protocol/typechain/BPool";
import { BPoolFeeEscrow } from "@beehiveinnovation/rain-protocol/typechain/BPoolFeeEscrow";
import { ERC20BalanceTier } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTier";

// Should update path after a new commit
import erc721BalanceTierFactoryJson from "@vishalkale15107/rain-protocol/artifacts/contracts/tier/ERC721BalanceTierFactory.sol/ERC721BalanceTierFactory.json";
import { ERC721BalanceTierFactory } from "@vishalkale15107/rain-protocol/typechain/ERC721BalanceTierFactory";
import erc721TokenTestJson from "@vishalkale15107/rain-protocol/artifacts/@openzeppelin/contracts/token/ERC721/ERC721.sol/ERC721.json";
import { ERC721 } from "@vishalkale15107/rain-protocol/typechain/ERC721";

import {
  getContracts,
  getFactories,
  getTrust,
  NOTICE_QUERY,
  QUERY,
} from "./utils/queries";

enum DistributionStatus {
  Pending,
  Seeded,
  Trading,
  TradingCanEnd,
  Success,
  Fail,
}

const subgraphUser = "vishalkale151071";
const subgraphName = "rain-protocol";
let subgraph: ApolloFetch,
  minimumTier: Tier,
  currentBlock: number,
  seedContract: SeedERC20,
  redeemableERC20Contract: RedeemableERC20,
  trust: Trust,
  crpContract: ConfigurableRightsPool,
  bPoolContract: BPool,
  reserve: ReserveTokenTest, // ERC20
  erc721Test: ERC721,
  erc20BalanceTier: ERC20BalanceTier,
  transaction: ContractTransaction; // use to save/facilite a tx

// Export Factories
export let seedERC20Factory: SeedERC20Factory,
  redeemableERC20Factory: RedeemableERC20Factory,
  trustFactory: TrustFactory,
  bPoolFeeEscrow: BPoolFeeEscrow,
  bFactory: BFactory,
  crpFactory: CRPFactory,
  verifyFactory: VerifyFactory,
  verifyTierFactory: VerifyTierFactory,
  erc20BalanceTierFactory: ERC20BalanceTierFactory,
  erc20TransferTierFactory: ERC20TransferTierFactory,
  combineTierFactory: CombineTierFactory,
  erc721BalanceTierFactory: ERC721BalanceTierFactory,
  saleFactory: SaleFactory,
  gatedNFTFactory: GatedNFTFactory,
  redeemableERC20ClaimEscrow: RedeemableERC20ClaimEscrow;

// Export signers
export let deployer: SignerWithAddress,
  creator: SignerWithAddress,
  seeder1: SignerWithAddress,
  seeder2: SignerWithAddress,
  signer1: SignerWithAddress,
  signer2: SignerWithAddress,
  admin: SignerWithAddress;

describe("Subgraph Trusts Test", function () {
  before(async function () {
    const signers = await ethers.getSigners();

    // Signers (to avoid fetch again)
    deployer = signers[0]; // deployer is not creator
    creator = signers[1];
    seeder1 = signers[2];
    seeder2 = signers[3];
    signer1 = signers[4];
    signer2 = signers[5];
    admin = signers[9];

    [crpFactory, bFactory] = (await Util.balancerDeploy(deployer)) as [
      CRPFactory,
      BFactory
    ];

    erc721Test = (await deploy(erc721TokenTestJson, deployer, [
      "TokenERC721",
      "T721",
    ])) as ERC721;

    reserve = (await deploy(
      reserveTokenJson,
      deployer,
      []
    )) as ReserveTokenTest;

    ({ trustFactory, redeemableERC20Factory, seedERC20Factory } =
      await Util.factoriesDeploy(crpFactory, bFactory, deployer));
    currentBlock = trustFactory.deployTransaction.blockNumber;

    // Getting the bPoolScrow from Trust Implementation
    const trustImplementation = (
      await Util.getEventArgs(
        trustFactory.deployTransaction,
        "Implementation",
        trustFactory
      )
    ).implementation;

    bPoolFeeEscrow = (await Util.getContractChild(
      trustFactory.deployTransaction,
      new ethers.Contract(trustImplementation, TrustJson.abi, deployer),
      bPoolFeeEscrowJson,
      deployer,
      "Construction", // It is a different event that emit the address
      "bPoolFeeEscrow" // It is a different event arg that contain the address
    )) as BPoolFeeEscrow;

    // Verify factory
    verifyFactory = (await deploy(
      verifyFactoryJson,
      deployer,
      []
    )) as VerifyFactory;
    const verifyFactoryBlock = verifyFactory.deployTransaction.blockNumber;

    // Tiers factories
    erc20BalanceTierFactory = (await deploy(
      erc20BalanceTierFactoryJson,
      deployer,
      []
    )) as ERC20BalanceTierFactory;
    const erc20BalanceTierFactoryBlock =
      erc20BalanceTierFactory.deployTransaction.blockNumber;

    erc20TransferTierFactory = (await deploy(
      erc20TransferTierFactoryJson,
      deployer,
      []
    )) as ERC20TransferTierFactory;
    const erc20TransferTierFactoryBlock =
      erc20TransferTierFactory.deployTransaction.blockNumber;

    combineTierFactory = (await deploy(
      combineTierFactoryJson,
      deployer,
      []
    )) as CombineTierFactory;
    const combineTierFactoryBlock =
      combineTierFactory.deployTransaction.blockNumber;

    verifyTierFactory = (await deploy(
      verifyTierFactoryJson,
      deployer,
      []
    )) as VerifyTierFactory;
    const verifyTierFactoryBlock =
      verifyTierFactory.deployTransaction.blockNumber;

    // ERC721BalanceTierFactory
    erc721BalanceTierFactory = (await deploy(
      erc721BalanceTierFactoryJson,
      deployer,
      []
    )) as ERC721BalanceTierFactory;
    const erc721BalanceTierFactoryBlock =
      erc721BalanceTierFactory.deployTransaction.blockNumber;

    // SaleFactory
    const saleConstructorConfig = {
      redeemableERC20Factory: redeemableERC20Factory.address,
    };
    saleFactory = (await deploy(saleFactoryJson, deployer, [
      saleConstructorConfig,
    ])) as SaleFactory;
    const saleFactoryBlock = saleFactory.deployTransaction.blockNumber;

    // GatedNFTFactory
    gatedNFTFactory = (await deploy(
      gatedNFTFactoryJson,
      deployer,
      []
    )) as GatedNFTFactory;
    const gatedNFTFactoryBlock = gatedNFTFactory.deployTransaction.blockNumber;

    // RedeemableERC20ClaimEscrow
    redeemableERC20ClaimEscrow = (await deploy(
      redeemableERC20ClaimEscrowJson,
      deployer,
      []
    )) as RedeemableERC20ClaimEscrow;
    const redeemableERC20ClaimEscrowBlock =
      redeemableERC20ClaimEscrow.deployTransaction.blockNumber;

    // Saving data in JSON
    const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
    const configLocal = JSON.parse(Util.fetchFile(pathConfigLocal));

    const localInfoPath = path.resolve(__dirname, "./utils/local_Info.json");
    const localInfoJson = JSON.parse(Util.fetchFile(localInfoPath));

    // Saving addresses and individuals blocks to index
    configLocal.factory = trustFactory.address;
    configLocal.startBlock = currentBlock;

    configLocal.verifyFactory = verifyFactory.address;
    configLocal.blockVerifyFactory = verifyFactoryBlock;

    configLocal.erc20BalanceTierFactory = erc20BalanceTierFactory.address;
    configLocal.blockErc20BalanceTierFactory = erc20BalanceTierFactoryBlock;

    configLocal.erc20TransferTierFactory = erc20TransferTierFactory.address;
    configLocal.blockErc20TransferTierFactory = erc20TransferTierFactoryBlock;

    configLocal.combineTierFactory = combineTierFactory.address;
    configLocal.blockCombineTierFactory = combineTierFactoryBlock;

    configLocal.verifyTierFactory = verifyTierFactory.address;
    configLocal.blockVerifyTierFactory = verifyTierFactoryBlock;

    configLocal.erc721BalanceTierFactory = erc721BalanceTierFactory.address;
    configLocal.blockErc721BalanceTierFactory = erc721BalanceTierFactoryBlock;

    configLocal.saleFactory = saleFactory.address;
    configLocal.blockSaleFactory = saleFactoryBlock;

    configLocal.gatedNFTFactory = gatedNFTFactory.address;
    configLocal.blockGatedNFTFactory = gatedNFTFactoryBlock;

    configLocal.redeemableERC20ClaimEscrow = redeemableERC20ClaimEscrow.address;
    configLocal.blockRedeemableERC20ClaimEscrow =
      redeemableERC20ClaimEscrowBlock;

    // localInfo.json - Tests (This will be deprecated in our tests)
    localInfoJson.subgraphUser = subgraphUser;
    localInfoJson.subgraphName = subgraphName;
    localInfoJson.trustFactory = trustFactory.address;
    localInfoJson.redeemableERC20Factory = redeemableERC20Factory.address;
    localInfoJson.seedERC20Factory = seedERC20Factory.address;
    localInfoJson.verifyFactory = verifyFactory.address;
    localInfoJson.erc20BalanceTierFactory = erc20BalanceTierFactory.address;
    localInfoJson.erc20TransferTierFactory = erc20TransferTierFactory.address;
    localInfoJson.combineTierFactory = combineTierFactory.address;
    localInfoJson.verifyTierFactory = verifyTierFactory.address;
    localInfoJson.erc721BalanceTierFactory = erc721BalanceTierFactory.address;
    localInfoJson.saleFactory = saleFactory.address;

    Util.writeFile(pathConfigLocal, JSON.stringify(configLocal, null, 4));
    Util.writeFile(localInfoPath, JSON.stringify(localInfoJson, null, 4));

    Util.exec(`yarn deploy-build:localhost`);

    subgraph = Util.fetchSubgraph(subgraphUser, subgraphName);

    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(1000);
  });

  it("should query the trust factories", async function () {
    const queryTrustCountresponse = (await subgraph({
      query: QUERY,
    })) as FetchResult;

    expect(queryTrustCountresponse.data.trustFactories[0].id).to.equals(
      trustFactory.address.toLowerCase()
    );
    expect(queryTrustCountresponse.data.trustFactories[0].trustCount).to.equals(
      "0"
    );
  });

  it("should get all the contracts from the Trust Construction Event", async function () {
    const queryResponse = await subgraph({
      query: getFactories(trustFactory.address.toLowerCase()),
    });
    const factories = queryResponse.data.trustFactory;

    expect(factories.balancerFactory).to.equals(bFactory.address.toLowerCase());
    expect(factories.crpFactory).to.equals(crpFactory.address.toLowerCase());

    expect(factories.redeemableERC20Factory).to.equals(
      redeemableERC20Factory.address.toLowerCase()
    );

    expect(factories.seedERC20Factory).to.equals(
      seedERC20Factory.address.toLowerCase()
    );

    expect(factories.bPoolFeeEscrow).to.equals(
      bPoolFeeEscrow.address.toLowerCase()
    );
  });

  describe("Single Trust test", function () {
    // Properties of this trust
    const reserveInit = ethers.BigNumber.from("2000" + sixZeros);
    const redeemInit = ethers.BigNumber.from("2000" + sixZeros);
    const totalTokenSupply = ethers.BigNumber.from("2000" + eighteenZeros);
    const initialValuation = ethers.BigNumber.from("20000" + sixZeros);
    const minimumCreatorRaise = ethers.BigNumber.from("100" + sixZeros);
    const minimumTradingDuration = 20;

    const redeemableERC20Config = {
      name: "Token",
      symbol: "TKN",
      distributor: Util.zeroAddress,
      initialSupply: totalTokenSupply,
    };
    // - Seeder props
    const seederFee = ethers.BigNumber.from("100" + sixZeros);
    const seederUnits = 10;
    const seederCooldownDuration = 1;
    const seedPrice = reserveInit.div(10);
    const minSeedUnits = 0;
    const seeder1Units = 4;
    const seeder2Units = 6;
    const seedERC20Config = {
      name: "SeedToken",
      symbol: "SDT",
      distributor: Util.zeroAddress,
      initialSupply: seederUnits,
    };

    const successLevel = redeemInit
      .add(minimumCreatorRaise)
      .add(seederFee)
      .add(reserveInit);

    before("Create the trust", async function () {
      // Giving the necessary amount to signer1 for a level 4
      minimumTier = Tier.FOUR;
      const level4 = LEVELS[minimumTier - 1];
      await reserve.transfer(signer1.address, level4);

      // Deploying a balance tier
      transaction = await erc20BalanceTierFactory.createChildTyped({
        erc20: reserve.address,
        tierValues: LEVELS,
      });

      erc20BalanceTier = (await Util.getContractChild(
        transaction,
        erc20BalanceTierFactory,
        erc20BalanceTierJson
      )) as ERC20BalanceTier;

      const trustFactoryDeployer = trustFactory.connect(deployer); // make explicit

      trust = (await Util.trustDeploy(
        trustFactoryDeployer,
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
          tier: erc20BalanceTier.address,
          minimumTier,
        },
        {
          seeder: Util.zeroAddress,
          cooldownDuration: seederCooldownDuration,
          erc20Config: seedERC20Config,
        },
        { gasLimit: 15000000 }
      )) as Trust;

      // Creating the instance for contracts
      redeemableERC20Contract = (await getContractChild(
        trust.deployTransaction,
        redeemableERC20Factory,
        redeemableTokenJson
      )) as RedeemableERC20;

      seedContract = (await getContractChild(
        trust.deployTransaction,
        seedERC20Factory,
        seedERC20Json
      )) as SeedERC20;

      // Get the CRP contract
      crpContract = (await Util.poolContracts(creator, trust)).crp;

      // Wait for Sync
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(2000);
    });

    it("should query the trust correctly", async function () {
      const queryResponse = (await subgraph({ query: QUERY })) as FetchResult;
      const response = queryResponse.data;
      const factoryData = response.trustFactories[0];
      const trustData = factoryData.trusts[0];

      expect(factoryData.trustCount).to.equals("1");
      expect(factoryData.trusts).to.have.lengthOf(1);

      expect(trustData.id).to.equals(trust.address.toLowerCase());
      expect(trustData.factory).to.equals(trustFactory.address.toLowerCase());
      expect(trustData.notices).to.be.empty;
      expect(trustData.trustParticipants).to.be.empty;
    });

    it("should query the CRP contract of the trust correctly", async function () {
      const [deployBlock, deployTime] = await getTxTimeblock(
        crpContract.deployTransaction
      );

      const query = `
        {
          trust (id: "${trust.address.toLowerCase()}") {
            contracts{
              id
            }
          }
          contract (id: "${trust.address.toLowerCase()}") {
            crp {
              id
              deployBlock
              deployTimestamp
            }
            pool {
              id
            }
          }
        }
      `;
      const queryResponse = await subgraph({
        query: query,
      });
      const dataTrust = queryResponse.data.trust;
      const datacontract = queryResponse.data.contract;

      expect(dataTrust.contracts.id).to.be.equals(trust.address.toLowerCase());

      expect(datacontract.crp.id).to.equals(crpContract.address.toLowerCase());
      expect(datacontract.crp.deployBlock).to.equals(deployBlock.toString());
      expect(datacontract.crp.deployTimestamp).to.equals(deployTime.toString());
      expect(datacontract.pool).to.be.null; // The pool is not created yet
    });

    it("should query the tier contract of the trust correctly", async function () {
      const [deployBlock, deployTime] = await getTxTimeblock(
        erc20BalanceTier.deployTransaction
      );

      const query = `
        {
          contract (id: "${trust.address.toLowerCase()}") {
            tier {
              id
              deployBlock
              deployTimestamp
            }
          }
        }
      `;
      const queryResponse = await subgraph({
        query: query,
      });

      const data = queryResponse.data.contract.tier;

      // Inside the RedeemableERC20 contract there is an event called 'initializeTierByConstruction'
      // that contain the tier address used in the trust. This event exist in the Contract because
      // have inherit from TierByConstruction contract
      expect(data.id).to.equals(erc20BalanceTier.address.toLowerCase());
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should query the reserve of the trust correctly", async function () {
      const query = `
        {
          contract (id: "${trust.address.toLowerCase()}") {
            reserveERC20 {
              id
              name
              symbol
              decimals
              totalSupply
              deployBlock
              deployTimestamp
            }
          }
        }
      `;
      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.contract.reserveERC20;

      expect(data.id).to.equals(reserve.address.toLowerCase());
      expect(data.name).to.equals(await reserve.name());
      expect(data.symbol).to.equals(await reserve.symbol());
      expect(data.decimals).to.equals(await reserve.decimals());
      expect(data.totalSupply).to.equals(await reserve.totalSupply());
    });

    it("should query the RedeemableERC20 after creation correctly", async function () {
      const [deployBlock, deployTime] = await getTxTimeblock(
        redeemableERC20Contract.deployTransaction
      );

      const query = `
        {
          contract (id: "${trust.address.toLowerCase()}") {
            redeemableERC20 {
              id
            }
          }
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            sender
            admin
            factory
            redeems {
              id
            }
            deployBlock
            deployTimestamp
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const dataContract = queryResponse.data.contract.redeemableERC20;
      const data = queryResponse.data.redeemableERC20;

      expect(dataContract.id).to.equals(
        redeemableERC20Contract.address.toLowerCase()
      );

      // Becuase the factory it is the sender in their initialization
      expect(data.sender).to.equals(
        redeemableERC20Factory.address.toLowerCase()
      );
      expect(data.factory).to.equals(
        redeemableERC20Factory.address.toLowerCase()
      );
      expect(data.admin).to.equals(trust.address.toLowerCase());

      expect(data.redeems).to.be.empty;
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should query the RedeemableERC20 details correctly", async function () {
      const query = `
        {
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            name
            symbol
            decimals
            minimumTier
            totalSupply
            holders {
              id
            }
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.redeemableERC20;

      expect(data.name).to.equals(redeemableERC20Config.name);
      expect(data.symbol).to.equals(redeemableERC20Config.symbol);
      expect(data.decimals).to.equals(18);
      expect(data.minimumTier).to.equals(minimumTier.toString());
      expect(data.totalSupply).to.equals(
        redeemableERC20Config.initialSupply.toString()
      );

      expect(data.holders).to.have.lengthOf(1);
    });

    it("should query the initial RedeemableERC20 Holder after creation", async function () {
      // The intial holder is the contract itself
      const holderId = `${redeemableERC20Contract.address.toLowerCase()} - ${trust.address.toLowerCase()}`;
      const query = `
        {
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            holders {
              id
            }
          }
          holder (id: "${holderId}") {
            address
            balance
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const dataHolders = queryResponse.data.redeemableERC20.holders;
      const data = queryResponse.data.holder;

      expect(dataHolders).to.have.lengthOf(1);
      expect(dataHolders).to.deep.include({ id: holderId });

      expect(data.balance).to.equal(redeemableERC20Config.initialSupply);
      expect(data.address).to.equal(trust.address.toLowerCase());
    });

    it("should query the TreasuryAsset from RedeemableERC20 correclty", async function () {
      const treasuryAssetsId = `${redeemableERC20Contract.address.toLowerCase()} - ${reserve.address.toLowerCase()}`;

      const query = `
        {
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            treasuryAssets {
              id
              address
              trust {
                id
              }
              balance
              redeems {
                id
              }
            }
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const dataTreAssets = queryResponse.data.redeemableERC20.treasuryAssets;
      const data = dataTreAssets[0];

      expect(dataTreAssets).to.have.lengthOf(1);

      expect(data.id).to.equals(treasuryAssetsId);
      expect(data.address).to.equals(reserve.address.toLowerCase());
      expect(data.trust.id).to.equals(trust.address.toLowerCase());

      expect(data.balance).to.equals("0"); // Any reserve in the Redeemable yet
      expect(data.redeems).to.be.empty; // Any redeem yet
    });

    it("should query the TreasuryAsset details correclty", async function () {
      const treasuryAssetsId = `${redeemableERC20Contract.address.toLowerCase()} - ${reserve.address.toLowerCase()}`;

      const query = `
        {
          treasuryAsset (id: "${treasuryAssetsId}") {
            name
            symbol
            decimals
            totalSupply
            redemptionRatio
            redeemableERC20 {
              id
            }
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.treasuryAsset;

      expect(data.name).to.equals(await reserve.name());
      expect(data.symbol).to.equals(await reserve.symbol());
      expect(data.decimals).to.equals(await reserve.decimals());
      expect(data.totalSupply).to.equals(await reserve.totalSupply());
      expect(data.redeemableERC20.id).to.equals(
        redeemableERC20Contract.address.toLowerCase()
      );
      // Because the "Redeemable" balance for this "treassury asset" is still zero.
      expect(data.redemptionRatio).to.be.null;
    });

    it("should query the callers of TreasuryAsset correclty", async function () {
      const treasuryAssetsId = `${redeemableERC20Contract.address.toLowerCase()} - ${reserve.address.toLowerCase()}`;

      // The tx where the `TreasuryAsset` event was emitted (RedeemableERC20 creation)
      const TreAssetCallerId =
        redeemableERC20Contract.deployTransaction.hash.toLowerCase();

      const [deployBlock, deployTime] = await getTxTimeblock(
        redeemableERC20Contract.deployTransaction
      );

      const query = `
        {
          treasuryAsset (id: "${treasuryAssetsId}") {
            callers {
              id
            }
          }
          treasuryAssetCaller (id: "${TreAssetCallerId}") {
            caller
            redeemableERC20Address
            trustAddress {
              id
            }
            treasuryAsset {
              id
            }
            deployBlock
            deployTimestamp
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const dataCallers = queryResponse.data.treasuryAsset.callers;
      const data = queryResponse.data.treasuryAssetCaller;

      expect(dataCallers).to.have.lengthOf(1);
      expect(dataCallers).to.deep.include({ id: TreAssetCallerId });

      expect(data.caller).to.equals(
        redeemableERC20Factory.address.toLowerCase()
      );
      expect(data.redeemableERC20Address).to.equals(
        redeemableERC20Contract.address.toLowerCase()
      );

      expect(data.trustAddress.id).to.equals(trust.address.toLowerCase());
      expect(data.treasuryAsset.id).to.equals(treasuryAssetsId);
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should continue querying if `TreasuryAsset` is called with a non-ERC20", async function () {
      // Could be any non-erc20 address
      const nonErc20Address = erc721Test.address;
      transaction = await redeemableERC20Contract.newTreasuryAsset(
        nonErc20Address
      );
      const treasuryAssetsId = `${redeemableERC20Contract.address.toLowerCase()} - ${nonErc20Address.toLowerCase()}`;

      // Waiting sync after tx
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1500);

      const query = `
        {
          treasuryAssets {
            id
            address
          }
          trust (id: "${trust.address.toLowerCase()}") {
            id
          }
        }
      `;
      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data;

      expect(data.trust.id).to.equals(trust.address.toLowerCase());

      expect(data.treasuryAssets).to.have.lengthOf(2);
      expect(data.treasuryAssets).to.deep.include({
        id: treasuryAssetsId,
        address: nonErc20Address.toLowerCase(),
      });
    });

    it("should query the ERC20Pull from RedeemableERC20 correclty", async function () {
      const query = `
        {
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            erc20Pull {
              id
              sender
              tokenSender
              token
            }
          }
          erc20Pulls {
            id
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const dataPulls = queryResponse.data.erc20Pulls;
      const data = queryResponse.data.redeemableERC20.erc20Pull;

      expect(dataPulls).to.have.lengthOf(1);
      expect(dataPulls[0].id).to.deep.include(
        redeemableERC20Contract.address.toLowerCase()
      );

      // Because it is the ERC20Pull properties to this contract
      expect(data.id).to.equals(redeemableERC20Contract.address.toLowerCase());
      expect(data.sender).to.equals(
        redeemableERC20Factory.address.toLowerCase()
      );
      expect(data.tokenSender).to.equals(trust.address.toLowerCase());
      expect(data.token).to.equals(reserve.address.toLowerCase());
    });

    it("should query the grantSender from RedeemableERC20 after creation", async function () {
      const query = `
        {
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            grantedSenders
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const gSendersData = queryResponse.data.redeemableERC20.grantedSenders;

      expect(gSendersData).to.have.lengthOf(1);
      expect(gSendersData[0]).to.equals(crpContract.address.toLowerCase());
    });

    it("should query the grantReceivers from RedeemableERC20 after creation", async function () {
      const query = `
        {
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            grantedReceivers 
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const gReceiversData =
        queryResponse.data.redeemableERC20.grantedReceivers;

      expect(gReceiversData).to.have.lengthOf(3);

      expect(gReceiversData).to.include(bPoolFeeEscrow.address.toLowerCase());
      expect(gReceiversData).to.include(bFactory.address.toLowerCase());
      expect(gReceiversData).to.include(trust.address.toLowerCase());
    });

    it("should query the Seed of the trust correctly", async function () {
      const [deployBlock, deployTime] = await getTxTimeblock(
        seedContract.deployTransaction
      );
      const query = `
        {
          contract (id: "${trust.address.toLowerCase()}") {
            seeder {
              id
            }
          }
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            name
            symbol
            decimals
            totalSupply
            deployBlock
            deployTimestamp
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const dataContract = queryResponse.data.contract;
      const data = queryResponse.data.seedERC20;

      expect(dataContract.seeder.id).to.equals(
        seedContract.address.toLowerCase()
      );

      expect(data.name).to.equals(seedERC20Config.name);
      expect(data.symbol).to.equals(seedERC20Config.symbol);
      expect(data.decimals).to.equals(0);
      expect(data.totalSupply).to.equals(
        seedERC20Config.initialSupply.toString()
      );

      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should query the SeedContract values information correctly", async function () {
      const seedFeePerUnitExpected = seederFee.div(
        seedERC20Config.initialSupply
      );

      const query = `
        {
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            seederFee
            seederUnits
            seedFeePerUnit
            seedPrice
            seederCooldownDuration
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.seedERC20;

      expect(data.seederFee).to.equals(seederFee);
      expect(data.seederUnits).to.equals(seederUnits.toString());

      expect(data.seedFeePerUnit).to.equals(seedFeePerUnitExpected);
      expect(data.seedPrice).to.equals(seedPrice);

      // This could be catch it with the `CooldownInitialize` event in SeedERC20 contract initialization
      expect(data.seederCooldownDuration).to.equals(
        seederCooldownDuration.toString()
      );
    });

    it("should query the reference addresses in SeedContract correctly", async function () {
      // Sender == SeedERC20Factory.address -> because it's the sender emited on their init event
      // Recipient == Trust.address
      // Reserve ==  reserve.address
      // Factory == SeedERC20Factory.address
      const query = `
        {
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            sender
            recipient
            reserve
            factory
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.seedERC20;

      expect(data.sender).to.equals(seedERC20Factory.address.toLowerCase());
      expect(data.recipient).to.equals(trust.address.toLowerCase());
      expect(data.reserve).to.equals(reserve.address.toLowerCase());
      expect(data.factory).to.equals(seedERC20Factory.address.toLowerCase());
    });

    it("should query the initial Seed Holder correctly", async function () {
      const holderId = `${seedContract.address.toLowerCase()} - ${seedContract.address.toLowerCase()}`;

      const query = `
        {
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            holders {
              id
            }
          }
          holder (id: "${holderId}") {
            address
            balance
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });

      const dataSeed = queryResponse.data.seedERC20;
      const dataHolder = queryResponse.data.holder;

      expect(dataSeed.holders).to.have.lengthOf(1);
      expect(dataSeed.holders).to.deep.include({ id: holderId });

      expect(dataHolder.address).to.equals(seedContract.address.toLowerCase());
      expect(dataHolder.balance).to.equals(
        seedERC20Config.initialSupply.toString()
      );
    });

    it("should query initial values of SeedContract before any transaction/event", async function () {
      // Does not have any reserve amount in the Seeder in this point (should be 0)
      const seededAmntExpected = await reserve.balanceOf(seedContract.address);
      // SeedERC20.seededAmount / Trust.redeemInit in this point is 0
      const percentSeededExpected = seededAmntExpected.div(redeemInit);

      const query = `
        {
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            seeds {
              id
            }
            unseeds {
              id
            }
            redeemSeed {
              id
            }
            seederUnitsAvail
            seededAmount
            percentSeeded
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });

      const data = queryResponse.data.seedERC20;

      expect(data.seeds).to.be.empty;
      expect(data.unseeds).to.be.empty;
      expect(data.redeemSeed).to.be.empty;

      expect(data.seederUnitsAvail).to.equals(
        seedERC20Config.initialSupply.toString() // Any tx was made with this seed yet
      );
      expect(data.seededAmount).to.equals(seededAmntExpected); // 0
      expect(data.percentSeeded).to.equals(percentSeededExpected); // 0
    });

    it("should query the DistributionProgress of the Trust correclty after creation", async function () {
      const query = `
        {
          trust (id: "${trust.address.toLowerCase()}"){
            distributionProgress {
              id
            }
          }
          distributionProgress (id: "${trust.address.toLowerCase()}"){
            distributionStatus
            distributionStartBlock
            distributionEndBlock
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const dataTrust = queryResponse.data.trust;
      const data = queryResponse.data.distributionProgress;

      expect(dataTrust.distributionProgress.id).to.equals(
        trust.address.toLowerCase()
      );

      expect(data.distributionStatus).to.equals(DistributionStatus.Pending);
      expect(data.distributionStartBlock).to.be.null;
      expect(data.distributionEndBlock).to.be.null;
    });

    it("should query initial values from DistributionProgress after trust creation", async function () {
      const query = `
        {
          distributionProgress(id: "${trust.address.toLowerCase()}"){
            initialValuation
            reserveInit
            poolReserveBalance
            poolTokenBalance
            amountRaised
            percentRaised
            percentAvailable
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.initialValuation).to.equals(initialValuation); // trust.initialize.TrustConfig.initialValuation
      expect(data.reserveInit).to.equals(reserveInit); // trust.initialize.TrustConfig.reserveInit

      // Because any tx with the DutchAuction has not started yet
      expect(data.poolReserveBalance).to.be.null;
      expect(data.poolTokenBalance).to.be.null;
      expect(data.amountRaised).to.be.null;
      expect(data.percentRaised).to.be.null;
      expect(data.percentAvailable).to.be.null;
    });

    it("should query minimum values from DistributionProgress after trust creation", async function () {
      // This is how could be calculated. It is inside the trustConfig emited on initialization
      // `trust.config_.minimumCreatorRaise + trust.config_.redeemInit + trust.config_.seederFee`
      const minimumRaiseExpected = minimumCreatorRaise
        .add(redeemInit)
        .add(seederFee);

      const query = `
        {
          distributionProgress(id: "${trust.address.toLowerCase()}"){
            minimumCreatorRaise
            minimumTradingDuration
            minimumRaise
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.minimumCreatorRaise).to.equals(minimumCreatorRaise); // trust.initialize.TrustConfig.minimumCreatorRaise
      expect(data.minimumTradingDuration).to.equals(
        minimumTradingDuration.toString() // trust.initialize.TrustConfig.minimumTradingDuration
      );
      // minimumCreatorRaise + trust.initialize.TrustConfig.redeemInit + trust.initialize.TrustConfig.seederFee
      expect(data.minimumRaise).to.equals(minimumRaiseExpected);
    });

    it("should query expected final values from DistributionProgress after trust creation", async function () {
      // `trust.config_.reserveInit + trust.config_.minimumCreatorRaise +
      // trust.config_.redeemInit + trust.config_.seederFee`
      const successPoolBalanceExpected = reserveInit
        .add(seederFee)
        .add(redeemInit)
        .add(minimumCreatorRaise);

      const BONE = ethers.BigNumber.from("1" + eighteenZeros);

      // To calculate the finalWeight you should use the `config_.reserveInit` and
      // `config_.finalValuation` in trust, and BONE that is 10 ** 18 with this formula:
      // weight_ = (config_.finalValuation * BONE) / config_.reserveInit
      const finalWeightExpected = successLevel.mul(BONE).div(reserveInit);

      const query = `
        {
          distributionProgress(id: "${trust.address.toLowerCase()}"){
            finalBalance
            finalValuation
            redeemInit
            finalWeight
            successPoolBalance
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.finalBalance).to.be.null; // Only set when end the Dutch Auction
      expect(data.finalValuation).to.equals(successLevel); // trust.initialize.TrustConfig.finalValuation
      expect(data.redeemInit).to.equals(redeemInit); // trust.initialize.TrustConfig.redeemInit
      expect(data.finalWeight).to.equals(finalWeightExpected); // see above
      expect(data.successPoolBalance).to.equals(successPoolBalanceExpected); // see above
    });

    it("should get Notice correctly", async function () {
      transaction = await trust.connect(signer2).sendNotice("0x01");

      const noticeId = transaction.hash.toLowerCase();
      const [deployBlock, deployTime] = await getTxTimeblock(transaction);

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          trust (id: "${trust.address.toLowerCase()}") {
            notices {
              id
            }
          }
          notice (id: "${noticeId}") {
            trust {
              id
            }
            sender
            data
            deployBlock
            deployTimestamp
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataTrust = queryResponse.data.trust;
      const data = queryResponse.data.notice;

      expect(dataTrust.notices).to.have.lengthOf(1);
      expect(dataTrust.notices).to.deep.include({ id: noticeId });

      expect(data.trust.id).to.equals(trust.address.toLowerCase());
      expect(data.sender).to.equals(signer2.address.toLowerCase());
      expect(data.data).to.equals("0x01");
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should query the seed correctly after a Seed.", async function () {
      const reserveAmount = seedPrice.mul(seeder1Units);

      // seeder need some cash, give enough for seeding
      await reserve.transfer(seeder1.address, reserveAmount);

      await reserve
        .connect(seeder1)
        .approve(seedContract.address, reserveAmount);

      // seeder1 seed the contract. Save the tx to get the args
      transaction = await seedContract
        .connect(seeder1)
        .seed(minSeedUnits, seeder1Units);

      // Get the values from event
      const { tokensSeeded, reserveReceived } = await Util.getEventArgs(
        transaction,
        "Seed",
        seedContract
      );

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1500);

      const query = `
        {
          seeds {
            id
            caller
            reserveReceived
            tokensSeeded
            seedERC20 {
              id
            }
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.seeds;

      expect(data).to.have.lengthOf(1);

      expect(data[0].id).to.equals(transaction.hash.toLowerCase());
      expect(data[0].caller).to.equals(seeder1.address.toLowerCase());

      expect(data[0].reserveReceived).to.equals(reserveReceived.toString());
      expect(data[0].tokensSeeded).to.equals(tokensSeeded.toString());

      expect(data[0].seedERC20.id).to.equals(
        seedContract.address.toLowerCase()
      );
    });

    it("should query the seedERC20 correctly after a Seed.", async function () {
      const seederUnitsAvailExpected = await seedContract.balanceOf(
        seedContract.address
      );
      const seededAmountExpected = await reserve.balanceOf(
        seedContract.address
      );

      // percentSeeded = seededAmount / trust.config_.redeemInit
      const percentSeededExpected = seededAmountExpected.div(redeemInit);

      const query = `
        {
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            seederUnitsAvail
            seededAmount
            percentSeeded
            seeds {
              id
            }
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.seedERC20;

      expect(data.seeds).to.have.lengthOf(1);

      expect(data.seederUnitsAvail).to.equals(seederUnitsAvailExpected);
      expect(data.seededAmount).to.equals(seededAmountExpected);
      expect(data.percentSeeded).to.equals(percentSeededExpected);
    });

    it("should query the new seedERC20 Holder correctly after a Seed.", async function () {
      const seeder1holderId = `${seedContract.address.toLowerCase()} - ${seeder1.address.toLowerCase()}`;
      const seedContractId = `${seedContract.address.toLowerCase()} - ${seedContract.address.toLowerCase()}`;

      const balanceUserExpected = await seedContract.balanceOf(seeder1.address);
      const balanceContractExpected = await seedContract.balanceOf(
        seedContract.address
      );

      const query = `
        {
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            holders {
              id
            }
          }
          seeder1holder: holder (id: "${seeder1holderId}") {
            address
            balance
          }
          seedContractId: holder (id: "${seedContractId}") {
            address
            balance
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });

      const dataSeedERC20 = queryResponse.data.seedERC20;
      const dataUser = queryResponse.data.seeder1holder;
      const dataContract = queryResponse.data.seedContractId;

      expect(dataSeedERC20.holders).to.have.lengthOf(2);
      expect(dataSeedERC20.holders).to.deep.include({ id: seeder1holderId });
      expect(dataSeedERC20.holders).to.deep.include({ id: seedContractId });

      expect(dataUser.address).to.equals(seeder1.address.toLowerCase());
      expect(dataUser.balance).to.equals(balanceUserExpected);

      expect(dataContract.address).to.equals(
        seedContract.address.toLowerCase()
      );
      expect(dataContract.balance).to.equals(balanceContractExpected);
    });

    it("should query  the trustParticipant correctly after seed", async function () {
      const id = `${seeder1.address.toLowerCase()} - ${trust.address.toLowerCase()}`;
      const seedBalanceExpected = await seedContract.balanceOf(seeder1.address);

      // Calculated as `seedFeeClaimable = SeedERC20.balanceOf(this.user.address) * SeedERC20.seedFeePerUnit`
      const seedFeeClaimableExpected = seedBalanceExpected.mul(
        seederFee.div(seederUnits)
      );

      const query = `
      {
        trust (id: "${trust.address.toLowerCase()}") {
          trustParticipants {
            id
          }
        }
        trustParticipant(id: "${id}"){
          address
          seeds {
            id
          }
          seedBalance
          seedFeeClaimable
        }
      }
    `;

      // Create Subgraph Connection
      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const dataTrust = queryResponse.data.trust;
      const data = queryResponse.data.trustParticipant;

      // Trust participans should be updated after seed
      expect(dataTrust.trustParticipants).to.have.lengthOf(1);

      expect(data.seeds).to.have.lengthOf(1);
      expect(data.address).to.equals(seeder1.address.toLowerCase());
      expect(data.seedBalance).to.equals(seedBalanceExpected);
      expect(data.seedFeeClaimable).to.equals(seedFeeClaimableExpected);
    });

    it("should query correclty the seeds after a second Seed.", async function () {
      // seeder need some cash, give enough for seeding
      await reserve.transfer(seeder2.address, seedPrice.mul(seeder2Units));

      await reserve
        .connect(seeder2)
        .approve(seedContract.address, seedPrice.mul(seeder2Units));

      // seeder2 seed the contract. Save the tx to get the args
      transaction = await seedContract
        .connect(seeder2)
        .seed(minSeedUnits, seeder2Units);

      const seedId = transaction.hash.toLowerCase();

      // Get the values from event
      const { tokensSeeded, reserveReceived } = await Util.getEventArgs(
        transaction,
        "Seed",
        seedContract
      );

      await Util.delay(Util.wait * 2);
      await waitForSubgraphToBeSynced(1500);

      const query = `
        {
          seeds {
            id
          }
          seed (id: "${seedId}") {
            caller
            reserveReceived
            tokensSeeded
            seedERC20 {
              id
            }
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const dataSeeds = queryResponse.data.seeds;
      const dataSeed = queryResponse.data.seed;

      expect(dataSeeds).to.have.lengthOf(2);
      expect(dataSeeds.holders).to.deep.include({ id: seedId });

      expect(dataSeed.caller).to.equal(seeder2.address.toLowerCase());
      expect(dataSeed.seedERC20.id).to.equal(
        seedContract.address.toLowerCase()
      );

      // Get these values with the Seed event
      expect(dataSeed.reserveReceived).to.equal(reserveReceived);
      expect(dataSeed.tokensSeeded).to.equal(tokensSeeded);
    });

    it("should query the distribution status after full seeded", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(500);

      // When a seed is made and the last units was seeded, the seed send the reserve
      // to the trust, so the trust should have the Status as `distributionStatus.Seeded`
      // but it is not already Trading because startDutchAuction is not called yet
      // Maybe using getDistributionStatus after every seed event could work (?)
      const query = `
        {
          distributionProgress(id: "${trust.address.toLowerCase()}"){
            distributionStatus
            distributionStartBlock
            distributionEndBlock
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.distributionStatus).to.be.equals(DistributionStatus.Seeded);
      expect(data.distributionStartBlock).to.be.null;
      expect(data.distributionEndBlock).to.be.null;
    });

    it("Should query the correct DutchAuction entity after StartDutchAuction.", async function () {
      // The signer1 (arbitrary), can startDutchAuction
      // Saving the tx
      transaction = await trust.connect(signer1).startDutchAuction();

      const { finalAuctionBlock } = await Util.getEventArgs(
        transaction,
        "StartDutchAuction",
        trust
      );

      bPoolContract = (await Util.poolContracts(creator, trust)).bPool;

      // Grant receiver after start the dutchauction
      // _token.grantReceiver(pool_);

      await Util.delay(Util.wait * 2);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          dutchAuctions {
            id
            starterAddress
            enderAddress
            pool
            finalAuctionBlock
            finalBalance
            seederPay
            creatorPay
            tokenPay
            poolDust
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const dutchAuctionsData = queryResponse.data.dutchAuctions;
      const data = dutchAuctionsData[0];

      expect(dutchAuctionsData).to.have.lengthOf(1);

      expect(data.id).to.be.equals(trust.address.toLowerCase());
      expect(data.starterAddress).to.equals(signer1.address.toLowerCase());
      expect(data.pool).to.equals(bPoolContract.address.toLowerCase());
      expect(data.finalAuctionBlock).to.equals(finalAuctionBlock);

      // Should be null, just to make it explicit
      expect(data.enderAddress).to.be.null;
      expect(data.finalBalance).to.be.null;
      expect(data.seederPay).to.be.null;
      expect(data.creatorPay).to.be.null;
      expect(data.tokenPay).to.be.null;
      expect(data.poolDust).to.be.null;
    });

    it("should query the correct DistributionProgress when start", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(500);

      // Using the tx block
      const startBlock = transaction.blockNumber;
      const endBlock = (
        await Util.getEventArgs(transaction, "StartDutchAuction", trust)
      ).finalAuctionBlock;

      const poolReserveBalanceExpected = await reserve.balanceOf(
        bPoolContract.address
      );
      const poolTokenBalanceExpected = await redeemableERC20Contract.balanceOf(
        bPoolContract.address
      );

      // poolReserveBalance - reserveInit
      const amountRaisedExpected = poolReserveBalanceExpected.sub(reserveInit);

      // amountRaised / minimumRaise
      const percentRaisedExpected = amountRaisedExpected.div(
        minimumCreatorRaise.add(redeemInit).add(seederFee)
      );

      // poolTokenBalance / RedeemableERC20.totalSupply
      const percentAvailableExpected = poolTokenBalanceExpected.div(
        redeemableERC20Config.initialSupply
      );

      const query = `
        {
          distributionProgress (id: "${trust.address.toLowerCase()}") {
            distributionStatus
            distributionStartBlock
            distributionEndBlock
            poolReserveBalance
            poolTokenBalance
            amountRaised
            percentRaised
            percentAvailable
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.distributionStatus).to.equals(DistributionStatus.Trading);
      expect(data.distributionStartBlock).to.equals(startBlock.toString());
      expect(data.distributionEndBlock).to.equals(endBlock.toString());

      expect(data.poolReserveBalance).to.equals(poolReserveBalanceExpected);
      expect(data.poolTokenBalance).to.equals(poolTokenBalanceExpected);
      expect(data.amountRaised).to.equals(amountRaisedExpected);
      expect(data.percentRaised).to.equals(percentRaisedExpected);
      expect(data.percentAvailable).to.equals(percentAvailableExpected);
    });

    it("should query the Pool correclty when the Trade start", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(500);

      const poolReserveBalanceExpected = await reserve.balanceOf(
        bPoolContract.address
      );
      const poolTokenBalanceExpected = await redeemableERC20Contract.balanceOf(
        bPoolContract.address
      );

      // Using the tx saved
      const poolDeployBlock = transaction.blockNumber;
      const poolDeployTimestamp = transaction.timestamp; //

      const query = `
        {
          pools {
            id
            trust {
              id
            }
            reserve {
              id
            }
            redeemable {
              id
            }
            poolBalanceReserve
            poolTokenBalance
            numberOfSwaps
            swaps {
              id
            }
            deployBlock
            deployTimestamp
          }
        }
      `;

      const queryResponse = await subgraph({
        query: query,
      });
      const dataPools = queryResponse.data.pools;
      const data = dataPools[0];

      expect(dataPools).to.have.lengthOf(1);

      expect(data.id).to.equals(bPoolContract.address.toLowerCase());
      expect(data.trust.id).to.equals(trust.address.toLowerCase());
      expect(data.reserve.id).to.equals(reserve.address.toLowerCase());
      expect(data.reserve.id).to.equals(reserve.address.toLowerCase());
      expect(data.redeemable).to.equals(
        redeemableERC20Contract.address.toLowerCase()
      );

      expect(data.poolBalanceReserve).to.equals(poolReserveBalanceExpected);
      expect(data.poolTokenBalance).to.equals(poolTokenBalanceExpected);
      expect(data.numberOfSwaps).to.equals("0");
      expect(data.swaps).to.have.lengthOf(0);

      expect(data.deployBlock).to.equals(poolDeployBlock.toString());
      expect(data.deployTimestamp).to.equals(poolDeployTimestamp.toString());
    });

    it("Single Swap test", async function () {
      const reserveSpend = successLevel.div(10);

      // give to signer some reserve
      await reserve.transfer(signer1.address, reserveSpend);

      await reserve
        .connect(signer1)
        .approve(bPoolContract.address, reserveSpend);

      await crpContract.connect(signer1).pokeWeights();

      await bPoolContract
        .connect(signer1)
        .swapExactAmountIn(
          reserve.address,
          reserveSpend,
          await trust.token(),
          ethers.BigNumber.from("1"),
          ethers.BigNumber.from("1000000" + sixZeros)
        );

      // Query the RedeemableERC20 entity
      /**
       * Here is a single swap tx to query all the changes before and after the swap with the:
       * - Pool Entity with the numberOfSwaps, the contracts the poolBalanceReserve and the initial
       * poolTokenBalance (which is 10**18 * 10**9)
       * - Swap Entity can query the tokensIn and tokensOut
       * I think could use the balance of the user/contract to check the amount that out/in to their balances
       * and should match those differences with the out/in amount :) Also, the next `it` statement have a loop
       * to finish all the swaps. So, we can add these expects there
       */
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);
    });

    it("Swaps test", async function () {
      // Copy the properties of the trust. I think we should make a scope for this trust.
      const redeemInit = ethers.BigNumber.from("2000" + sixZeros);
      const reserveInit = ethers.BigNumber.from("2000" + sixZeros);
      const minimumCreatorRaise = ethers.BigNumber.from("100" + sixZeros);
      const seederFee = ethers.BigNumber.from("100" + sixZeros);

      const signers = await ethers.getSigners();
      bPoolContract = (await Util.poolContracts(creator, trust)).bPool;

      const finalValuation = redeemInit
        .add(minimumCreatorRaise)
        .add(seederFee)
        .add(reserveInit);
      const reserveSpend = finalValuation.div(10);

      const swapReserveForTokens = async (
        signer: SignerWithAddress,
        spend: BigNumber
      ) => {
        // give signer some reserve
        await reserve.transfer(signer.address, spend);

        const reserveSigner = reserve.connect(signer);
        const crpSigner = crpContract.connect(signer);
        const bPoolSigner = bPoolContract.connect(signer);

        await reserveSigner.approve(bPoolContract.address, spend);
        await crpSigner.pokeWeights();
        await bPoolSigner.swapExactAmountIn(
          reserve.address,
          spend,
          await trust.token(),
          ethers.BigNumber.from("1"),
          ethers.BigNumber.from("1000000" + sixZeros)
        );
      };
      let swaps = 1;
      while (
        (await reserve.balanceOf(bPoolContract.address)).lte(finalValuation)
      ) {
        await swapReserveForTokens(signer1, reserveSpend);
        swaps++;
        /**
         * Should query every swap here. All swaps will have the same.
         * The `swaps` could be use to maintain control of the swaps lengths (in this scenario ofc)
         * Also check the amount in/out if it is necessary with the balances maybe
         */
      }
    });

    it("End Dutch Auction test", async function () {
      // Trust properties
      const seederFee = ethers.BigNumber.from("100" + sixZeros);
      const redeemInit = ethers.BigNumber.from("2000" + sixZeros);
      const reserveInit = ethers.BigNumber.from("2000" + sixZeros);
      const minimumCreatorRaise = ethers.BigNumber.from("100" + sixZeros);
      const minimumTradingDuration = 20;
      const finalValuation = redeemInit
        .add(minimumCreatorRaise)
        .add(seederFee)
        .add(reserveInit);

      // finalBalance_ query

      await Util.createEmptyBlock(minimumTradingDuration);

      // Use `seeder1` to ends rase
      await trust.connect(seeder1).endDutchAuction();

      /**
       * `EndDutchAuction` Event/Entity
       * - `enderAddress`: Should be who call the endDutchAuction(), so eq to seeder1.address
       * - `finalBalance`: should be eq or greater than `finalValuation`
       * - `seederPay`: idk yet how this is calculated. Represent the payment of the seeder that will be approved
       * - `creatorPay`:
       * - `poolDust`: It is the reserver that still in the pool after end, `await reserve.balanceOf(poolAddress)`
       * -
       *
       */
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);
    });

    it("Trust Owner pulls reserve", async function () {
      await reserve
        .connect(creator)
        .transferFrom(
          trust.address,
          creator.address,
          await reserve.allowance(trust.address, creator.address)
        );
    });

    it("Seeder pull erc20", async function () {
      // seeder1 pulls erc20 from SeedERC20 contract
      await seedContract
        .connect(seeder1)
        .pullERC20(
          await reserve.allowance(trust.address, seedContract.address)
        );
    });

    it("Redeem seed test", async function () {
      const seederContract1 = seedContract.connect(seeder1);
      const seeder1Units = 4;
      await seederContract1.redeem(seeder1Units, 0);
    });

    it("Pull ERC20 tokens ", async function () {
      await redeemableERC20Contract
        .connect(signer1)
        .pullERC20(
          await reserve.allowance(
            trust.address,
            redeemableERC20Contract.address
          )
        );
    });

    it("Redeem RedeemableERC20 test", async function () {
      const token = new ethers.Contract(
        await trust.token(),
        redeemableTokenJson.abi,
        creator
      ) as RedeemableERC20;

      await token
        .connect(signer1)
        .redeem([reserve.address], await token.balanceOf(signer1.address));

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      // Query the RedeemableERC20, Redeems, TreasuryAssets
    });
  });

  // Trust with address seeder (user)
});
