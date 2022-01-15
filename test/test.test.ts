/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import * as Utils from "./utils";
import {
  deploy,
  waitForSubgraphToBeSynced,
  fetchSubgraph,
  exec,
} from "./utils";
import fs from "fs";

import { ApolloFetch, FetchResult } from "apollo-fetch";
import { queryTrustFactories } from "./queries";
import { TrustFactoryQuery } from "./types";

// Contract Factories
import BFACTORY from "@beehiveinnovation/balancer-core/artifacts/BFactory.json";
import CRPFACTORY from "@beehiveinnovation/configurable-rights-pool/artifacts/CRPFactory.json";
import TRUSTFACTORY from "@beehiveinnovation/rain-protocol/artifacts/contracts/trust/TrustFactory.sol/TrustFactory.json";

// Rain protocol contracts
import RESERVE_TOKEN from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveToken.sol/ReserveToken.json";
import READWRITE_TIER from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ReadWriteTier.sol/ReadWriteTier.json";
import TIERBYCONSTRUCTION from "@beehiveinnovation/rain-protocol/artifacts/contracts/claim/TierByConstructionClaim.sol/TierByConstructionClaim.json";
import SEED from "@beehiveinnovation/rain-protocol/artifacts/contracts/seed/SeedERC20.sol/SeedERC20.json";
import REDEEMABLEERC20 from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json";

// Types
import type { ConfigurableRightsPool } from "@beehiveinnovation/rain-protocol//typechain/ConfigurableRightsPool";
import type { BPool } from "@beehiveinnovation/rain-protocol//typechain/BPool";
import type { TierByConstructionClaim } from "@beehiveinnovation/rain-protocol/typechain/TierByConstructionClaim";
import type { ReadWriteTier } from "@beehiveinnovation/rain-protocol//typechain/ReadWriteTier";
import type { ReserveToken } from "@beehiveinnovation/rain-protocol//typechain/ReserveToken";
import type { SeedERC20 } from "@beehiveinnovation/rain-protocol//typechain/SeedERC20";
import type { RedeemableERC20 } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20";
import type { TrustFactory } from "@beehiveinnovation/rain-protocol/typechain/TrustFactory";

// Contract addresses deployed
import ADDRESSES from "./addresess-test.json";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Subgraph
let subgraph: ApolloFetch;
const subgraphUser = "vishalkale151071";
const subgraphName = "rain-protocol";

let crpFactory: Contract,
  bFactory: Contract,
  trustFactory: Contract & TrustFactory,
  reserveToken: Contract & ReserveToken, // A reserver token
  readWriteTier: Contract & ReadWriteTier,
  tierByConstructionClaim: Contract & TierByConstructionClaim;

// T
let token: Contract & RedeemableERC20, // redeemableERC20
  seederContract: Contract & SeedERC20, // SeedERC20
  crp: Contract & ConfigurableRightsPool, // ConfigurableRightsPool
  bPool: Contract & BPool; // Balancer pool

let signers: Signer[],
  creator: Signer,
  deployer: Signer, // deployer is not creator
  seeder1: Signer,
  seeder2: Signer,
  signer1: Signer;

let trustCount: any;

enum Tier {
  NIL,
  COPPER,
  BRONZE,
  SILVER,
  GOLD,
  PLATINUM,
  DIAMOND,
  CHAD,
  JAWAD,
}

describe("TheGraph - Rain Protocol", () => {
  before("Attaching factories", async () => {
    signers = await ethers.getSigners();
    creator = signers[0];
    deployer = signers[1]; // deployer is not creator
    seeder1 = signers[2];
    seeder2 = signers[3];
    signer1 = signers[4];

    // Configurable Right Pool Factory
    crpFactory = new ethers.Contract(
      ADDRESSES.crpFactory,
      CRPFACTORY.abi,
      creator
    ) as Contract;

    // Balancer Factory
    bFactory = new ethers.Contract(
      ADDRESSES.bFactory,
      BFACTORY.abi,
      creator
    ) as Contract;

    // Trust Factory
    trustFactory = new ethers.Contract(
      ADDRESSES.trustFactory,
      TRUSTFACTORY.abi,
      creator
    ) as Contract & TrustFactory;

    // Create Subgraph Connection
    subgraph = fetchSubgraph(subgraphUser, subgraphName);

    // Query trust count (just for testing rn, we can remove it)
    await waitForSubgraphToBeSynced(1000);
    const queryTrustCount = `
    {
      trustFactories {
        id
        trustCount
      }
    }
    
    `;
    const queryTrustCountresponse = (await subgraph({ query: queryTrustCount })) as FetchResult;
    trustCount = queryTrustCountresponse.data.trustFactories[0].trustCount
    expect(parseInt(queryTrustCountresponse.data.trustFactories[0].trustCount)).to.equals(0)
  });

  it("Creating a trust", async () => {
    const config = { gasLimit: 20000000 };
    
    const erc20Config = { name: "Token", symbol: "TKN" };
    const seedERC20Config = { name: "SeedToken", symbol: "SDT" };

    const reserveInit = ethers.BigNumber.from("2000" + Utils.sixZeros);
    const redeemInit = ethers.BigNumber.from("2000" + Utils.sixZeros);
    const totalTokenSupply = ethers.BigNumber.from("2000" + Utils.eighteenZeros);
    const initialValuation = ethers.BigNumber.from("20000" + Utils.sixZeros);
    const minimumCreatorRaise = ethers.BigNumber.from("100" + Utils.sixZeros);

    const seederFee = ethers.BigNumber.from("100" + Utils.sixZeros);
    const seederUnits = 10;
    const seederCooldownDuration = 1;
    const seedPrice = reserveInit.div(10);

    const successLevel = redeemInit
      .add(minimumCreatorRaise)
      .add(seederFee)
      .add(reserveInit);
    const finalValuation = successLevel;

    const minimumTradingDuration = 50;
    const minimumTier = Tier.GOLD;

    reserveToken = (await deploy(RESERVE_TOKEN, creator, [])) as Contract &
      ReserveToken;

    readWriteTier = (await deploy(READWRITE_TIER, creator, [])) as Contract &
      ReadWriteTier;
    
    await readWriteTier.setTier(await signer1.getAddress(), Tier.GOLD, []);// Tier.THREE

    // Using the trust factory
    const trustFactoryDeployer = trustFactory.connect(deployer);
    const trust = await Utils.trustDeploy(
      trustFactoryDeployer,
      creator,
      {
        creator: await creator.getAddress(),
        minimumCreatorRaise,
        seederFee,
        redeemInit,
        reserve: reserveToken.address,
        reserveInit,
        initialValuation,
        finalValuation,
        minimumTradingDuration,
      },
      {
        erc20Config,
        tier: readWriteTier.address,
        minimumTier,
        totalSupply: totalTokenSupply,
      },
      {
        seeder: Utils.zeroAddress,
        seederUnits,
        seederCooldownDuration,
        seedERC20Config,
      },
      config
    );

    await trust.deployed();
    // trustCount = trustCount.add(1);

    const { seeder } = await Utils.getEventArgs(
      trust.deployTransaction,
      "Initialize",
      trust
    );

    const seederContract = new ethers.Contract(
      seeder,
      SEED.abi,
      creator
    ) as SeedERC20 & Contract;

    token = new ethers.Contract(
      await trust.token(),
      REDEEMABLEERC20.abi,
      creator
    ) as Contract & RedeemableERC20;

    const recipient = trust.address;
    const seeder1Units = 4;
    const seeder2Units = 6;

    // seeders needs some cash, give enough each for seeding
    await reserveToken.transfer(await seeder1.getAddress(), seedPrice.mul(seeder1Units));
    await reserveToken.transfer(await seeder2.getAddress(), seedPrice.mul(seeder2Units));

    const seederContract1 = seederContract.connect(seeder1);
    const seederContract2 = seederContract.connect(seeder2);
    const reserve1 = reserveToken.connect(seeder1);
    const reserve2 = reserveToken.connect(seeder2);

    await reserve1.approve(seederContract.address, seedPrice.mul(seeder1Units));
    await reserve2.approve(seederContract.address, seedPrice.mul(seeder2Units));

    // seeders send reserve to seeder contract
    await seederContract1.seed(0, seeder1Units);
    await seederContract2.seed(0, seeder2Units);

    // Recipient gains infinite approval on reserve token withdrawals from seed contract
    await reserveToken.allowance(seederContract.address, recipient);

    await trust.startDutchAuction({ gasLimit: 30000000 });

    const [crp, bPool] = await Utils.poolContracts(signers, trust);

    const startBlock = await ethers.provider.getBlockNumber();

    const reserveSpend = finalValuation.div(10);

    // signer1 fully funds raise
    const swapReserveForTokens = async (signer: any, spend: any) => {
      // give signer some reserve
      await reserveToken.transfer(signer.address, spend);

      const reserveSigner = reserveToken.connect(signer);
      const crpSigner = crp.connect(signer);
      const bPoolSigner = bPool.connect(signer);

      await reserveSigner.approve(bPool.address, spend);
      await crpSigner.pokeWeights();
      await bPoolSigner.swapExactAmountIn(
        reserveToken.address,
        spend,
        token.address,
        ethers.BigNumber.from("1"),
        ethers.BigNumber.from("1000000" + Utils.sixZeros)
      );
    };

    while ((await reserveToken.balanceOf(bPool.address)).lte(successLevel)) {
      await swapReserveForTokens(signer1, reserveSpend);
    }

    await Utils.createEmptyBlock(
      startBlock +
        minimumTradingDuration -
        (await ethers.provider.getBlockNumber())
    );

    // seeder1 ends raise
    await trust.connect(seeder1).endDutchAuction();

    // owner pulls reserve
    await reserveToken
      .connect(creator)
      .transferFrom(
        trust.address,
        creator.getAddress(),
        await reserveToken.allowance(trust.address, await creator.getAddress())
      );

    // seeder1 pulls erc20
    await seederContract
      .connect(seeder1)
      .pullERC20(await reserveToken.allowance(trust.address, seeder));

    // seeders redeem funds
    await seederContract1.redeem(seeder1Units);
    await seederContract2.redeem(seeder2Units);

    // signer1 pulls erc20 into RedeemableERC20 contract
    await token
      .connect(signer1)
      .pullERC20(await reserveToken.allowance(trust.address, token.address));

    await token
      .connect(signer1)
      .redeem([reserveToken.address], await token.balanceOf(await signer1.getAddress()));

    // Query
    await waitForSubgraphToBeSynced(2000);
    const query = queryTrustFactories();
    const response = (await subgraph({ query })) as FetchResult;
    const result = response.data.trustFactories[0];

    expect(result.trustCount).to.be.equal(trustCount);
    expect(result.id).to.be.equal(trustFactory.address.toLowerCase());
    // expect(Utils.containObject(result.trusts, {id: trust.address})).to.be.true;
  });

  it("Test query", async () => {
    await waitForSubgraphToBeSynced(1000);
    const query = await queryTrustFactories();
    const response = (await subgraph({ query })) as FetchResult;
    const result = response.data.trustFactories[0] as TrustFactoryQuery;

    expect(result.id).to.be.equal(trustFactory.address.toLowerCase());
    console.log("Result : ",result.trustCount)
    // expect(result.trustCount).to.be.equal(trustCount);
  });
});
