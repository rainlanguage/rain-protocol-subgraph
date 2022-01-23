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
  it("Deploys", async function () {
    const signers = await ethers.getSigners();

    const creator = signers[0];
    const seeder = signers[1]; // seeder is not creator/owner
    const deployer = signers[2]; // deployer is not creator

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

    // Create Subgraph Connection
    const subgraphUser = "vishalkale151071";
    const subgraphName = "rain-protocol";
    const subgraph: ApolloFetch = fetchSubgraph(subgraphUser, subgraphName);

    // Query trust count (just for testing rn, we can remove it)
    await waitForSubgraphToBeSynced(2000);
    const queryTrustCount = `
    {
      trustFactories {
        id
        trustCount
      }
    }
    `;
    const queryTrustCountresponse = (await subgraph({ query: queryTrustCount })) as FetchResult;
    console.log(queryTrustCountresponse)
  });
});
