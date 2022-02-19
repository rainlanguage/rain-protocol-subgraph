import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";

dotenv.config();


function createLocalHostConfig() {
  const url = "http://localhost:8545";
  const mnemonic = "test test test test test test test test test test test junk";
  return {
    accounts: {
      count: 10,
      initialIndex: 0,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    url
  };
}

const config: HardhatUserConfig = {
  solidity: "0.8.10",
  defaultNetwork: "localhost",
  networks: {
    localhost: createLocalHostConfig(),
  },
  mocha: {
    timeout: 300000,
  },
};

export default config;
