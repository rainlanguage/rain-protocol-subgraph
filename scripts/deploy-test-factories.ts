import { ethers } from "hardhat";
import fs from "fs";
import * as path from "path";

import {
  balancerDeploy,
  factoriesDeploy,
  waitForSubgraphToBeSynced,
  exec,
} from "./utils";

const main = async () => {
  // Signer
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  // Files
  const pathAddresses = path.resolve(__dirname, "../test/addresess-test.json");
  const adressessContent = JSON.parse(fetchFile(pathAddresses));
  const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
  const configLocal = JSON.parse(fetchFile(pathConfigLocal));

  // Contracts deployment
  const [crpFactory, bFactory] = await balancerDeploy(deployer);
  const currentBlock = await ethers.provider.getBlockNumber();
  const factories = await factoriesDeploy(crpFactory, bFactory, deployer);

  console.log("Complete: Contract deployed to localhost!");

  // Saving in files
  // addresses-test.json
  adressessContent.crpFactory = crpFactory.address;
  adressessContent.bFactory = bFactory.address;
  adressessContent.redeemERC20Factory =
    factories.redeemableERC20Factory.address;
  adressessContent.redeemERC20PoolFactory =
    factories.redeemableERC20PoolFactory.address;
  adressessContent.seedERC20Factory = factories.seedERC20Factory.address;
  adressessContent.trustFactory = factories.trustFactory.address;
  writeFile(pathAddresses, JSON.stringify(adressessContent, null, 4));

  // localhost.json
  configLocal.factory = factories.trustFactory.address;
  configLocal.startBlock = currentBlock;
  writeFile(pathConfigLocal, JSON.stringify(configLocal, null, 4));

  // Deploy subgraph: Make sure that you are running the TheGraph node before running the deployment
  exec(`yarn deploy-build:localhost`);
  await waitForSubgraphToBeSynced(1000);
};

const fetchFile = (_path: string) => {
  try {
    return fs.readFileSync(_path).toString();
  } catch (error) {
    console.log(error);
    return "";
  }
};

const writeFile = (_path: string, file: any) => {
  try {
    fs.writeFileSync(_path, file);
  } catch (error) {
    console.log(error);
  }
};

main()
  .then(() => {
    const exit = process.exit;
    exit(0);
  })
  .catch((error) => {
    console.error(error);
    const exit = process.exit;
    exit(1);
  });
