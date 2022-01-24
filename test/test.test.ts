/* eslint-disable node/no-missing-import */
/* eslint-disable prettier/prettier */
/* eslint-disable no-unused-vars */
import { expect } from "chai";
import { ethers } from "hardhat";
import * as Util from "./utils";
import { 
  deploy, 
  waitForSubgraphToBeSynced, 
  fetchSubgraph, 
  exec, 
  balancerDeploy, 
  factoriesDeploy  
} from "./utils";
import { ApolloFetch, FetchResult } from "apollo-fetch";
import * as path from "path";
import RESERVE_TOKEN from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveToken.sol/ReserveToken.json";
import READWRITE_TIER from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ReadWriteTier.sol/ReadWriteTier.json";
import TrustFactory from "@beehiveinnovation/rain-protocol/artifacts/contracts/trust/TrustFactory.sol/TrustFactory.json";
import type { Trust } from "@beehiveinnovation/rain-protocol/typechain/Trust";
import { factory as factoryAddress } from "../config/localhost.json"
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

describe("Test", function () {
    const subgraphUser = "vishalkale151071";
    const subgraphName = "rain-protocol";

  it("Deploys", async function () {
    const signers = await ethers.getSigners();
    const creator = signers[0];

    const [crpFactory, bFactory] = await Util.balancerDeploy(creator);

    const reserve = await deploy(RESERVE_TOKEN, creator, []);

    const tierFactory = await deploy(READWRITE_TIER, creator, []);
    const minimumTier = Tier.GOLD;

    const currentBlock = await ethers.provider.getBlockNumber();
    const { trustFactory } = await factoriesDeploy(crpFactory, bFactory, creator);

    console.log("Block: ", currentBlock);
    console.log("trustF: ", trustFactory.address);

    const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
    const configLocal = JSON.parse(Util.fetchFile(pathConfigLocal));
    configLocal.factory = trustFactory.address;
    configLocal.startBlock = currentBlock;
    Util.writeFile(pathConfigLocal, JSON.stringify(configLocal, null, 4));

    exec(`yarn deploy-build:localhost`);
    await waitForSubgraphToBeSynced(1000);
  });

  it("Should query the trust factories",async () => {
    // Query trust count and an ID (just for testing rn, we can remove it)
    await waitForSubgraphToBeSynced(2000);
    const query = `
    {
      trustFactories {
        id
        trustCount
      }
    }
    `;

     // Create Subgraph Connection
     const subgraph = fetchSubgraph(subgraphUser, subgraphName);

    const queryTrustCountresponse = (await subgraph({ query: query })) as FetchResult;
    expect(queryTrustCountresponse.data.trustFactories[0].id).to.equals(factoryAddress.toLowerCase())
    expect(queryTrustCountresponse.data.trustFactories[0].trustCount).to.equals('0')
  })

  it.only("Should create a trust",async () => {
    const signers = await ethers.getSigners();

    const creator = signers[0];
    const seeder = signers[1]; // seeder is not creator/owner
    const deployer = signers[2]; // deployer is not creator

    const [crpFactory, bFactory] = await Util.balancerDeploy(creator);

    const reserve = (await Util.deploy(RESERVE_TOKEN, creator, []));

    const tier = (await Util.deploy(READWRITE_TIER, creator, []));
    const minimumTier = Tier.GOLD;

    const { trustFactory } = await factoriesDeploy(crpFactory, bFactory, creator);

    const erc20Config = { name: "Token", symbol: "TKN" };
    const seedERC20Config = { name: "SeedToken", symbol: "SDT" };

    const reserveInit = ethers.BigNumber.from("2000" + Util.sixZeros);
    const redeemInit = ethers.BigNumber.from("2000" + Util.sixZeros);
    const totalTokenSupply = ethers.BigNumber.from("2000" + Util.eighteenZeros);
    const initialValuation = ethers.BigNumber.from("20000" + Util.sixZeros);
    const minimumCreatorRaise = ethers.BigNumber.from("100" + Util.sixZeros);

    const seederFee = ethers.BigNumber.from("100" + Util.sixZeros);
    const seederUnits = 0;
    const seederCooldownDuration = 0;

    const successLevel = redeemInit
      .add(minimumCreatorRaise)
      .add(seederFee)
      .add(reserveInit);

    const minimumTradingDuration = 10;

    const trustFactoryDeployer = trustFactory.connect(deployer);

    const trust = await Util.trustDeploy(
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
        erc20Config,
        tier: tier.address,
        minimumTier,
        totalSupply: totalTokenSupply,
      },
      {
        seeder: seeder.address,
        seederUnits,
        seederCooldownDuration,
        seedERC20Config,
      },
      { gasLimit: 15000000 }
    );
    console.log(trust.address);
  })


});
