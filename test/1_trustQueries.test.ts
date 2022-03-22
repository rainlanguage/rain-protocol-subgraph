import { expect } from "chai";
import { ethers } from "hardhat";
import * as path from "path";

import * as Util from "./utils/utils";
import {
  waitForSubgraphToBeSynced,
  Tier,
  sixZeros,
  eighteenZeros,
  LEVELS,
  getTxTimeblock,
  getEventArgs,
  zeroAddress,
  fixedNumber,
  DistributionStatus,
} from "./utils/utils";

import { getFactories, QUERY } from "./utils/queries";

// Typechain Factories
import { NoticeBoard__factory } from "../typechain/factories/NoticeBoard__factory";
import { EmissionsERC20Factory__factory } from "../typechain/factories/EmissionsERC20Factory__factory";
import { VerifyFactory__factory } from "../typechain/factories/VerifyFactory__factory";
import { ERC20BalanceTierFactory__factory } from "../typechain/factories/ERC20BalanceTierFactory__factory";
import { ERC20TransferTierFactory__factory } from "../typechain/factories/ERC20TransferTierFactory__factory";
import { CombineTierFactory__factory } from "../typechain/factories/CombineTierFactory__factory";
import { VerifyTierFactory__factory } from "../typechain/factories/VerifyTierFactory__factory";
import { ERC721BalanceTierFactory__factory } from "../typechain/factories/ERC721BalanceTierFactory__factory";
import { SaleFactory__factory } from "../typechain/factories/SaleFactory__factory";
import { GatedNFTFactory__factory } from "../typechain/factories/GatedNFTFactory__factory";
import { RedeemableERC20ClaimEscrow__factory } from "../typechain/factories/RedeemableERC20ClaimEscrow__factory";

import { ReserveTokenTest__factory } from "../typechain/factories/ReserveTokenTest__factory";
import { ERC721__factory } from "../typechain/factories/ERC721__factory";
import { SeedERC20__factory } from "../typechain/factories/SeedERC20__factory";
import { RedeemableERC20__factory } from "../typechain/factories/RedeemableERC20__factory";
import { BPoolFeeEscrow__factory } from "../typechain/factories/BPoolFeeEscrow__factory";
import { Trust__factory } from "../typechain/factories/Trust__factory";

// Types
import type { ApolloFetch, FetchResult } from "apollo-fetch";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type { BigNumber, ContractTransaction } from "ethers";

import type { NoticeBoard } from "../typechain/NoticeBoard";
import type { EmissionsERC20Factory } from "../typechain/EmissionsERC20Factory";
import type { BFactory } from "../typechain/BFactory";
import type { CRPFactory } from "../typechain/CRPFactory";
import type { RedeemableERC20Factory } from "../typechain/RedeemableERC20Factory";
import type { SeedERC20Factory } from "../typechain/SeedERC20Factory";
import type { TrustFactory } from "../typechain/TrustFactory";
import type { ERC20BalanceTierFactory } from "../typechain/ERC20BalanceTierFactory";
import type { ERC20TransferTierFactory } from "../typechain/ERC20TransferTierFactory";
import type { CombineTierFactory } from "../typechain/CombineTierFactory";
import type { VerifyTierFactory } from "../typechain/VerifyTierFactory";
import type { ERC721BalanceTierFactory } from "../typechain/ERC721BalanceTierFactory";
import type { VerifyFactory } from "../typechain/VerifyFactory";
import type { SaleFactory } from "../typechain/SaleFactory";
import type { GatedNFTFactory } from "../typechain/GatedNFTFactory";
import type { RedeemableERC20ClaimEscrow } from "../typechain/RedeemableERC20ClaimEscrow";

import type { ReserveTokenTest } from "../typechain/ReserveTokenTest";
import type { SeedERC20, SeedEvent, UnseedEvent } from "../typechain/SeedERC20";
import type { RedeemableERC20 } from "../typechain/RedeemableERC20";
import type { ConfigurableRightsPool } from "../typechain/ConfigurableRightsPool";
import type { BPool, LOG_SWAPEvent } from "../typechain/BPool";
import type { BPoolFeeEscrow } from "../typechain/BPoolFeeEscrow";
import type { ERC20BalanceTier } from "../typechain/ERC20BalanceTier";
import type { RedeemEvent } from "../typechain/ERC20Redeem";
import type {
  Trust,
  ConstructionEvent,
  StartDutchAuctionEvent,
  EndDutchAuctionEvent,
} from "../typechain/Trust";

const subgraphName = "beehive-innovation/rain-protocol";
let minimumTier: Tier,
  seedContract: SeedERC20,
  redeemableERC20Contract: RedeemableERC20,
  trust: Trust,
  crpContract: ConfigurableRightsPool,
  bPoolContract: BPool,
  reserve: ReserveTokenTest, // ERC20
  erc20BalanceTier: ERC20BalanceTier,
  transaction: ContractTransaction;

// Export Factories
export let subgraph: ApolloFetch,
  noticeBoard: NoticeBoard,
  emissionsERC20Factory: EmissionsERC20Factory,
  seedERC20Factory: SeedERC20Factory,
  redeemableERC20Factory: RedeemableERC20Factory,
  trustFactory: TrustFactory,
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
  recipient: SignerWithAddress,
  feeRecipient: SignerWithAddress,
  admin: SignerWithAddress;

before("Deployment contracts and subgraph", async function () {
  const signers = await ethers.getSigners();

  // Signers (to avoid fetch again)
  deployer = signers[0]; // deployer is NOT creator
  creator = signers[1];
  seeder1 = signers[2];
  seeder2 = signers[3];
  signer1 = signers[4];
  signer2 = signers[5];
  recipient = signers[6];
  feeRecipient = signers[7];
  admin = signers[9];

  // Deploying NoticeBoard contract
  noticeBoard = await new NoticeBoard__factory(deployer).deploy();

  // Deploying EmissionsERC20Factory contract
  emissionsERC20Factory = await new EmissionsERC20Factory__factory(
    deployer
  ).deploy();

  // Deploying TrustFactory contract
  [crpFactory, bFactory] = (await Util.balancerDeploy(deployer)) as [
    CRPFactory,
    BFactory
  ];

  ({ trustFactory, redeemableERC20Factory, seedERC20Factory } =
    await Util.trustFactoriesDeploy(crpFactory, bFactory, deployer));

  // Deploying VerifyFactory contract
  verifyFactory = await new VerifyFactory__factory(deployer).deploy();

  // Deploying Tiers Factories
  // -  ERC20BalanceTierFactory
  erc20BalanceTierFactory = await new ERC20BalanceTierFactory__factory(
    deployer
  ).deploy();

  // - ERC20TransferTierFactory
  erc20TransferTierFactory = await new ERC20TransferTierFactory__factory(
    deployer
  ).deploy();

  // - CombineTierFactory
  combineTierFactory = await new CombineTierFactory__factory(deployer).deploy();

  verifyTierFactory = await new VerifyTierFactory__factory(deployer).deploy();

  // - ERC721BalanceTierFactory
  erc721BalanceTierFactory = await new ERC721BalanceTierFactory__factory(
    deployer
  ).deploy();

  // Deploying SaleFactory contract
  saleFactory = await new SaleFactory__factory(deployer).deploy({
    maximumCooldownDuration: 1000,
    redeemableERC20Factory: redeemableERC20Factory.address,
  });

  // Deploying GatedNFTFactory contract
  gatedNFTFactory = await new GatedNFTFactory__factory(deployer).deploy();

  // Deploying RedeemableERC20ClaimEscrow contract
  redeemableERC20ClaimEscrow = await new RedeemableERC20ClaimEscrow__factory(
    deployer
  ).deploy();

  // Saving data in JSON
  const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
  const config = JSON.parse(Util.fetchFile(pathConfigLocal));

  config.network = "localhost";

  // Saving addresses and individuals blocks to index
  config.noticeBoard = noticeBoard.address;
  config.noticeBoardBlock = noticeBoard.deployTransaction.blockNumber;

  config.emissionsERC20Factory = emissionsERC20Factory.address;
  config.emissionsERC20FactoryBlock =
    emissionsERC20Factory.deployTransaction.blockNumber;

  config.trustFactory = trustFactory.address;
  config.trustFactoryBlock = trustFactory.deployTransaction.blockNumber;

  config.verifyFactory = verifyFactory.address;
  config.blockVerifyFactory = verifyFactory.deployTransaction.blockNumber;

  config.erc20BalanceTierFactory = erc20BalanceTierFactory.address;
  config.blockErc20BalanceTierFactory =
    erc20BalanceTierFactory.deployTransaction.blockNumber;

  config.erc20TransferTierFactory = erc20TransferTierFactory.address;
  config.blockErc20TransferTierFactory =
    erc20TransferTierFactory.deployTransaction.blockNumber;

  config.combineTierFactory = combineTierFactory.address;
  config.blockCombineTierFactory =
    combineTierFactory.deployTransaction.blockNumber;

  config.verifyTierFactory = verifyTierFactory.address;
  config.blockVerifyTierFactory =
    verifyTierFactory.deployTransaction.blockNumber;

  config.erc721BalanceTierFactory = erc721BalanceTierFactory.address;
  config.blockErc721BalanceTierFactory =
    erc721BalanceTierFactory.deployTransaction.blockNumber;

  config.saleFactory = saleFactory.address;
  config.blockSaleFactory = saleFactory.deployTransaction.blockNumber;

  config.gatedNFTFactory = gatedNFTFactory.address;
  config.blockGatedNFTFactory = gatedNFTFactory.deployTransaction.blockNumber;

  config.redeemableERC20ClaimEscrow = redeemableERC20ClaimEscrow.address;
  config.blockRedeemableERC20ClaimEscrow =
    redeemableERC20ClaimEscrow.deployTransaction.blockNumber;

  // Write address and block to configuration contracts file
  Util.writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

  // Read deploy configuration example and create subgraph deployment configuration
  const deployConfigExPath = path.resolve(
    __dirname,
    "../scripts/deployConfig.example.json"
  );
  const deployConfig = JSON.parse(Util.fetchFile(deployConfigExPath));

  // Setting all to localhost to test locally
  deployConfig.subgraphName = subgraphName;
  deployConfig.configPath = "config/localhost.json";
  deployConfig.endpoint = "http://localhost:8020/";
  deployConfig.ipfsEndpoint = "http://localhost:5001";
  deployConfig.versionLabel = "test-v2.0.0";

  // Write to the deployment configuration
  const deployConfigPath = path.resolve(
    __dirname,
    "../scripts/deployConfig.json"
  );
  Util.writeFile(deployConfigPath, JSON.stringify(deployConfig, null, 2));

  Util.exec(`npm run deploy-subgraph`);

  subgraph = Util.fetchSubgraph(subgraphName);

  // Wait for sync
  await waitForSubgraphToBeSynced(1000);
});

describe("Subgraph Trusts Test", function () {
  let bPoolFeeEscrow: BPoolFeeEscrow;

  before(async function () {
    // Getting the bPoolScrow
    const implemAddress = await Util.getImplementation(trustFactory);
    const trustImple = new Trust__factory(deployer).attach(implemAddress);

    const { bPoolFeeEscrow: bPoolFeeEscrowAddr } = (await getEventArgs(
      trustFactory.deployTransaction,
      "Construction",
      trustImple
    )) as ConstructionEvent["args"];

    bPoolFeeEscrow = new BPoolFeeEscrow__factory(deployer).attach(
      bPoolFeeEscrowAddr
    );
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    bPoolFeeEscrow.deployTransaction = trustFactory.deployTransaction;
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

  it("should get Notice from NoticeBoard correctly", async function () {
    const notices = [
      {
        subject: zeroAddress,
        data: "0x01",
      },
    ];

    transaction = await noticeBoard.connect(signer2).createNotices(notices);

    const noticeId = `UNKNOWN_NOTICES - ${transaction.hash.toLowerCase()} - 0`;
    const [deployBlock, deployTime] = await getTxTimeblock(transaction);

    await waitForSubgraphToBeSynced();

    const query = `
      {
        notice (id: "${noticeId}") {
          sender
          subject{
            id
          }
          data
          deployBlock
          deployTimestamp
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;
    const data = queryResponse.data.notice;

    expect(data.sender).to.equals(signer2.address.toLowerCase());
    expect(data.subject.id).to.equals("UNKNOWN_NOTICES");
    expect(data.data).to.equals("0x01");
    expect(data.deployBlock).to.equals(deployBlock.toString());
    expect(data.deployTimestamp).to.equals(deployTime.toString());
  });

  describe("Trust happy path queries", function () {
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
      distributor: zeroAddress,
      initialSupply: totalTokenSupply,
    };
    // - Seeder props
    const seederFee = ethers.BigNumber.from("100" + sixZeros);
    const seederUnits = 10;
    const seedERC20Config = {
      name: "SeedToken",
      symbol: "SDT",
      distributor: zeroAddress,
      initialSupply: seederUnits,
    };
    const seederCooldownDuration = 1;
    const seedPrice = reserveInit.div(seederUnits);
    const minSeedUnits = 0;
    let seeder1Units = 4;
    let seeder2Units: BigNumber; // Will be filled

    let tradStartBlock: number, tradEndBlock: number;

    const finalValuation = redeemInit
      .add(minimumCreatorRaise)
      .add(seederFee)
      .add(reserveInit);

    before("Create the trust", async function () {
      // Deploying new reserve to test
      reserve = await new ReserveTokenTest__factory(deployer).deploy();

      // Giving the necessary amount to signer1 and signer2 for a level 4
      minimumTier = Tier.FOUR;
      const level4 = LEVELS[minimumTier - 1];
      await reserve.transfer(signer1.address, level4);
      await reserve.transfer(signer2.address, level4);

      // Deploying a ERC20BalanceTier
      erc20BalanceTier = await Util.erc20BalanceTierDeploy(
        erc20BalanceTierFactory,
        creator,
        {
          erc20: reserve.address,
          tierValues: LEVELS,
        }
      );

      trust = (await Util.trustDeploy(
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
          finalValuation: finalValuation,
          minimumTradingDuration,
        },
        {
          erc20Config: redeemableERC20Config,
          tier: erc20BalanceTier.address,
          minimumTier,
        },
        {
          seeder: zeroAddress,
          cooldownDuration: seederCooldownDuration,
          erc20Config: seedERC20Config,
        },
        { gasLimit: 15000000 }
      )) as Trust;

      // Creating the instance for contracts
      redeemableERC20Contract = new RedeemableERC20__factory(deployer).attach(
        await Util.getChild(redeemableERC20Factory, trust.deployTransaction)
      );

      seedContract = new SeedERC20__factory(deployer).attach(
        await Util.getChild(seedERC20Factory, trust.deployTransaction)
      );

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      redeemableERC20Contract.deployTransaction = trust.deployTransaction;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      seedContract.deployTransaction = trust.deployTransaction;

      // Get the CRP contract
      ({ crp: crpContract } = await Util.poolContracts(trust, creator));

      // Wait for Sync
      await waitForSubgraphToBeSynced();
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

    it("should query the configurableRightPool contract of the trust correctly", async function () {
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
            configurableRightPool {
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
        query,
      });

      const dataTrust = queryResponse.data.trust;
      const datacontract = queryResponse.data.contract;

      expect(dataTrust.contracts.id).to.be.equals(trust.address.toLowerCase());

      expect(datacontract.configurableRightPool.id).to.equals(
        crpContract.address.toLowerCase()
      );
      expect(datacontract.configurableRightPool.deployBlock).to.equals(
        deployBlock.toString()
      );
      expect(datacontract.configurableRightPool.deployTimestamp).to.equals(
        deployTime.toString()
      );
      // expect(datacontract.pool).to.be.null; // The pool is not created yet
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
              factory{
                id
              }
              deployBlock
              deployTimestamp
            }
          }
        }
      `;
      const queryResponse = await subgraph({
        query,
      });

      const data = queryResponse.data.contract.tier;

      expect(data.id).to.equals(erc20BalanceTier.address.toLowerCase());
      expect(data.factory.id).to.equals(
        erc20BalanceTierFactory.address.toLowerCase()
      );
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
        query,
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
            deployer
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
        query,
      });
      const dataContract = queryResponse.data.contract.redeemableERC20;
      const data = queryResponse.data.redeemableERC20;

      expect(dataContract.id).to.equals(
        redeemableERC20Contract.address.toLowerCase()
      );

      expect(data.deployer).to.equals(creator.address.toLowerCase());
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
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.redeemableERC20;

      expect(data.name).to.equals(redeemableERC20Config.name);
      expect(data.symbol).to.equals(redeemableERC20Config.symbol);
      expect(data.decimals).to.equals(18);
      expect(data.minimumTier).to.equals(minimumTier.toString());
      expect(data.totalSupply).to.equals(
        redeemableERC20Config.initialSupply.toString()
      );
    });

    it("should query the initial RedeemableERC20 Holder after creation", async function () {
      // The intial holder is the trust itself
      const holderId = `${redeemableERC20Contract.address.toLowerCase()} - ${trust.address.toLowerCase()}`;
      const query = `
        {
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            holders {
              id
              balance
            }
          }
          holder (id: "${holderId}") {
            address
            balance
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const dataRedemableHolders = queryResponse.data.redeemableERC20.holders;
      const data = queryResponse.data.holder;
      // The same contract is not considered as Holder of their own tokens
      expect(dataRedemableHolders).to.be.empty; // Should be empty in this point
      expect(data).to.be.null; // This holder cant be exist.
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
        query,
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
            balance
            redeemableERC20 {
              id
            }
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
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
      expect(data.redemptionRatio).to.equals("0");
      expect(data.redemptionRatio).to.equals("0");
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
        query,
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
      const erc721Test = await new ERC721__factory(deployer).deploy(
        "TokenERC721",
        "T721"
      );

      // Could be any non-erc20 address
      const nonErc20Address = erc721Test.address;
      transaction = await redeemableERC20Contract.newTreasuryAsset(
        nonErc20Address
      );
      const treasuryAssetsId = `${redeemableERC20Contract.address.toLowerCase()} - ${nonErc20Address.toLowerCase()}`;

      // Waiting sync after tx
      await waitForSubgraphToBeSynced();

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
        query,
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
        query,
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
        query,
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
        query,
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
        query,
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
        query,
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
      const query = `
        {
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            deployer
            reserve
            factory
            recipient
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.seedERC20;

      expect(data.deployer).to.equals(creator.address.toLowerCase());
      expect(data.reserve).to.equals(reserve.address.toLowerCase());
      expect(data.factory).to.equals(seedERC20Factory.address.toLowerCase());
      expect(data.recipient).to.equals(trust.address.toLowerCase());
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
        query,
      });

      const dataSeed = queryResponse.data.seedERC20;
      const dataHolder = queryResponse.data.holder;

      expect(dataSeed.holders).to.be.empty;

      expect(dataHolder).to.be.null;
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
            redeemSeeds {
              id
            }
            seederUnitsAvail
            seededAmount
            percentSeeded
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });

      const seedERC20Data = queryResponse.data.seedERC20;
      expect(seedERC20Data.seeds.length).to.equals(0);
      expect(seedERC20Data.unseeds.length).to.equals(0);
      expect(seedERC20Data.redeemSeeds.length).to.equals(0);
      expect(seedERC20Data.seederUnitsAvail).to.equals(
        seedERC20Config.initialSupply.toString() // Any tx was made with this seed yet
      );
      expect(seedERC20Data.seededAmount).to.equals(seededAmntExpected); // 0
      expect(seedERC20Data.percentSeeded).to.equals(percentSeededExpected); // 0
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
        query,
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
            poolRedeemableBalance
            amountRaised
            percentRaised
            percentAvailable
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.initialValuation).to.equals(initialValuation); // trust.initialize.TrustConfig.initialValuation
      expect(data.reserveInit).to.equals(reserveInit); // trust.initialize.TrustConfig.reserveInit

      // Because any tx with the DutchAuction has not started yet
      expect(data.poolReserveBalance).to.equals("0");
      expect(data.poolRedeemableBalance).to.be.null;
      expect(data.amountRaised).to.equals("0");
      expect(data.percentRaised).to.be.null;
      expect(data.percentAvailable).to.be.null;
    });

    it("should query minimum values from DistributionProgress after trust creation", async function () {
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
        query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.minimumCreatorRaise).to.equals(minimumCreatorRaise);
      expect(data.minimumTradingDuration).to.equals(
        minimumTradingDuration.toString()
      );
      expect(data.minimumRaise).to.equals(minimumRaiseExpected);
    });

    it("should query expected final values from DistributionProgress after trust creation", async function () {
      const successPoolBalanceExpected = reserveInit
        .add(seederFee)
        .add(redeemInit)
        .add(minimumCreatorRaise);

      const BONE = ethers.BigNumber.from("1" + eighteenZeros);

      const finalWeightExpected = finalValuation.mul(BONE).div(reserveInit);

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
        query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.finalBalance).to.equals("0");
      expect(data.finalValuation).to.equals(finalValuation);
      expect(data.redeemInit).to.equals(redeemInit);
      expect(data.finalWeight).to.equals(finalWeightExpected);
      expect(data.successPoolBalance).to.equals(successPoolBalanceExpected);
    });

    it("should query Notice in Trust correctly", async function () {
      const notices = [
        {
          subject: trust.address,
          data: "0x01",
        },
      ];

      transaction = await noticeBoard.connect(signer1).createNotices(notices);

      const noticeId = `${trust.address.toLowerCase()} - ${transaction.hash.toLowerCase()} - 0`;
      await waitForSubgraphToBeSynced();

      const query = `
        {
          trust (id: "${trust.address.toLowerCase()}") {
            notices {
              id
            }
          }
          notice (id: "${noticeId}") {
            sender
            subject{
                id
            }
            data
          }
        }
      `;

      const queryResponse = (await subgraph({
        query,
      })) as FetchResult;
      const dataTrust = queryResponse.data.trust.notices;
      const dataNotice = queryResponse.data.notice;

      expect(dataTrust).deep.include({ id: noticeId });

      expect(dataNotice.sender).to.equals(signer1.address.toLowerCase());
      expect(dataNotice.subject.id).to.equals(trust.address.toLowerCase());
      expect(dataNotice.data).to.equals("0x01");
    });

    it("should query the Seed entity correctly after a Seed.", async function () {
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

      const [deployBlock, deployTime] = await getTxTimeblock(transaction);

      // Get the values from event
      const { tokensSeeded, reserveReceived } = (await getEventArgs(
        transaction,
        "Seed",
        seedContract
      )) as SeedEvent["args"];

      await waitForSubgraphToBeSynced();

      const query = `
        {
          seeds {
            id
            caller
            seedERC20 {
              id
            } 
            tokensSeeded
            reserveReceived
            deployBlock
            deployTimestamp
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const dataSeeds = queryResponse.data.seeds;
      const data = dataSeeds[0];

      expect(dataSeeds).to.have.lengthOf(1);

      expect(data.id).to.equals(transaction.hash.toLowerCase());
      expect(data.caller).to.equals(seeder1.address.toLowerCase());

      expect(data.tokensSeeded).to.equals(tokensSeeded.toString());
      expect(data.reserveReceived).to.equals(reserveReceived.toString());
      expect(data.seedERC20.id).to.equals(seedContract.address.toLowerCase());

      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should query the SeedERC20 entity correctly after a Seed.", async function () {
      const seederUnitsAvailExpected = await seedContract.balanceOf(
        seedContract.address
      );
      const seededAmountExpected = await reserve.balanceOf(
        seedContract.address
      );

      const percentSeededExpected = seededAmountExpected
        .mul(100)
        .div(redeemInit);

      const seedId = transaction.hash.toLowerCase();

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
        query,
      });
      const data = queryResponse.data.seedERC20;

      expect(data.seeds).to.have.lengthOf(1);
      expect(data.seeds).to.deep.include({ id: seedId });

      expect(data.seederUnitsAvail).to.equals(seederUnitsAvailExpected);
      expect(data.seededAmount).to.equals(seededAmountExpected);
      expect(data.percentSeeded).to.equals(percentSeededExpected);
    });

    it("should query the new seedERC20 Holder correctly after a Seed.", async function () {
      const seeder1holderId = `${seedContract.address.toLowerCase()} - ${seeder1.address.toLowerCase()}`;

      const balanceUserExpected = await seedContract.balanceOf(seeder1.address);

      const query = `
        {
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            holders {
              id
            }
          }
          holder (id: "${seeder1holderId}") {
            address
            balance
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });

      const dataSeedERC20 = queryResponse.data.seedERC20;
      const dataUser = queryResponse.data.holder;

      expect(dataSeedERC20.holders).to.have.lengthOf(1);
      expect(dataSeedERC20.holders).to.deep.include({ id: seeder1holderId });

      expect(dataUser.address).to.equals(seeder1.address.toLowerCase());
      expect(dataUser.balance).to.equals(balanceUserExpected);
    });

    it("should query  the trustParticipant correctly after seed", async function () {
      const id = `${seeder1.address.toLowerCase()} - ${trust.address.toLowerCase()}`;
      const seedBalanceExpected = await seedContract.balanceOf(seeder1.address);

      // Calculated as `seedFeeClaimable = SeedERC20.balanceOf(this.user.address) * SeedERC20.seedFeePerUnit`
      const seedFeeClaimableExpected = seedBalanceExpected.mul(
        seederFee.div(seederUnits)
      );

      const seedId = transaction.hash.toLowerCase();

      const query = `
        {
          trust (id: "${trust.address.toLowerCase()}") {
            trustParticipants {
              id
            }
          }
          trustParticipant(id: "${id}"){
            address
            trust {
              id
            }
            seeds {
              id
            }
            seedBalance
            seedFeeClaimable
          }
        }
      `;
      const queryResponse = (await subgraph({
        query,
      })) as FetchResult;

      const dataTrust = queryResponse.data.trust;
      const data = queryResponse.data.trustParticipant;

      // Trust participans should be updated after seed
      expect(dataTrust.trustParticipants).to.have.lengthOf(1);

      expect(data.seeds).to.have.lengthOf(1);
      expect(data.seeds).to.deep.include({ id: seedId });

      expect(data.address).to.equals(seeder1.address.toLowerCase());
      expect(data.trust.id).to.equals(trust.address.toLowerCase());
      expect(data.seedBalance).to.equals(seedBalanceExpected);
      expect(data.seedFeeClaimable).to.equals(seedFeeClaimableExpected);
    });

    it("should query the correct SeedERC20 holders after Transfer a SeedERC20", async function () {
      const amountToTransfer = ethers.BigNumber.from(1);
      seeder1Units = seeder1Units - 1;

      // Sending 1 seed token to signer1 that never had interacted with the trust
      transaction = await seedContract
        .connect(seeder1)
        .transfer(signer1.address, amountToTransfer);

      const senderHolderId = `${seedContract.address.toLowerCase()} - ${seeder1.address.toLowerCase()}`;
      const senderBalance = await seedContract.balanceOf(seeder1.address);

      const receiverHolderId = `${seedContract.address.toLowerCase()} - ${signer1.address.toLowerCase()}`;
      const receiverBalance = await seedContract.balanceOf(signer1.address);

      await waitForSubgraphToBeSynced();

      const query = `
        {
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            seeds {
              id
            }
            holders{
              id
            }
          }
          senderHolder: holder (id: "${senderHolderId}") {
            address
            balance
          }
          receiverHolder: holder (id: "${receiverHolderId}") {
            address
            balance
          }
        }
      `;
      const queryResponse = (await subgraph({
        query,
      })) as FetchResult;

      const dataSeedERC20 = queryResponse.data.seedERC20;
      const dataSender = queryResponse.data.senderHolder;
      const dataReceiver = queryResponse.data.receiverHolder;

      expect(dataSeedERC20.seeds).to.have.lengthOf(1); // Should still equal
      expect(dataSeedERC20.holders).to.have.lengthOf(2); // Because who receive the SeedERC20 now is holder
      expect(dataSeedERC20.holders).to.deep.include({ id: receiverHolderId });

      expect(dataSender.address).to.equals(seeder1.address.toLowerCase());
      expect(dataSender.balance).to.equals(senderBalance);

      expect(dataReceiver.address).to.equals(signer1.address.toLowerCase());
      expect(dataReceiver.balance).to.equals(receiverBalance);
    });

    it("should query the correct SeedERC20 balance in TrustParticipant after Transfer a SeedERC20", async function () {
      const trustParticId = `${seeder1.address.toLowerCase()} - ${trust.address.toLowerCase()}`;

      const seedBalanceExpected = await seedContract.balanceOf(seeder1.address);

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
          trustParticipant(id: "${trustParticId}"){
            seeds {
              id
            }
            seedBalance
            seedFeeClaimable
          }
        }
      `;
      const queryResponse = (await subgraph({
        query,
      })) as FetchResult;
      const dataTrust = queryResponse.data.trust;
      const data = queryResponse.data.trustParticipant;

      // Trust participans should be stay equal because the receiver never interact with the Trust
      expect(dataTrust.trustParticipants).to.have.lengthOf(1);

      expect(data.seeds).to.have.lengthOf(1);
      expect(data.seedBalance).to.equals(seedBalanceExpected);
      expect(data.seedFeeClaimable).to.equals(seedFeeClaimableExpected);
    });

    it("should not query as TrustParticipant the Transfer receiver that never participated in the Trust", async function () {
      const participantId = `${signer1.address.toLowerCase()} - ${trust.address.toLowerCase()}`;
      const query = `
        {
          trustParticipants {
            id
          }
          trustParticipant(id: "${participantId}"){
           id
          }
        }
      `;
      const queryResponse = (await subgraph({
        query,
      })) as FetchResult;

      const dataArray = queryResponse.data.trustParticipants;
      const data = queryResponse.data.trustParticipant;

      expect(dataArray).to.have.lengthOf(1);
      expect(data).to.be.null; // Not interact with Trust, so: it is not a participant
    });

    it("should query the Unseed correctly after an Unseed", async function () {
      const unseedAmount = await seedContract.balanceOf(signer1.address);

      transaction = await seedContract.connect(signer1).unseed(unseedAmount);

      const unseedId = transaction.hash.toLowerCase();

      // Get the values from event
      const { tokensUnseeded, reserveReturned } = (await getEventArgs(
        transaction,
        "Unseed",
        seedContract
      )) as UnseedEvent["args"];

      const [deployBlock, deployTime] = await getTxTimeblock(transaction);

      await waitForSubgraphToBeSynced();

      const query = `
        {
          unseeds {
            id
            caller
            seedERC20 {
              id
            }
            reserveReturned
            tokensSeeded
            deployBlock
            deployTimestamp
          }
        }      
      `;
      const queryResponse = (await subgraph({
        query,
      })) as FetchResult;

      const dataArr = queryResponse.data.unseeds;
      const data = dataArr[0];

      expect(dataArr).to.have.lengthOf(1);

      expect(data.id).to.equals(unseedId);
      expect(data.caller).to.equals(signer1.address.toLowerCase());
      expect(data.seedERC20.id).to.equals(seedContract.address.toLowerCase());

      expect(data.reserveReturned).to.equals(reserveReturned.toString());
      expect(data.tokensSeeded).to.equals(tokensUnseeded.toString());
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should update the SeedERC20 after an Unseed correclty", async function () {
      const seederUnitsExpected = await seedContract.balanceOf(
        seedContract.address
      );

      const seededAmountExpected = await reserve.balanceOf(
        seedContract.address
      );

      // percentSeeded = seededAmount / trust.config_.redeemInit
      const percentSeededExpected = seededAmountExpected
        .mul(100)
        .div(redeemInit);

      const unseedId = transaction.hash.toLowerCase();

      const query = `
        {
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            seederUnitsAvail
            seededAmount
            percentSeeded
            unseeds{
              id
            }
          }
        }
      `;
      const queryResponse = (await subgraph({
        query,
      })) as FetchResult;

      const data = queryResponse.data.seedERC20;

      expect(data.seederUnitsAvail).to.equals(seederUnitsExpected);
      expect(data.seededAmount).to.equals(seededAmountExpected);
      expect(data.percentSeeded).to.equals(percentSeededExpected);

      expect(data.unseeds).to.have.lengthOf(1);
      expect(data.unseeds).to.deep.include({ id: unseedId });
    });

    it("should query the trustParticipant that Unseed their seeds correctly", async function () {
      const participantId = `${signer1.address.toLowerCase()} - ${trust.address.toLowerCase()}`;

      const seedBalanceExpected = await seedContract.balanceOf(signer1.address);

      const seedFeePerUnitExpected = seederFee.div(
        seedERC20Config.initialSupply
      );
      const seedFeeClaimableExpected = seedBalanceExpected.mul(
        seedFeePerUnitExpected
      );
      const query = `
        {
          trustParticipants {
            id
          }
          trustParticipant (id: "${participantId}"){
            address
            trust {
              id
            } 
            seeds {
              id
            }
            unSeeds {
              id
            }
            seedBalance
            seedFeeClaimable
          }
        }
      `;
      const queryResponse = (await subgraph({
        query,
      })) as FetchResult;

      const dataParticipants = queryResponse.data.trustParticipants;
      const data = queryResponse.data.trustParticipant;

      expect(dataParticipants).to.have.lengthOf(2);
      expect(dataParticipants).to.deep.include({ id: participantId });

      expect(data.address).to.equals(signer1.address.toLowerCase());
      expect(data.trust.id).to.equals(trust.address.toLowerCase());

      expect(data.seeds).to.be.empty;
      expect(data.unSeeds).to.have.lengthOf(1);

      expect(data.seedBalance).to.equals(seedBalanceExpected);
      expect(data.seedFeeClaimable).to.equals(seedFeeClaimableExpected);
    });

    it("should query correclty the seeds after a second Seed", async function () {
      // Seeder2 want all the remaining seeds
      seeder2Units = await seedContract.balanceOf(seedContract.address);

      // seeder need some cash, give enough for seeding
      await reserve.transfer(seeder2.address, seedPrice.mul(seeder2Units));

      await reserve
        .connect(seeder2)
        .approve(seedContract.address, seedPrice.mul(seeder2Units));

      // seeder2 seed the contract. Save the tx to get the args
      transaction = await seedContract
        .connect(seeder2)
        .seed(minSeedUnits, seeder2Units);

      await waitForSubgraphToBeSynced();

      const seedId = transaction.hash.toLowerCase();

      // Get the values from event
      const { tokensSeeded, reserveReceived } = (await getEventArgs(
        transaction,
        "Seed",
        seedContract
      )) as SeedEvent["args"];

      const query = `
        {
          seeds {
            id
          }
          seed (id: "${seedId}") {
            caller
            seedERC20 {
              id
            }
            reserveReceived
            tokensSeeded
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const dataSeeds = queryResponse.data.seeds;
      const data = queryResponse.data.seed;

      expect(dataSeeds).to.have.lengthOf(2);
      expect(dataSeeds).to.deep.include({ id: seedId });

      expect(data.caller).to.equal(seeder2.address.toLowerCase());
      expect(data.seedERC20.id).to.equal(seedContract.address.toLowerCase());

      // Get these values with the Seed event
      expect(data.reserveReceived).to.equal(reserveReceived);
      expect(data.tokensSeeded).to.equal(tokensSeeded);
    });

    it("should query correctly the SeedERC20 after full seeded", async function () {
      const seederUnitsAvailExpected = await seedContract.balanceOf(
        seedContract.address
      );

      // It is the reserve expected when is full seeded
      const seededAmountExpected = reserveInit;

      const percentSeededExpected = seededAmountExpected
        .mul(100)
        .div(redeemInit);

      const seedId = transaction.hash.toLowerCase();

      const query = `
        {
          seedERC20 (id: "${seedContract.address.toLowerCase()}") {
            seeds{
              id
            }
            holders{
              id
            }
            seederUnitsAvail
            seededAmount
            percentSeeded
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.seedERC20;

      expect(data.seeds).to.have.lengthOf(2);
      expect(data.seeds).to.deep.include({ id: seedId });
      expect(data.holders).to.have.lengthOf(3);

      expect(data.seederUnitsAvail).to.equals(seederUnitsAvailExpected);
      expect(data.seededAmount).to.equals(seededAmountExpected);
      expect(data.percentSeeded).to.equals(percentSeededExpected);
    });

    it("should query the distribution status after full seeded", async function () {
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
        query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.distributionStartBlock).to.be.null;
      expect(data.distributionEndBlock).to.be.null;
      expect(data.distributionStatus).to.be.equals(DistributionStatus.Seeded);
    });

    it("Should query the correct DutchAuction entity after StartDutchAuction.", async function () {
      // The signer1 (arbitrary), can startDutchAuction
      transaction = await trust.connect(signer1).startDutchAuction();

      const { finalAuctionBlock } = (await getEventArgs(
        transaction,
        "StartDutchAuction",
        trust
      )) as StartDutchAuctionEvent["args"];

      // Save the start and end blocks
      tradStartBlock = transaction.blockNumber;
      tradEndBlock = finalAuctionBlock.toNumber();

      ({ bPool: bPoolContract } = await Util.poolContracts(trust, creator));

      await waitForSubgraphToBeSynced();

      const query = `
        {
          trust (id: "${trust.address.toLowerCase()}") {
            dutchAuction {
              id
            }
          }
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
        query,
      });
      const dutchAuctionsData = queryResponse.data.dutchAuctions;
      const trustData = queryResponse.data.trust;
      const data = dutchAuctionsData[0];

      expect(trustData.dutchAuction.id).to.equals(trust.address.toLowerCase());

      expect(dutchAuctionsData).to.have.lengthOf(1);

      expect(data.id).to.be.equals(trust.address.toLowerCase());
      expect(data.starterAddress).to.equals(signer1.address.toLowerCase());
      expect(data.pool).to.equals(bPoolContract.address.toLowerCase());
      expect(data.finalAuctionBlock).to.equals(finalAuctionBlock);

      // Should be null. It is only know when the Dutch Auction end
      expect(data.enderAddress).to.be.null;
      expect(data.finalBalance).to.be.null;
      expect(data.seederPay).to.be.null;
      expect(data.creatorPay).to.be.null;
      expect(data.tokenPay).to.be.null;
      expect(data.poolDust).to.be.null;
    });

    it("should query the correct distribution in DistributionProgress after StartDutchAuction", async function () {
      const query = `
        {
          distributionProgress (id: "${trust.address.toLowerCase()}") {
            distributionStatus
            distributionStartBlock
            distributionEndBlock
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.distributionStatus).to.equals(DistributionStatus.Trading);
      expect(data.distributionStartBlock).to.equals(tradStartBlock.toString());
      expect(data.distributionEndBlock).to.equals(tradEndBlock.toString());
    });

    it("should query the correct Tokens related information in DistributionProgress after StartDutchAuction", async function () {
      const poolReserveBalanceExpected = await reserve.balanceOf(
        bPoolContract.address
      );
      const poolRedeemableBalanceExpected =
        await redeemableERC20Contract.balanceOf(bPoolContract.address);

      // poolReserveBalance - reserveInit
      const amountRaisedExpected = poolReserveBalanceExpected.sub(reserveInit);

      // percentRaised = amountRaised / minimumRaise
      const percentRaisedExpected = amountRaisedExpected
        .mul(100)
        .div(minimumCreatorRaise.add(redeemInit).add(seederFee));

      // percentAvailable = poolRedeemableBalance / RedeemableERC20.totalSupply
      const percentAvailableExpected = poolRedeemableBalanceExpected
        .mul(100)
        .div(redeemableERC20Config.initialSupply);

      const query = `
        {
          distributionProgress (id: "${trust.address.toLowerCase()}") {
            poolReserveBalance
            poolRedeemableBalance
            amountRaised
            percentRaised
            percentAvailable
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.poolReserveBalance).to.equals(poolReserveBalanceExpected);
      expect(data.poolRedeemableBalance).to.equals(
        poolRedeemableBalanceExpected
      );
      expect(data.amountRaised).to.equals(amountRaisedExpected);
      expect(data.percentRaised).to.equals(percentRaisedExpected.toString());
      expect(data.percentAvailable).to.equals(
        percentAvailableExpected.toString()
      );
    });

    it("should query the Pool information correclty after StartDutchAuction", async function () {
      // Using the tx saved
      const [deployBlock, deployTime] = await getTxTimeblock(transaction);

      const query = `
        {
          contract (id: "${trust.address.toLowerCase()}") {
            pool {
              id
            }
          }
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
            deployBlock
            deployTimestamp
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });

      const dataContract = queryResponse.data.contract;
      const dataArray = queryResponse.data.pools;
      const data = dataArray[0];

      expect(dataContract.pool.id).to.equals(
        bPoolContract.address.toLowerCase()
      );

      expect(dataArray).to.have.lengthOf(2); // +1 Empty Pool

      expect(data.id).to.equals(bPoolContract.address.toLowerCase());
      expect(data.trust.id).to.equals(trust.address.toLowerCase());
      expect(data.reserve.id).to.equals(reserve.address.toLowerCase());
      expect(data.redeemable.id).to.equals(
        redeemableERC20Contract.address.toLowerCase()
      );

      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should query the Pool values correclty after StartDutchAuction", async function () {
      const poolReserveBalanceExpected = await reserve.balanceOf(
        bPoolContract.address
      );
      const poolRedeemableBalanceExpected =
        await redeemableERC20Contract.balanceOf(bPoolContract.address);

      const query = `
        {
          pool (id: "${bPoolContract.address.toLowerCase()}") {
            swaps {
              id
            }
            numberOfSwaps
            poolReserveBalance
            poolRedeemableBalance
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.pool;

      expect(data.swaps).to.have.lengthOf(0);
      expect(data.numberOfSwaps).to.equals("0");
      expect(data.poolReserveBalance).to.equals(poolReserveBalanceExpected);
      expect(data.poolRedeemableBalance).to.equals(
        poolRedeemableBalanceExpected
      );
    });

    it("should query correctly the RedeemableERC20 Holders after StartDutchAuction", async function () {
      // Hypothetical Pool Holder ID
      const poolHolderId = `${redeemableERC20Contract.address.toLowerCase()} - ${bPoolContract.address.toLowerCase()}`;

      // Hypothetical CRP Holder ID
      const crpHolderId = `${redeemableERC20Contract.address.toLowerCase()} - ${crpContract.address.toLowerCase()}`;

      const query = `
        {
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            holders {
              id
            }
          }
          poolHolder: holder (id: "${poolHolderId}") {
            address
          }
          crpHolder: holder (id: "${crpHolderId}") {
            address
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });

      const dataHolders = queryResponse.data.redeemableERC20.holders;
      const poolHolderData = queryResponse.data.poolHolder;
      const crpHolderData = queryResponse.data.crpHolder;

      expect(dataHolders).to.be.empty;

      expect(poolHolderData).to.be.null;
      expect(crpHolderData).to.be.null;
    });

    it("should query the Swap entity correctly after a Swap", async function () {
      // 10% of the succesLevel
      const reserveSpend = finalValuation.div(10);

      // give to signer some reserve
      await reserve.transfer(signer2.address, reserveSpend);

      // Approve the pool to spend
      await reserve
        .connect(signer2)
        .approve(bPoolContract.address, reserveSpend);

      // Update weights
      await crpContract.connect(signer2).pokeWeights();

      // Make a swap
      transaction = await bPoolContract.connect(signer2).swapExactAmountIn(
        reserve.address, // The reserve of the trust
        reserveSpend,
        redeemableERC20Contract.address, // The same token in trust
        ethers.BigNumber.from("1"),
        ethers.BigNumber.from("1000000" + sixZeros)
      );

      const { tokenAmountOut } = (await getEventArgs(
        transaction,
        "LOG_SWAP",
        bPoolContract
      )) as LOG_SWAPEvent["args"];

      const [deployBlock, deployTime] = await getTxTimeblock(transaction);

      // Wait for sync
      await waitForSubgraphToBeSynced();

      const query = `
        {
          swaps {
            id
            caller
            userAddress
            tokenIn
            tokenOut
            tokenInSym
            tokenOutSym
            tokenAmountIn
            tokenAmountOut
            pool {
              id
            }
            deployBlock
            deployTimestamp
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const dataSwaps = queryResponse.data.swaps;
      const data = queryResponse.data.swaps[0];

      expect(dataSwaps).to.have.lengthOf(1);

      expect(data.id).to.equals(transaction.hash.toLowerCase());
      expect(data.caller).to.equals(signer2.address.toLowerCase());
      expect(data.userAddress).to.equals(signer2.address.toLowerCase());

      expect(data.tokenIn).to.equals(reserve.address.toLowerCase());
      expect(data.tokenInSym).to.equals(await reserve.symbol());
      expect(data.tokenAmountIn).to.equals(reserveSpend.toString());

      expect(data.tokenOut).to.equals(
        redeemableERC20Contract.address.toLowerCase()
      );
      expect(data.tokenOutSym).to.equals(
        await redeemableERC20Contract.symbol()
      );
      expect(data.tokenAmountOut).to.equals(tokenAmountOut.toString());

      expect(data.pool.id).to.equals(bPoolContract.address.toLowerCase());
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should update the Pool after a Swap", async function () {
      const poolReserveBalanceExpected = await reserve.balanceOf(
        bPoolContract.address
      );
      const poolRedeemableBalanceExpected =
        await redeemableERC20Contract.balanceOf(bPoolContract.address);

      const swapId = transaction.hash.toLowerCase();

      const query = `
        {
          pool (id: "${bPoolContract.address.toLowerCase()}") {
            swaps {
              id
            }
            numberOfSwaps
            poolReserveBalance
            poolRedeemableBalance
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.pool;

      expect(data.swaps).to.have.lengthOf(1);
      expect(data.swaps).to.deep.include({ id: swapId });

      expect(data.numberOfSwaps).to.equals("1");
      expect(data.poolReserveBalance).to.equals(poolReserveBalanceExpected);
      expect(data.poolRedeemableBalance).to.equals(
        poolRedeemableBalanceExpected
      );
    });

    it("should update the RedeemableERC20 holders after a Swap", async function () {
      // Now the signer2 have a RedeemableERC20 balance
      const holderId = `${redeemableERC20Contract.address.toLowerCase()} - ${signer2.address.toLowerCase()}`;

      const balanceExpected = await redeemableERC20Contract.balanceOf(
        signer2.address
      );

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
        query,
      });

      const dataHolders = queryResponse.data.redeemableERC20.holders;
      const data = queryResponse.data.holder;

      expect(dataHolders).to.have.lengthOf(1);
      expect(dataHolders).to.deep.include({ id: holderId });

      expect(data.address).to.equals(signer2.address.toLowerCase());
      expect(data.balance).to.equals(balanceExpected);
    });

    it("should update the DistributionProgress after a Swap", async function () {
      const poolReserveBalanceExpected = await reserve.balanceOf(
        bPoolContract.address
      );
      const poolRedeemableBalanceExpected =
        await redeemableERC20Contract.balanceOf(bPoolContract.address);

      // poolReserveBalance - reserveInit
      const amountRaisedExpected = poolReserveBalanceExpected.sub(reserveInit);

      // Using fixed numbers
      const amountRaisedFN = fixedNumber(amountRaisedExpected);
      const minimumRaise = fixedNumber(
        minimumCreatorRaise.add(redeemInit).add(seederFee)
      );

      const poolRedeemableBalanceFN = fixedNumber(
        poolRedeemableBalanceExpected
      );
      const redeemableInitSupplyFN = fixedNumber(
        redeemableERC20Config.initialSupply
      );

      // percentRaised = amountRaised / minimumRaise
      const percentRaisedExpected = amountRaisedFN
        .mulUnsafe(Util.oneHundredFN)
        .divUnsafe(minimumRaise);

      // percentAvailable = poolRedeemableBalance / RedeemableERC20.totalSupply
      const percentAvailableExpected = poolRedeemableBalanceFN
        .mulUnsafe(Util.oneHundredFN)
        .divUnsafe(redeemableInitSupplyFN);

      const query = `
        {
          distributionProgress (id: "${trust.address.toLowerCase()}") {
            poolReserveBalance
            poolRedeemableBalance
            amountRaised
            percentRaised
            percentAvailable
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.poolReserveBalance).to.equals(poolReserveBalanceExpected);
      expect(data.poolRedeemableBalance).to.equals(
        poolRedeemableBalanceExpected
      );
      expect(data.amountRaised).to.equals(amountRaisedExpected.toString());
      expect(data.percentRaised).to.equals(percentRaisedExpected.toString());
      expect(data.percentAvailable).to.equals(
        percentAvailableExpected.toString()
      );
    });

    it("should get the TrustParticipant after a Swap", async function () {
      const trustParticId = `${signer2.address.toLowerCase()} - ${trust.address.toLowerCase()}`;
      const balanceExpected = await redeemableERC20Contract.balanceOf(
        signer2.address
      );

      const swapId = transaction.hash.toLowerCase();

      const query = `
        {
          trust (id: "${trust.address.toLowerCase()}") {
            trustParticipants {
              id
            }
          }
          trustParticipant(id: "${trustParticId}"){
            address
            trust {
              id
            }
            tokenBalance
            swaps {
              id
            }
          }
        }
      `;
      const queryResponse = (await subgraph({
        query,
      })) as FetchResult;

      const dataTrust = queryResponse.data.trust;
      const data = queryResponse.data.trustParticipant;

      expect(dataTrust.trustParticipants).to.have.lengthOf(4);

      expect(data.swaps).to.have.lengthOf(1);
      expect(data.swaps).to.deep.include({ id: swapId });

      expect(data.address).to.equals(signer2.address.toLowerCase());
      expect(data.trust.id).to.equals(trust.address.toLowerCase());
      expect(data.tokenBalance).to.equals(balanceExpected);
    });

    it("should query the Pool correclty after a few Swaps", async function () {
      // Swaps 1 in this point
      let swapCounter = ethers.BigNumber.from("1");

      const reserveSpend = finalValuation.div(10);

      // While the bPool been lower than the finalValuation, should make a swap
      // And add 1 to the swapCounter
      while (
        (await reserve.balanceOf(bPoolContract.address)).lte(finalValuation)
      ) {
        await Util.swapReserveForTokens(
          crpContract,
          bPoolContract,
          reserve,
          redeemableERC20Contract,
          signer1,
          reserveSpend
        );
        swapCounter = swapCounter.add(1);
      }

      // Wait for sync
      await waitForSubgraphToBeSynced();

      const poolReserveBalanceExpected = await reserve.balanceOf(
        bPoolContract.address
      );
      const poolRedeemableBalanceExpected =
        await redeemableERC20Contract.balanceOf(bPoolContract.address);

      const query = `
        {
          pool (id: "${bPoolContract.address.toLowerCase()}") {
            poolReserveBalance
            poolRedeemableBalance
            numberOfSwaps
            swaps {
              id
            }
          }
        }
      `;
      const queryResponse = (await subgraph({
        query,
      })) as FetchResult;

      const data = queryResponse.data.pool;

      expect(data.swaps).to.have.lengthOf(swapCounter.toNumber());
      expect(data.numberOfSwaps).to.equals(swapCounter);
      expect(data.poolReserveBalance).to.equals(poolReserveBalanceExpected);
      expect(data.poolRedeemableBalance).to.equals(
        poolRedeemableBalanceExpected
      );
    });

    it("should update the DutchAuction entity after endDutchAuction is called", async function () {
      // Waiting until the block + 1 where the Trust can end distribution
      await Util.createEmptyBlock(
        tradStartBlock +
          1 +
          minimumTradingDuration -
          (await ethers.provider.getBlockNumber())
      );

      // Here should be able to get if it a succes of failed distribution

      // Arbitrary user: Use `signer1` to ends rase
      transaction = await trust.connect(signer1).endDutchAuction();

      await waitForSubgraphToBeSynced();

      // Get values from event
      const { finalBalance, seederPay, creatorPay, tokenPay, poolDust } =
        (await getEventArgs(
          transaction,
          "EndDutchAuction",
          trust
        )) as EndDutchAuctionEvent["args"];

      const query = `
        {
          dutchAuction(id: "${trust.address.toLowerCase()}"){
            enderAddress
            finalBalance
            seederPay
            creatorPay
            tokenPay
            poolDust
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.dutchAuction;

      expect(data.enderAddress).to.equals(signer1.address.toLowerCase());
      expect(data.finalBalance).to.equals(finalBalance);
      expect(data.seederPay).to.equals(seederPay);
      expect(data.creatorPay).to.equals(creatorPay);
      expect(data.tokenPay).to.equals(tokenPay);
      expect(data.poolDust).to.equals(poolDust);
    });

    it("should update the DistributionProgress after endDutchAuction", async function () {
      // Here should be able to get if it a succes of failed distribution

      // pool Balances. After endDutchAuction should be zero
      const poolReserveBalanceExpected = "0";
      const poolRedeemableBalanceExpected = "0";

      const { finalBalance, poolDust } = (await getEventArgs(
        transaction,
        "EndDutchAuction",
        trust
      )) as EndDutchAuctionEvent["args"];

      // amountRaised should stay frozen, equal before calling endDutchAuction
      // That value it is the finalBalance in trust + poolDust trapped on balancerPool - reserveInit
      const amountRaisedExpected = ethers.BigNumber.from(finalBalance)
        .add(poolDust)
        .sub(reserveInit);

      // Using Fixed Numbers
      const amountRaisedFN = fixedNumber(amountRaisedExpected);
      const minimumRaiseFN = fixedNumber(
        minimumCreatorRaise.add(redeemInit).add(seederFee)
      );

      // percentRaised = amountRaised / minimumRaise
      const percentRaisedExpected = amountRaisedFN
        .mulUnsafe(Util.oneHundredFN)
        .divUnsafe(minimumRaiseFN)
        .toString();

      // poolRedeemableBalance / RedeemableERC20.totalSupply
      const percentAvailableExpected = "0";

      const query = `
        {
          distributionProgress (id: "${trust.address.toLowerCase()}"){
            distributionStatus
            poolReserveBalance
            poolRedeemableBalance
            amountRaised
            percentRaised
            percentAvailable
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.distributionProgress;

      expect(data.distributionStatus).to.equals(DistributionStatus.Success);

      expect(data.poolReserveBalance).to.equals(poolReserveBalanceExpected);
      expect(data.poolRedeemableBalance).to.equals(
        poolRedeemableBalanceExpected
      );

      expect(data.amountRaised).to.equals(
        amountRaisedExpected,
        `wrong amountRaised: should be frozen after endDutchAuction`
      );
      expect(data.percentRaised).to.equals(percentRaisedExpected.slice(0, -1));
      expect(data.percentAvailable).to.equals(percentAvailableExpected);
    });

    it("should update the Pool after endDutchAuction", async function () {
      // pool Balances. After endDutchAuction should be zero
      const poolReserveBalanceExpected = "0";
      const poolRedeemableBalanceExpected = "0";

      const query = `
        {
          pool (id: "${bPoolContract.address.toLowerCase()}") {
            poolReserveBalance
            poolRedeemableBalance
          }
        }
      `;
      const queryResponse = (await subgraph({
        query,
      })) as FetchResult;

      const data = queryResponse.data.pool;

      expect(data.poolReserveBalance).to.equals(poolReserveBalanceExpected);
      expect(data.poolRedeemableBalance).to.equals(
        poolRedeemableBalanceExpected
      );
    });

    it("should query Seeder Holder after pull the SeedERC20 correctly", async function () {
      // The trust creator  pulls the reserve
      await reserve
        .connect(creator)
        .transferFrom(
          trust.address,
          creator.address,
          await reserve.allowance(trust.address, creator.address)
        );

      // seeder1 pulls erc20 in SeedERC20 contract
      await seedContract
        .connect(seeder1)
        .pullERC20(
          await reserve.allowance(trust.address, seedContract.address)
        );

      await waitForSubgraphToBeSynced();

      const seeder1holderId = `${seedContract.address.toLowerCase()} - ${seeder1.address.toLowerCase()}`;
      const balanceExpected = await seedContract.balanceOf(seeder1.address);

      const query = `
        {
          holder (id: "${seeder1holderId}"){
            address
            balance
          }
        }
      `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.holder;

      expect(data.address).to.equals(seeder1.address.toLowerCase());
      expect(data.balance).to.equals(balanceExpected);
    });

    it("should query the RedeemSeed after a redeem in SeedERC20", async function () {
      // Call redeem with seeder1
      transaction = await seedContract.connect(seeder1).redeem(seeder1Units, 0);

      await waitForSubgraphToBeSynced();

      // Using the tx saved
      const [deployBlock, deployTime] = await getTxTimeblock(transaction);

      const { redeemAmount, assetAmount } = (await getEventArgs(
        transaction,
        "Redeem",
        seedContract
      )) as RedeemEvent["args"];

      const redeemSeedId = `${transaction.hash.toLowerCase()} - 0`;

      const query = `
        {
          redeemSeeds {
            id
            caller
            seedERC20 {
              id
            }
            redeemAmount
            treasuryAssetAmount
            deployBlock
            deployTimestamp
          }
        }
      `;
      const queryResponse = await subgraph({
        query,
      });
      const dataRedeems = queryResponse.data.redeemSeeds;
      const data = dataRedeems[0];

      expect(dataRedeems).to.have.lengthOf(1);

      expect(data.id).to.equals(redeemSeedId);
      expect(data.caller).to.equals(seeder1.address.toLowerCase());
      expect(data.seedERC20.id).to.equals(seedContract.address.toLowerCase());

      expect(data.redeemAmount).to.equals(redeemAmount);
      expect(data.treasuryAssetAmount).to.equals(assetAmount);
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should update the TrustParticipant after a redeem in SeedERC20", async function () {
      const trustParticId = `${seeder1.address.toLowerCase()} - ${trust.address.toLowerCase()}`;
      const redeemSeedId = `${transaction.hash.toLowerCase()} - 0`;

      const query = `
       {
        trustParticipant (id: "${trustParticId}") {
          redeemSeeds {
            id
          }
        }
       }
     `;
      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.trustParticipant.redeemSeeds;

      expect(data).to.have.lengthOf(1);

      expect(data).to.deep.include({ id: redeemSeedId });
    });

    it("should update the SeedERC20 after a redeem", async function () {
      const redeemSeedId = `${transaction.hash.toLowerCase()} - 0`;

      const query = `
       {
        seedERC20 (id: "${seedContract.address.toLowerCase()}") {
          redeemSeeds {
            id
          }
        }
       }
     `;
      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.seedERC20.redeemSeeds;

      expect(data).to.have.lengthOf(1);

      expect(data).to.deep.include({ id: redeemSeedId });
    });

    it("should query the RedeemableERC20 holder after pull correclty", async function () {
      await redeemableERC20Contract
        .connect(signer2)
        .pullERC20(
          await reserve.allowance(
            trust.address,
            redeemableERC20Contract.address
          )
        );

      await waitForSubgraphToBeSynced();

      const seeder2holderId = `${redeemableERC20Contract.address.toLowerCase()} - ${signer2.address.toLowerCase()}`;
      const balanceExpected = await redeemableERC20Contract.balanceOf(
        signer2.address
      );
      const query = `
          {
            holder (id: "${seeder2holderId}") {
              address
              balance
            }
          }
        `;

      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.holder;

      expect(data.address).to.equals(signer2.address.toLowerCase());
      expect(data.balance).to.equals(balanceExpected);
    });

    it("should query the Redeem after a redeem in RedeemableERC20 ", async function () {
      transaction = await redeemableERC20Contract
        .connect(signer2)
        .redeem(
          [reserve.address],
          await redeemableERC20Contract.balanceOf(signer2.address)
        );

      await waitForSubgraphToBeSynced();

      const redeemId = `${transaction.hash.toLowerCase()} - 0`;

      // The treasuryAssets ID
      const treasuryAssetsId = `${redeemableERC20Contract.address.toLowerCase()} - ${reserve.address.toLowerCase()}`;

      // Using the tx saved
      const [deployBlock, deployTime] = await getTxTimeblock(transaction);

      const { redeemAmount, assetAmount } = (await getEventArgs(
        transaction,
        "Redeem",
        redeemableERC20Contract
      )) as RedeemEvent["args"];

      const query = `
        {
          redeems {
            id
            trust {
              id
            }
            caller
            treasuryAsset {
              id
            }
            redeemableERC20 {
              id
            }
            redeemAmount
            treasuryAssetAmount
            deployBlock
            deployTimestamp
          }
        }
      `;
      const queryResponse = await subgraph({
        query,
      });
      const dataArr = queryResponse.data.redeems;
      const data = dataArr[0];

      expect(dataArr).to.have.lengthOf(1);
      expect(data.id).to.equals(redeemId);

      expect(data.caller).to.equals(signer2.address.toLowerCase());
      expect(data.trust.id).to.equals(trust.address.toLowerCase());
      expect(data.treasuryAsset.id).to.equals(treasuryAssetsId);
      expect(data.redeemableERC20.id).to.equals(
        redeemableERC20Contract.address.toLowerCase()
      );

      expect(data.redeemAmount).to.equals(redeemAmount);
      expect(data.treasuryAssetAmount).to.equals(assetAmount);
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should query the redeem in TreasuryAssets and RedeemableERC20 after a redeem", async function () {
      // The treasuryAssets ID
      const treasuryAssetsId = `${redeemableERC20Contract.address.toLowerCase()} - ${reserve.address.toLowerCase()}`;
      const redeemId = `${transaction.hash.toLowerCase()} - 0`;

      const query = `
        {
          treasuryAsset (id: "${treasuryAssetsId}") {
            redeems {
              id
            }
          }
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            redeems {
              id
            }
          }
        }
      `;
      const queryResponse = await subgraph({
        query,
      });
      const dataTAsset = queryResponse.data.treasuryAsset;
      const dataRedeemable = queryResponse.data.redeemableERC20;

      expect(dataTAsset.redeems).to.have.lengthOf(1);
      expect(dataRedeemable.redeems).to.have.lengthOf(1);

      expect(dataTAsset.redeems).to.deep.include({ id: redeemId });
      expect(dataRedeemable.redeems).to.deep.include({ id: redeemId });
    });

    it("should update the TrustParticipant after a redeem in RedeemableERC20", async function () {
      const trustParticId = `${signer2.address.toLowerCase()} - ${trust.address.toLowerCase()}`;
      const redeemId = `${transaction.hash.toLowerCase()} - 0`;

      const query = `
       {
        trustParticipant (id: "${trustParticId}") {
          redeems {
            id
          }
        }
       }
     `;
      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.trustParticipant.redeems;

      expect(data).to.have.lengthOf(1);

      expect(data).to.deep.include({ id: redeemId });
    });
  });

  describe("Trust with a non-SeedERC20 contract as Seeder", function () {
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
      distributor: zeroAddress,
      initialSupply: totalTokenSupply,
    };
    // - Seeder props
    const seederFee = ethers.BigNumber.from("100" + sixZeros);
    const seederUnits = 10;
    const seedERC20Config = {
      name: "SeedToken",
      symbol: "SDT",
      distributor: zeroAddress,
      initialSupply: seederUnits,
    };
    const seederCooldownDuration = 1;
    const finalValuation = redeemInit
      .add(minimumCreatorRaise)
      .add(seederFee)
      .add(reserveInit);

    // This should force to no create a seed contract
    let seederNonContract: string;

    before("Create the trust with user as Seeder", async function () {
      // Deploying new reserve to test
      reserve = await new ReserveTokenTest__factory(deployer).deploy();

      // Deploying a new balanceTier to new Trust
      erc20BalanceTier = await Util.erc20BalanceTierDeploy(
        erc20BalanceTierFactory,
        creator,
        {
          erc20: reserve.address,
          tierValues: LEVELS,
        }
      );

      // Giving the necessary amount to signer1 and signer2 for a level 4
      minimumTier = Tier.FOUR;
      const level4 = LEVELS[minimumTier - 1];
      await reserve.transfer(signer1.address, level4);

      // This should force to no create a seed contract
      seederNonContract = signer1.address;

      trust = (await Util.trustDeploy(
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
          finalValuation,
          minimumTradingDuration,
        },
        {
          erc20Config: redeemableERC20Config,
          tier: erc20BalanceTier.address,
          minimumTier,
        },
        {
          seeder: seederNonContract, // This should force to no create a seed contract
          cooldownDuration: seederCooldownDuration,
          erc20Config: seedERC20Config,
        },
        { gasLimit: 15000000 }
      )) as Trust;

      // Creating the instance for contracts
      redeemableERC20Contract = new RedeemableERC20__factory(deployer).attach(
        await Util.getChild(redeemableERC20Factory, trust.deployTransaction)
      );
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      redeemableERC20Contract.deployTransaction = trust.deployTransaction;

      // Get the CRP contract
      ({ crp: crpContract } = await Util.poolContracts(trust, creator));

      // Wait for Sync
      await waitForSubgraphToBeSynced();
    });

    it("should continue query if the seeder is a non-SeedERC20 contract", async function () {
      const query = `
        {
          trust (id: "${trust.address.toLowerCase()}") {
            contracts {
              reserveERC20 {
                id
              }
              redeemableERC20 {
                id
              }
              seeder {
                id
              }
            }
          }
        }
      `;
      const queryResponse = await subgraph({
        query,
      });
      const data = queryResponse.data.trust.contracts;

      expect(data.reserveERC20.id).to.equals(reserve.address.toLowerCase());
      expect(data.redeemableERC20.id).to.equals(
        redeemableERC20Contract.address.toLowerCase()
      );
      expect(data.seeder.id).to.equals(seederNonContract.toLowerCase());
    });
  });
});
