import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import * as Utils from "./utils";
import { balancerDeploy, factoriesDeploy, deploy } from "./utils";
import fs from 'fs';

import { ApolloFetch, FetchResult } from "apollo-fetch";
import { waitForSubgraphToBeSynced, fetchSubgraph, exec } from "./utils";
import { queryTrustFactories } from "./queries";
import { TrustFactoryQuery } from "./types";

import RESERVE_TOKEN from "@beehiveinnovation/rain-protocol/artifacts/ReserveToken.json";
import READWRITE_TIER from "@beehiveinnovation/rain-protocol/artifacts/ReadWriteTier.json";
import TIERBYCONSTRUCTION from "@beehiveinnovation/rain-protocol/artifacts/TierByConstructionClaim.json";

import SEED from "@beehiveinnovation/rain-protocol/artifacts/SeedERC20.json";
import POOL from "@beehiveinnovation/rain-protocol/artifacts/RedeemableERC20Pool.json";
import REDEEMABLEERC20 from "@beehiveinnovation/rain-protocol/artifacts/RedeemableERC20.json";

import type { ConfigurableRightsPool } from "@beehiveinnovation/rain-protocol//typechain/ConfigurableRightsPool";
import type { BPool } from "@beehiveinnovation/rain-protocol//typechain/BPool";
import type { TierByConstructionClaim } from "@beehiveinnovation/rain-protocol/typechain/TierByConstructionClaim";
import type { ReadWriteTier } from "@beehiveinnovation/rain-protocol//typechain/ReadWriteTier";
import type { ReserveToken } from "@beehiveinnovation/rain-protocol//typechain/ReserveToken";
import type { SeedERC20 } from "@beehiveinnovation/rain-protocol//typechain/SeedERC20";
import type { RedeemableERC20Pool } from "@beehiveinnovation/rain-protocol//typechain/RedeemableERC20Pool";
import type { RedeemableERC20 } from "@beehiveinnovation/rain-protocol//typechain/RedeemableERC20";
import type { TrustFactory } from "@beehiveinnovation/rain-protocol//typechain/TrustFactory";

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

// Subgraph Name
const subgraphUser = "vishalkale151071";
const subgraphName = "rain-protocol";

let crpFactory: Contract, bFactory: Contract;
let trustFactory: Contract & TrustFactory,
  reserveToken: Contract & ReserveToken,
  readWriteTier: Contract & ReadWriteTier,
  tierByConstructionClaim: Contract & TierByConstructionClaim;
let signers: Signer[],
  creator: Signer,
  seeder: Signer,
  deployer: Signer,
  trader1: Signer;
let currentBlock: number;

describe("TheGraph - Rain Protocol", () => {
  before("Deploying factories", async () => {
    signers = await ethers.getSigners();
    creator = signers[0];
    seeder = signers[1]; // seeder is not creator/owner
    deployer = signers[2];
    trader1 = signers[3];

    [crpFactory, bFactory] = await balancerDeploy(creator);
    currentBlock = await ethers.provider.getBlockNumber();
    trustFactory = (await factoriesDeploy(crpFactory, bFactory, creator))
      .trustFactory;
    console.log("Block: ", currentBlock);
    console.log("trustF", trustFactory.address);
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
    const redeemableERC20 = new ethers.Contract(
      await trust.token(),
      REDEEMABLEERC20.abi,
      creator
    ) as Contract & RedeemableERC20;

    const seedERC20 = new ethers.Contract(
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

    const pool = new ethers.Contract(
      await trust.pool(),
      POOL.abi,
      creator
    ) as Contract & RedeemableERC20Pool;

    // start raise
    const tx1 = await pool.startDutchAuction(config);
    await tx1.wait();
    const startBlock = await ethers.provider.getBlockNumber();

    const [crp, bPool] = (await Utils.poolContracts(signers, pool)) as [
      ConfigurableRightsPool,
      BPool
    ];

    const tokenAddress = await trust.token();

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
          tokenAddress,
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

    let data = {
      network: "localhost",
      factory: trustFactory.address,
      startBlock: currentBlock
  }

  fs.writeFile("config/localhost.json", JSON.stringify(data), (err) => {
    if (err) throw err;
    console.log('complete');
  })
    
  });

  it("Test query", async () => {
    // exec(`yarn codegen`);
    // exec(`yarn build`);
    // exec(`yarn create-local`);
    // exec(`yarn deploy-local`);
    exec(`yarn deploy-build:localhost`)

    // Create Subgraph Connection
    const subgraph: ApolloFetch = fetchSubgraph(subgraphUser, subgraphName);

    await waitForSubgraphToBeSynced(1000);
    // await delay(1000)
    const query = await queryTrustFactories();
    const response = (await subgraph({ query })) as FetchResult;
    console.log("Result : ", response)
    
    const result = response.data.trustFactories[0] as TrustFactoryQuery;

    expect(result.id).to.be.equal(trustFactory.address.toLowerCase());
  }); 

});
