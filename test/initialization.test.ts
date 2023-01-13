import { ethers } from "hardhat";
import * as path from "path";

import * as Util from "./utils/utils";
import { waitForSubgraphToBeSynced } from "./utils/utils";

// Typechain Factories
import { StakeFactory__factory } from "../typechain/factories/StakeFactory__factory";

// Types
import { ApolloFetch } from "apollo-fetch";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type { StakeFactory } from "../typechain/StakeFactory";

const subgraphName = "rainprotocol/rain-protocol-test";

// Export Factories
export let subgraph: ApolloFetch, stakeFactory: StakeFactory;

// Export signers
export let deployer: SignerWithAddress,
  creator: SignerWithAddress,
  signer1: SignerWithAddress,
  signer2: SignerWithAddress,
  signer3: SignerWithAddress,
  signer4: SignerWithAddress,
  recipient: SignerWithAddress,
  feeRecipient: SignerWithAddress,
  admin: SignerWithAddress;

before("Deployment contracts and subgraph", async function () {
  const signers = await ethers.getSigners();

  // Signers (to avoid fetch again)
  deployer = signers[0]; // deployer is NOT creator
  creator = signers[1];
  signer3 = signers[2];
  signer4 = signers[3];
  signer1 = signers[4];
  signer2 = signers[5];
  recipient = signers[6];
  feeRecipient = signers[7];
  admin = signers[9];

  // Deploying StakeFactory contract
  stakeFactory = await new StakeFactory__factory(deployer).deploy();

  // Saving data in JSON
  const pathExampleConfig = path.resolve(__dirname, "../config/example.json");
  const config = JSON.parse(Util.fetchFile(pathExampleConfig));

  config.network = "localhost";

  // Saving addresses and individuals blocks to index

  config.StakeFactory = stakeFactory.address;
  config.StakeFactoryBlock = stakeFactory.deployTransaction.blockNumber;

  // Write address and block to configuration contracts file
  const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
  Util.writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

  // Setting all to localhost to test locally
  const configPath = "config/localhost.json";
  const endpoint = "http://localhost:8020/";
  const ipfsEndpoint = "http://localhost:5001";
  const versionLabel = "test-v2.0.0";

  Util.exec(
    `npm run deploy-subgraph -- --config ${configPath} --subgraphName ${subgraphName} --endpoint ${endpoint} --ipfsEndpoint ${ipfsEndpoint} --versionLabel ${versionLabel}`
  );

  subgraph = Util.fetchSubgraph(subgraphName);

  // Wait for sync
  await waitForSubgraphToBeSynced(1000);
});
