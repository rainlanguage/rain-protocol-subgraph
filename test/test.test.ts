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
import {ITier} from "@beehiveinnovation/rain-protocol/typechain/ITier";
import { QUERY } from "./queries"
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
    let trustFactory: TrustFactory;
    let reserve: ReserveToken
    let tier: ITier
    let minimumTier: Tier
    let subgraph: ApolloFetch
    let currentBlock: number

    before( async function (){

    const signers = await ethers.getSigners();

    const creator = signers[0];
    const seeder = signers[1]; // seeder is not creator/owner
    const deployer = signers[2]; // deployer is not creator

    const [crpFactory, bFactory] = await Util.balancerDeploy(creator);

    reserve = (await Util.deploy(RESERVE_TOKEN, creator, [])) as ReserveToken

    tier = (await Util.deploy(READWRITE_TIER, creator, [])) as ITier;
    minimumTier = Tier.GOLD;


    ({ trustFactory } = await factoriesDeploy(crpFactory, bFactory, creator));
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

  it("Should query the trust factories",async () => {
    await waitForSubgraphToBeSynced(1000);

    const queryTrustCountresponse = (await subgraph({ query: QUERY })) as FetchResult;
    expect(queryTrustCountresponse.data.trustFactories[0].id).to.equals(trustFactory.address.toLowerCase())
    expect(queryTrustCountresponse.data.trustFactories[0].trustCount).to.equals('0')
  })

  it("deploy trust.", async function(){
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


    await waitForSubgraphToBeSynced(1000);
     // Create Subgraph Connection
    const queryTrustCountresponse = (await subgraph({ query: QUERY })) as FetchResult;
    const response = queryTrustCountresponse.data 
    console.log("Response : ", JSON.stringify(response))
    const factoryData = response.trustFactories[0]
    const trustData = factoryData.trusts[0]

    expect(parseInt(factoryData.trustCount)).to.equals(1)
    expect(trustData.id).to.equals(trust.address.toLowerCase())
    expect(trustData.factory).to.equals(trustFactory.address.toLowerCase())
    expect(trustData.contracts).to.be.null
    expect(trustData.distributionProgress).to.be.null
    expect(trustData.notices).to.be.empty
    expect(trustData.trustParticipants).to.be.empty 
  })

});
