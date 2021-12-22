import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

function createLocalHostConfig() {
  const url: string = "http://localhost:8545";
  const mnemonic: string = "test test test test test test test test test test test junk";
  return {
    accounts: {
      count: 10,
      initialIndex: 0,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    url,
  };
};

function createForkConfig() {
  let url: string;
  if (!process.env.POLYGON_ALCHEMY_KEY) {
    throw new Error("Please set your ALCHEMY_KEY in a .env file");
  } else {
    url = `https://polygon-mainnet.g.alchemy.com/v2/${process.env.POLYGON_ALCHEMY_KEY}`;
  }
  return {
    forking: {
      url,
      blockNumber: 22800167
    }
  };
};

const config: HardhatUserConfig = {
  solidity: "0.8.10",
  defaultNetwork: "hardhat",
  networks: {
    localhost: createLocalHostConfig(),
    hardhat: createForkConfig(),
  },
};

export default config;
