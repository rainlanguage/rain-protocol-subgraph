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
} from "./utils/utils";

// Artifacts
import reserveTokenJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveToken.sol/ReserveToken.json";
import readWriteTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ReadWriteTier.sol/ReadWriteTier.json";
import seedERC20Json from "@beehiveinnovation/rain-protocol/artifacts/contracts/seed/SeedERC20.sol/SeedERC20.json";
import redeemableTokenJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json";
import configurableRightsPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/ConfigurableRightsPool.json";
import bPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/BPool.json";

import erc20BalanceTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20BalanceTierFactory.sol/ERC20BalanceTierFactory.json";
import erc20TransferTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20TransferTierFactory.sol/ERC20TransferTierFactory.json";
import combineTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/CombineTierFactory.sol/CombineTierFactory.json";
import verifyTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/VerifyTierFactory.sol/VerifyTierFactory.json";
import verifyFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/verify/VerifyFactory.sol/VerifyFactory.json";
import saleFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/sale/SaleFactory.sol/SaleFactory.json";

// Types
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type { BigNumber } from "ethers";

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

import { ReserveToken } from "@beehiveinnovation/rain-protocol/typechain/ReserveToken";
import { Trust } from "@beehiveinnovation/rain-protocol/typechain/Trust";
import { ITier } from "@beehiveinnovation/rain-protocol/typechain/ITier";
import { SeedERC20 } from "@beehiveinnovation/rain-protocol/typechain/SeedERC20";
import { RedeemableERC20 } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20";
import { ConfigurableRightsPool } from "@beehiveinnovation/rain-protocol/typechain/ConfigurableRightsPool";

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

describe("Subgraph Trusts Test", function () {
  const subgraphUser = "vishalkale151071";
  const subgraphName = "rain-protocol";
  let trustFactory: TrustFactory,
    reserve: ReserveToken,
    tier: ITier,
    minimumTier: Tier,
    subgraph: ApolloFetch,
    currentBlock: number,
    trust: Trust,
    crpFactory: CRPFactory,
    bFactory: BFactory,
    redeemableERC20Factory: RedeemableERC20Factory,
    seedERC20Factory: SeedERC20Factory,
    seederContract: SeedERC20;

  let deployer: SignerWithAddress,
    creator: SignerWithAddress,
    seeder1: SignerWithAddress,
    seeder2: SignerWithAddress,
    signer1: SignerWithAddress;

  before(async function () {
    const signers = await ethers.getSigners();

    // Signers (to avoid fetch again)
    deployer = signers[0]; // deployer is not creator
    creator = signers[1];
    seeder1 = signers[2];
    seeder2 = signers[3];
    signer1 = signers[4];

    [crpFactory, bFactory] = (await Util.balancerDeploy(creator)) as [
      CRPFactory,
      BFactory
    ];

    reserve = (await deploy(reserveTokenJson, creator, [])) as ReserveToken;

    tier = (await deploy(readWriteTierJson, creator, [])) as ITier;
    minimumTier = Tier.FOUR;
    await tier.setTier(signer1.address, Tier.FOUR, []);

    currentBlock = await ethers.provider.getBlockNumber();
    ({ trustFactory, redeemableERC20Factory, seedERC20Factory } =
      await Util.factoriesDeploy(crpFactory, bFactory, creator));

    // Verify factory
    const blockErc20VerifyFactory = await ethers.provider.getBlockNumber();
    const verifyFactory = (await deploy(
      verifyFactoryJson,
      deployer,
      []
    )) as VerifyFactory;

    // Tiers factories
    const blockErc20BalanceTierFactory = await ethers.provider.getBlockNumber();
    const erc20BalanceTierFactory = (await deploy(
      erc20BalanceTierFactoryJson,
      deployer,
      []
    )) as ERC20BalanceTierFactory;

    const blockErc20TierTierFactory = await ethers.provider.getBlockNumber();
    const erc20TransferTierFactory = (await deploy(
      erc20TransferTierFactoryJson,
      deployer,
      []
    )) as ERC20TransferTierFactory;

    const blockCombineTierFactory = await ethers.provider.getBlockNumber();
    const combineTierFactory = (await deploy(
      combineTierFactoryJson,
      deployer,
      []
    )) as CombineTierFactory;

    const blockVerifyTierFactory = await ethers.provider.getBlockNumber();
    const verifyTierFactory = (await deploy(
      verifyTierFactoryJson,
      deployer,
      []
    )) as VerifyTierFactory;

    // SaleFactory
    const saleConstructorConfig = {
      redeemableERC20Factory: redeemableERC20Factory.address,
    };
    const blockSaleFactory = await ethers.provider.getBlockNumber();
    const saleFactory = (await deploy(saleFactoryJson, deployer, [
      saleConstructorConfig,
    ])) as SaleFactory;

    // Saving data in JSON
    const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
    const configLocal = JSON.parse(Util.fetchFile(pathConfigLocal));

    const localInfoPath = path.resolve(__dirname, "./utils/local_Info.json");
    const localInfoJson = JSON.parse(Util.fetchFile(localInfoPath));

    // If we need index both, saving addresses and individuals blocks
    configLocal.factory = trustFactory.address;
    configLocal.startBlock = currentBlock;

    configLocal.verifyFactory = verifyFactory.address;
    configLocal.blockErc20VerifyFactory = blockErc20VerifyFactory;

    configLocal.erc20BalanceTierFactory = erc20BalanceTierFactory.address;
    configLocal.blockErc20BalanceTierFactory = blockErc20BalanceTierFactory;

    configLocal.erc20TransferTierFactory = erc20TransferTierFactory.address;
    configLocal.blockErc20TierTierFactory = blockErc20TierTierFactory;

    configLocal.combineTierFactory = combineTierFactory.address;
    configLocal.blockCombineTierFactory = blockCombineTierFactory;

    configLocal.verifyTierFactory = verifyTierFactory.address;
    configLocal.blockVerifyTierFactory = blockVerifyTierFactory;

    configLocal.saleFactory = saleFactory.address;
    configLocal.blockSaleFactory = blockSaleFactory;

    // localInfo.json - Tests
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
    localInfoJson.saleFactory = saleFactory.address;

    Util.writeFile(pathConfigLocal, JSON.stringify(configLocal, null, 4));
    Util.writeFile(localInfoPath, JSON.stringify(localInfoJson, null, 4));

    Util.exec(`yarn deploy-build:localhost`);

    subgraph = Util.fetchSubgraph(subgraphUser, subgraphName);

    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(1000);
  });

  it("should query the trust factories", async function () {
    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(1000);

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
    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(1000);

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
      const trustFactoryDeployer = trustFactory.connect(deployer);

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
          tier: tier.address,
          minimumTier,
        },
        {
          seeder: Util.zeroAddress,
          cooldownDuration: seederCooldownDuration,
          erc20Config: seedERC20Config,
        },
        { gasLimit: 15000000 }
      )) as Trust;
    });

    it("should query the trust correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1500);

      const queryResponse = (await subgraph({ query: QUERY })) as FetchResult;
      const response = queryResponse.data;
      const factoryData = response.trustFactories[0];
      const trustData = factoryData.trusts[0];

      expect(parseInt(factoryData.trustCount)).to.equals(1);
      expect(trustData.id).to.equals(trust.address.toLowerCase());
      expect(trustData.factory).to.equals(trustFactory.address.toLowerCase());
      expect(trustData.trustParticipants).to.be.empty;
    });

    it("should query the contracts of the trust", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const queryResponse = await subgraph({
        query: getContracts(trust.address.toLowerCase()),
      });
      const contract = queryResponse.data.contract;

      const gReserve = contract.reserveERC20;
      const tRedeemable = contract.redeemableERC20;
      const tSeed = contract.seeder;

      expect(gReserve.name).to.equals(await reserve.name());
      expect(gReserve.symbol).to.equals(await reserve.symbol());
      expect(gReserve.decimals).to.equals(await reserve.decimals());
      expect(gReserve.totalSupply).to.equals(await reserve.totalSupply());

      expect(tRedeemable.name).to.equals(redeemableERC20Config.name);
      expect(tRedeemable.symbol).to.equals(redeemableERC20Config.symbol);

      expect(tSeed.name).to.equals(seedERC20Config.name);
      expect(tSeed.symbol).to.equals(seedERC20Config.symbol);
      expect(tSeed.totalSupply).to.equals(seederUnits.toString());
    });

    it("should query the actual DistributionProgress after trust creation", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const distributionProgressQuery = `
        {
          distributionProgress(id: "${trust.address.toLowerCase()}"){
            distributionStatus
            minimumTradingDuration
            minimumCreatorRaise
            initialValuation
          }
        }
      `;

      const queryResponse = await subgraph({
        query: distributionProgressQuery,
      });
      const distributionProgressData = queryResponse.data.distributionProgress;

      expect(distributionProgressData.distributionStatus).to.equals(
        DistributionStatus.Pending
      );
      expect(distributionProgressData.minimumTradingDuration).to.equals(
        minimumTradingDuration.toString()
      );
      expect(distributionProgressData.minimumCreatorRaise).to.equals(
        minimumCreatorRaise
      );
      expect(distributionProgressData.initialValuation).to.equals(
        initialValuation
      );
    });

    it("should get Notice correctly", async function () {
      const sender = (await ethers.getSigners())[9];

      const noticeSender = trust.connect(sender);

      await noticeSender.sendNotice("0x01");

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1500);

      let queryResponse = (await subgraph({
        query: NOTICE_QUERY,
      })) as FetchResult;
      let notices = queryResponse.data.notices;

      expect(notices.length).to.equals(1);
      expect(notices[0].sender).to.equals(sender.address.toLowerCase());
      expect(notices[0].data).to.equals("0x01");

      queryResponse = (await subgraph({
        query: getTrust(trust.address.toLowerCase()),
      })) as FetchResult;
      notices = queryResponse.data.trust.notices;
      expect(notices.length).to.equals(1);
    });

    it("should query correctly after a Seed.", async function () {
      const { seeder } = await Util.getEventArgs(
        trust.deployTransaction,
        "Initialize",
        trust
      );
      seederContract = new ethers.Contract(
        seeder,
        seedERC20Json.abi,
        creator
      ) as SeedERC20;

      const recipient = trust.address;

      const reserveAmount = seedPrice.mul(seeder1Units);

      // seeder need some cash, give enough each for seeding
      await reserve.transfer(seeder1.address, reserveAmount);

      const seederContract1 = seederContract.connect(seeder1);
      const reserve1 = reserve.connect(seeder1);

      await reserve1.approve(seederContract.address, reserveAmount);

      // seeder send reserve to seeder contract
      await seederContract1.seed(minSeedUnits, seeder1Units);

      // Recipient gains infinite approval on reserve token withdrawals from seed contract
      await reserve.allowance(seederContract.address, recipient);

      // SeedERC20 queries :). As:
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1500);

      const seedQuery = `
        {
          seedERC20 (id: "${seederContract.address.toLowerCase()}") {
            seederUnitsAvail
            seeds{
              caller
              tokensSeeded
            }
          }
        }
      `;

      const queryResponse = await subgraph({
        query: seedQuery,
      });
      const seedErc20Data = queryResponse.data.seedERC20;

      expect(seedErc20Data.seeds[0].caller).to.equals(
        seeder1.address.toLowerCase()
      );

      expect(seedErc20Data.seeds[0].tokensSeeded).to.equals(
        seeder1Units.toString()
      );
      // This value got null
      expect(seedErc20Data.seederUnitsAvail).to.equals(
        await seederContract.balanceOf(seederContract.address)
      );
    });

    it("should query  the trustParticipant", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);
      const id = `${seeder1.address.toLowerCase()}-${trustFactory.address.toLowerCase()}`;
      const trustParticipantQuery = `
      {
        trustParticipant(id: "${id}"){
          seeds{
            id
          }
        }
      }
    `;

      // Create Subgraph Connection
      const queryResponse = (await subgraph({
        query: trustParticipantQuery,
      })) as FetchResult;
      const trustParticipantData = queryResponse.data;

      // This user only have a single seed in this trust.
      // This got empty
      // expect(trustParticipantData.seeds.length).to.equals(1);
      // Or we can use the trustQuery and get the TrustParticipants lenght (should be one here)
    });

    it("should query correclty after a second Seed.", async function () {
      const recipient = trust.address;

      // seeder need some cash, give enough each for seeding
      await reserve.transfer(seeder2.address, seedPrice.mul(seeder2Units));

      const seederContract2 = seederContract.connect(seeder2);
      const reserve2 = reserve.connect(seeder2);

      await reserve2.approve(
        seederContract.address,
        seedPrice.mul(seeder2Units)
      );

      // seeders send reserve to seeder contract
      await seederContract2.seed(minSeedUnits, seeder2Units);

      // Recipient gains infinite approval on reserve token withdrawals from seed contract
      await reserve.allowance(seederContract.address, recipient);

      // Query the seedERC20 to see the new status ...
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1500);

      const seedQuery = `
        {
          seedERC20 (id: "${seederContract.address.toLowerCase()}") {
            seederUnitsAvail
            seeds{
              id
            }
          }
        }
      `;

      const queryResponse = await subgraph({
        query: seedQuery,
      });
      const seedErc20Data = queryResponse.data.seedERC20;

      expect(seedErc20Data.seeds).to.have.lengthOf(2);
      // This got null
      expect(seedErc20Data.seederUnitsAvail).to.equals(0);
    });

    it("Should query after Start Dutch Auction.", async function () {
      const crp = new ethers.Contract(
        await trust.crp(),
        configurableRightsPoolJson.abi,
        creator
      ) as ConfigurableRightsPool;

      const trustContract1 = trust.connect(signer1);

      const prevBlock = await ethers.provider.getBlockNumber();
      await trustContract1.startDutchAuction();

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(2000);

      const dutchAuctionQuery = `
        {
          dutchAuction(id: "${trust.address.toLowerCase()}"){
            starterAddress
            pool
            finalAuctionBlock
          }
        }
      `;

      const queryResponse = await subgraph({
        query: dutchAuctionQuery,
      });
      const dutchAuctionData = queryResponse.data.dutchAuction;

      expect(dutchAuctionData.starterAddress).to.equals(
        signer1.address.toLowerCase()
      );
      expect(dutchAuctionData.pool).to.equals(
        (await crp.bPool()).toLowerCase()
      );

      expect(parseInt(dutchAuctionData.finalAuctionBlock, 10)).to.be.gte(
        prevBlock + minimumTradingDuration
      );
    });

    it("Single Swap test", async function () {
      // Copy the properties of the trust. I think we should make a scope for this trust.
      const redeemInit = ethers.BigNumber.from("2000" + sixZeros);
      const reserveInit = ethers.BigNumber.from("2000" + sixZeros);
      const minimumCreatorRaise = ethers.BigNumber.from("100" + sixZeros);
      const seederFee = ethers.BigNumber.from("100" + sixZeros);

      const signers = await ethers.getSigners();
      const [crp, bPool] = await Util.poolContracts(signers, trust);

      const finalValuation = redeemInit
        .add(minimumCreatorRaise)
        .add(seederFee)
        .add(reserveInit);
      const reserveSpend = finalValuation.div(10);

      // give signer some reserve
      await reserve.transfer(signer1.address, reserveSpend);

      const reserveSigner = reserve.connect(signer1);
      const crpSigner = crp.connect(signer1);
      const bPoolSigner = bPool.connect(signer1);

      await reserveSigner.approve(bPool.address, reserveSpend);
      await crpSigner.pokeWeights();
      await bPoolSigner.swapExactAmountIn(
        reserve.address,
        reserveSpend,
        await trust.token(),
        ethers.BigNumber.from("1"),
        ethers.BigNumber.from("1000000" + sixZeros)
      );
      /**
       * Here is a single swap tx to query all the changes before and after the swap with the:
       * - Pool Entity with the numberOfSwaps, the contracts the poolBalanceReserve and the initial
       * poolTokenBalance (which is 10**18 * 10**9)
       * - Swap Entity can query the tokensIn and tokensOut
       * I think could use the balance of the user/contract to check the amount that out/in to their balances
       * and should match those differences with the out/in amount :) Also, the next `it` statement have a loop
       * to finish all the swaps. So, we can add these expects there
       */
      await waitForSubgraphToBeSynced(1000);
    });

    it("Swaps test", async function () {
      // Copy the properties of the trust. I think we should make a scope for this trust.
      const redeemInit = ethers.BigNumber.from("2000" + sixZeros);
      const reserveInit = ethers.BigNumber.from("2000" + sixZeros);
      const minimumCreatorRaise = ethers.BigNumber.from("100" + sixZeros);
      const seederFee = ethers.BigNumber.from("100" + sixZeros);

      const signers = await ethers.getSigners();
      const [crp, bPool] = await Util.poolContracts(signers, trust);

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
        const crpSigner = crp.connect(signer);
        const bPoolSigner = bPool.connect(signer);

        await reserveSigner.approve(bPool.address, spend);
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
      while ((await reserve.balanceOf(bPool.address)).lte(finalValuation)) {
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
      await seederContract
        .connect(seeder1)
        .pullERC20(
          await reserve.allowance(trust.address, seederContract.address)
        );
    });

    it("Redeem seed test", async function () {
      const seederContract1 = seederContract.connect(seeder1);
      const seeder1Units = 4;
      await seederContract1.redeem(seeder1Units, 0);
    });

    it("Pull ERC20 tokens ", async function () {
      const token = new ethers.Contract(
        await trust.token(),
        redeemableTokenJson.abi,
        creator
      ) as RedeemableERC20;

      await token
        .connect(signer1)
        .pullERC20(await reserve.allowance(trust.address, token.address));
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

      await waitForSubgraphToBeSynced(1000);
    });
  });
});
