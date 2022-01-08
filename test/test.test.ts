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
import POOL from "@beehiveinnovation/rain-protocol/artifacts/contracts/pool/RedeemableERC20Pool.sol/RedeemableERC20Pool.json";
import REDEEMABLEERC20 from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json";

// Types
import type { ConfigurableRightsPool } from "@beehiveinnovation/rain-protocol//typechain/ConfigurableRightsPool";
import type { BPool } from "@beehiveinnovation/rain-protocol//typechain/BPool";
import type { TierByConstructionClaim } from "@beehiveinnovation/rain-protocol/typechain/TierByConstructionClaim";
import type { ReadWriteTier } from "@beehiveinnovation/rain-protocol//typechain/ReadWriteTier";
import type { ReserveToken } from "@beehiveinnovation/rain-protocol//typechain/ReserveToken";
import type { SeedERC20 } from "@beehiveinnovation/rain-protocol//typechain/SeedERC20";
import type { RedeemableERC20Pool } from "@beehiveinnovation/rain-protocol//typechain/RedeemableERC20Pool";
import type { RedeemableERC20 } from "@beehiveinnovation/rain-protocol//typechain/RedeemableERC20";
import type { TrustFactory } from "@beehiveinnovation/rain-protocol//typechain/TrustFactory";

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
let redeemableERC20: Contract & RedeemableERC20, // redeemableERC20
  pool: Contract & RedeemableERC20Pool, // RedeemableERC20Pool
  seedERC20: Contract & SeedERC20, // SeedERC20
  crp: Contract & ConfigurableRightsPool, // ConfigurableRightsPool
  bPool: Contract & BPool; // Balancer pool

let signers: Signer[],
  creator: Signer,
  seeder: Signer,
  deployer: Signer,
  trader1: Signer;

let trustCount: any;

describe("TheGraph - Rain Protocol", () => {
  before("Attaching factories", async () => {
    signers = await ethers.getSigners();
    creator = signers[0];
    seeder = signers[1]; // seeder is not creator/owner
    deployer = signers[2];
    trader1 = signers[3];

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
          trustCount
        }
      }
    `;
    const queryTrustCountresponse = (await subgraph({ query: queryTrustCount })) as FetchResult;
    trustCount = ethers.BigNumber.from(queryTrustCountresponse.data.trustFactories[0].trustCount);
  });

  it("Creating a trust", async () => {
    const config = { gasLimit: 20000000 };

    reserveToken = (await deploy(RESERVE_TOKEN, creator, [])) as Contract &
      ReserveToken;

    const erc20Config = { name: "Token", symbol: "TKN" };
    const seedERC20Config = { name: "SeedToken", symbol: "SDT" };

    const reserveInit = ethers.BigNumber.from("2000" + Utils.sixZeros);
    const redeemInit = ethers.BigNumber.from("2000" + Utils.sixZeros);
    const totalTokenSupply = ethers.BigNumber.from(
      "2000" + Utils.eighteenZeros
    );
    const initialValuation = ethers.BigNumber.from("20000" + Utils.sixZeros);
    const minimumCreatorRaise = ethers.BigNumber.from("1000" + Utils.sixZeros);

    const seedUnits = 10;
    const seedPrice = reserveInit.div(seedUnits);
    const seederCooldownDuration = 3;

    const seederFee = seedPrice.mul(seedUnits);

    const finalValuation = reserveInit
      .add(seederFee)
      .add(redeemInit)
      .add(minimumCreatorRaise);

    const minimumTradingDuration = 30;

    readWriteTier = (await deploy(READWRITE_TIER, creator, [])) as Contract &
      ReadWriteTier;
    const minimumStatus = 0; // Tier.ZERO

    await readWriteTier
      .connect(trader1)
      .setTier(await trader1.getAddress(), 3, []); // Tier.THREE

    tierByConstructionClaim = (await deploy(TIERBYCONSTRUCTION, creator, [
      readWriteTier.address,
      minimumStatus,
    ])) as Contract & TierByConstructionClaim;

    await tierByConstructionClaim.claim(await trader1.getAddress(), [], {
      gasLimit: 20000000,
    });

    // Using the trust factory
    const trust = await Utils.trustDeploy(
      trustFactory,
      deployer,
      {
        creator: await creator.getAddress(),
        minimumCreatorRaise,
        seeder: ethers.constants.AddressZero, // autogenerate seedERC20 contract
        seederFee: seederFee,
        seederUnits: seedUnits,
        seederCooldownDuration,
        redeemInit,
        seedERC20Config,
      },
      {
        erc20Config,
        tier: readWriteTier.address,
        minimumStatus,
        totalSupply: totalTokenSupply,
      },
      {
        reserve: reserveToken.address,
        reserveInit,
        initialValuation,
        finalValuation,
        minimumTradingDuration,
      },
      config
    );
    trustCount = trustCount.add(1);

    // This contain all the addresses, and should match with the contracts addresses attached and with the graph query
    const trustContracts = await trust.getContracts();
    /*
    reserveERC20 - The reserve token
    redeemableERC20 - RedeemableERC20 contract
    redeemableERC20Pool - RedeemableERC20Pool contract
    seeder - SeedERC20 contract
    tier - ReadWriteTier contract 
    crp - ConfigurableRightsPool contract
    pool - Balancer pool contract
    */

    redeemableERC20 = new ethers.Contract(
      await trust.token(),
      REDEEMABLEERC20.abi,
      creator
    ) as Contract & RedeemableERC20;

    seedERC20 = new ethers.Contract(
      await trust.seeder(),
      SEED.abi,
      creator
    ) as Contract & SeedERC20;

    // Sending to seeder more toekns
    const tx0 = await reserveToken.transfer(
      await seeder.getAddress(),
      seederFee,
      config
    );
    await tx0.wait();

    await reserveToken
      .connect(seeder)
      .approve(seedERC20.address, seederFee, config);
    await seedERC20.connect(seeder).seed(0, seedUnits, config);

    pool = new ethers.Contract(
      await trust.pool(),
      POOL.abi,
      creator
    ) as Contract & RedeemableERC20Pool;

    // start raise
    const tx1 = await pool.startDutchAuction(config);
    await tx1.wait();
    const startBlock = await ethers.provider.getBlockNumber();

    [crp, bPool] = (await Utils.poolContracts(signers, pool)) as [
      ConfigurableRightsPool,
      BPool
    ];

    // Start trading
    const swapReserveForTokens = async (signer: any, spend: any) => {
      const tx = await reserveToken.transfer(
        await signer.getAddress(),
        spend,
        config
      );
      await tx.wait();

      await reserveToken.connect(signer).approve(bPool.address, spend, config);
      await crp.connect(signer).pokeWeights(config);
      await bPool
        .connect(signer)
        .swapExactAmountIn(
          reserveToken.address,
          spend,
          redeemableERC20.address,
          ethers.BigNumber.from("1"),
          ethers.BigNumber.from("1000000" + Utils.sixZeros),
          config
        );
    };

    const reserveSpend = finalValuation.div(10);

    do {
      await swapReserveForTokens(trader1, reserveSpend);
    } while ((await reserveToken.balanceOf(bPool.address)).lte(finalValuation));

    // wait until distribution can end
    await Utils.waitForBlock(startBlock + minimumTradingDuration + 1);

    await trust.connect(seeder).anonEndDistribution(config);
    await seedERC20.connect(seeder).redeem(seedUnits, config);

    await redeemableERC20
      .connect(trader1)
      .redeem(
        [reserveToken.address],
        await redeemableERC20.balanceOf(await trader1.getAddress()),
        config
      );

    // Query
    await waitForSubgraphToBeSynced(2000);
    const query = queryTrustFactories();
    const response = (await subgraph({ query })) as FetchResult;
    const result = response.data.trustFactories[0];

    expect(result.trustCount).to.be.equal(trustCount);
    expect(result.id).to.be.equal(trustFactory.address.toLowerCase());
    expect(Utils.containObject(result.trusts, {id: trust.address})).to.be.true;
  });

  it("Test query", async () => {
    await waitForSubgraphToBeSynced(1000);
    const query = await queryTrustFactories();
    const response = (await subgraph({ query })) as FetchResult;
    const result = response.data.trustFactories[0] as TrustFactoryQuery;

    expect(result.id).to.be.equal(trustFactory.address.toLowerCase());
    expect(result.trustCount).to.be.equal(trustCount);
  });
});
