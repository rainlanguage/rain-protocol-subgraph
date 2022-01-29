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
import {TrustFactory} from "@beehiveinnovation/rain-protocol/typechain/TrustFactory";
import {ReserveToken} from "@beehiveinnovation/rain-protocol/typechain/ReserveToken";
import {Trust} from "@beehiveinnovation/rain-protocol/typechain/Trust";
import {ITier} from "@beehiveinnovation/rain-protocol/typechain/ITier";
import {BFactory} from "@beehiveinnovation/rain-protocol/typechain/BFactory";
import {CRPFactory} from "@beehiveinnovation/rain-protocol/typechain/CRPFactory";
import {RedeemableERC20Factory} from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20Factory";
import {SeedERC20Factory} from "@beehiveinnovation/rain-protocol/typechain/SeedERC20Factory";
import { getContracts, getFactories, getTrust, NOTICE_QUERY, QUERY } from "./queries"
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

describe("Factory Test", function () {
    const subgraphUser = "vishalkale151071";
    const subgraphName = "rain-protocol";
    let trustFactory: TrustFactory;
    let reserve: ReserveToken
    let tier: ITier
    let minimumTier: Tier
    let subgraph: ApolloFetch
    let currentBlock: number
    let trust: Trust
    let crpFactory: CRPFactory
    let bFactory: BFactory
    let redeemableERC20Factory: RedeemableERC20Factory
    let seedERC20Factory: SeedERC20Factory

    before(async function (){

    const signers = await ethers.getSigners();

    const creator = signers[0];
    const seeder = signers[1]; // seeder is not creator/owner
    const deployer = signers[2]; // deployer is not creator

    [crpFactory, bFactory] = await Util.balancerDeploy(creator) as[CRPFactory, BFactory];

    reserve = (await Util.deploy(RESERVE_TOKEN, creator, [])) as ReserveToken

    tier = (await Util.deploy(READWRITE_TIER, creator, [])) as ITier;
    minimumTier = Tier.GOLD;


    ({ trustFactory, redeemableERC20Factory, seedERC20Factory} = await factoriesDeploy(crpFactory, bFactory, creator));
    currentBlock = await ethers.provider.getBlockNumber();

    console.log("Block: ", currentBlock--);

    console.log("trustF: ", trustFactory.address);

    const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
    const configLocal = JSON.parse(Util.fetchFile(pathConfigLocal));

    configLocal.factory = trustFactory.address;
    configLocal.startBlock = currentBlock;
    Util.writeFile(pathConfigLocal, JSON.stringify(configLocal, null, 4));

    exec(`yarn deploy-build:localhost`);
    
    subgraph = fetchSubgraph(subgraphUser, subgraphName);
  })

  it("Should query the trust factories",async function(){
    await Util.delay(Util.wait)
    await waitForSubgraphToBeSynced(1000);

    const queryTrustCountresponse = (await subgraph({ query: QUERY })) as FetchResult;
    expect(queryTrustCountresponse.data.trustFactories[0].id).to.equals(trustFactory.address.toLowerCase())
    expect(queryTrustCountresponse.data.trustFactories[0].trustCount).to.equals('0')
  })

  it("Trust Test", async function(){
    const signers = await ethers.getSigners();

    const creator = signers[0];
    const deployer = signers[2];
    const seeder = signers[1];

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

    trust = await Util.trustDeploy(
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
    ) as Trust;

    await Util.delay(Util.wait)

    await waitForSubgraphToBeSynced(1000);
     // Create Subgraph Connection
    const queryResponse = (await subgraph({ query: QUERY })) as FetchResult;
    const response = queryResponse.data 
    const factoryData = response.trustFactories[0]
    const trustData = factoryData.trusts[0]
    
    expect(parseInt(factoryData.trustCount)).to.equals(1)
    expect(trustData.id).to.equals(trust.address.toLowerCase())
    expect(trustData.factory).to.equals(trustFactory.address.toLowerCase())
    expect(trustData.trustParticipants).to.be.empty 
  })

  it("Trust Construction Event", async function() {
    await Util.delay(Util.wait)
    await waitForSubgraphToBeSynced(1000)

    const queryResponse = await subgraph({query: getFactories(trustFactory.address.toLowerCase())})
    const factories = queryResponse.data.trustFactory
    
    expect(factories.balancerFactory).to.equals(bFactory.address.toLowerCase())
    expect(factories.crpFactory).to.equals(crpFactory.address.toLowerCase())
    expect(factories.redeemableERC20Factory).to.equals(redeemableERC20Factory.address.toLowerCase())
    expect(factories.seedERC20Factory).to.equals(seedERC20Factory.address.toLowerCase())
  })

  it("Contracts Test",async function(){
    await Util.delay(Util.wait)
    await waitForSubgraphToBeSynced(1000)

    const queryResponse = await subgraph({query: getContracts(trust.address.toLowerCase())})
    const contract = queryResponse.data.contract
    
    const g_reserve = contract.reserveERC20
    expect(g_reserve.name).to.equals(await reserve.name())
    expect(g_reserve.symbol).to.equals(await reserve.symbol())
    expect(g_reserve.decimals).to.equals(await reserve.decimals())
    expect(g_reserve.totalSupply).to.equals(await reserve.totalSupply())
  })

  it("DistributionProgress Test",async function(){
    await Util.delay(Util.wait)
    await waitForSubgraphToBeSynced(1000)

    const queryResponse = await subgraph({query: getContracts(trust.address.toLowerCase())})
    const contract = queryResponse.data.contract
    
    const g_reserve = contract.reserveERC20
    expect(g_reserve.name).to.equals(await reserve.name())
    expect(g_reserve.symbol).to.equals(await reserve.symbol())
    expect(g_reserve.decimals).to.equals(await reserve.decimals())
    expect(g_reserve.totalSupply).to.equals(await reserve.totalSupply())
  })

  it("Notice Test", async function(){
    const signers = await ethers.getSigners();

    const sender = signers[9];

    const noticeSender = trust.connect(sender)

    await noticeSender.sendNotice("0x01")

    await Util.delay(Util.wait)
    await waitForSubgraphToBeSynced(1000)

    let queryResponse = (await subgraph({ query: NOTICE_QUERY })) as FetchResult;
    let notices = queryResponse.data.notices
    expect(notices.length).to.equals(1)
    expect(notices[0].sender).to.equals(sender.address.toLowerCase())
    expect(notices[0].data).to.equals("0x01")

    queryResponse = (await subgraph({ query: getTrust(trust.address.toLowerCase()) })) as FetchResult;
    notices = queryResponse.data.trust.notices
    expect(notices.length).to.equals(1)
  })

  it("Test Ended.", async function(){
    await trust.startDutchAuction()
  })
});
