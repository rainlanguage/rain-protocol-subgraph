/* eslint-disable node/no-missing-import */
/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */
import { expect } from "chai";
import { ethers } from "hardhat";
import * as Util from "./utils/utils";
import { ApolloFetch, FetchResult } from "apollo-fetch";
import * as path from "path";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type {
  BigNumber,
  BigNumberish,
  Contract,
  ContractFactory,
} from "ethers";
import { hexlify } from "ethers/lib/utils";
import {
  deploy,
  waitForSubgraphToBeSynced,
  fetchSubgraph,
  exec,
  balancerDeploy,
  factoriesDeploy,
  eighteenZeros,
} from "./utils/utils";
import {
  getContracts,
  getFactories,
  getTrust,
  NOTICE_QUERY,
  QUERY,
} from "./utils/queries";

import reserveToken from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveToken.sol/ReserveToken.json";
import redeemableERC20FactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20Factory.sol/RedeemableERC20Factory.json";
import readwriteTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ReadWriteTier.sol/ReadWriteTier.json";
// @ts-ignore
import SaleJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/sale/Sale.sol/Sale.json";
// @ts-ignore
import saleFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/sale/SaleFactory.sol/SaleFactory.json";

import { ReserveToken } from "@beehiveinnovation/rain-protocol/typechain/ReserveToken";
import { RedeemableERC20Factory } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20Factory";
import { ReadWriteTier } from "@beehiveinnovation/rain-protocol/typechain/ReadWriteTier";
import type {
  BuyEvent,
  Sale,
  // @ts-ignore
} from "@beehiveinnovation/rain-protocol/typechain/Sale";
import type {
  SaleConfigStruct,
  SaleConstructorConfigStruct,
  SaleFactory,
  SaleRedeemableERC20ConfigStruct,
  // @ts-ignore
} from "@beehiveinnovation/rain-protocol/typechain/SaleFactory";

enum Tier {
  ZERO,
  ONE,
  TWO,
  THREE,
  FOUR,
  FIVE,
  SIX,
  SEVEN,
  EIGHT,
}

enum Status {
  PENDING,
  SUCCESS,
  FAIL,
}

const enum Opcode {
  SKIP,
  VAL,
  DUP,
  ZIPMAP,
  BLOCK_NUMBER,
  SENDER,
  ADD,
  SUB,
  MUL,
  DIV,
  MOD,
  POW,
  MIN,
  MAX,
  REPORT,
  NEVER,
  ALWAYS,
  SATURATING_DIFF,
  UPDATE_BLOCKS_FOR_TIER_RANGE,
  SELECT_LTE,
  REMAINING_UNITS,
  TOTAL_RESERVE_IN,
  LAST_RESERVE_IN,
  LAST_BUY_BLOCK,
  LAST_BUY_UNITS,
  LAST_BUY_PRICE,
  CURRENT_BUY_UNITS,
}

let deployer: SignerWithAddress,
  recipient: SignerWithAddress,
  feeRecipient: SignerWithAddress,
  signer1: SignerWithAddress;

describe("Sales queries test", function () {
  const subgraphUser = "vishalkale151071";
  const subgraphName = "rain-protocol";
  let subgraph: ApolloFetch;
  let reserve: ReserveToken & Contract,
    redeemableERC20Factory: RedeemableERC20Factory & Contract,
    readWriteTier: ReadWriteTier & Contract,
    saleConstructorConfig: SaleConstructorConfigStruct,
    saleFactory: SaleFactory & Contract;

  // beforeEach(async () => {
  //   const signers = await ethers.getSigners();
  //   deployer = signers[0];
  //   reserve = (await Util.deploy(reserveToken, deployer, [])) as ReserveToken &
  //     Contract;
  // });

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    recipient = signers[1];
    feeRecipient = signers[2];
    signer1 = signers[3];

    reserve = (await Util.deploy(reserveToken, deployer, [])) as ReserveToken &
      Contract;

    redeemableERC20Factory = (await Util.deploy(
      redeemableERC20FactoryJson,
      deployer,
      []
    )) as RedeemableERC20Factory & Contract;

    readWriteTier = (await Util.deploy(
      readwriteTierJson,
      deployer,
      []
    )) as ReadWriteTier & Contract;

    saleConstructorConfig = {
      redeemableERC20Factory: redeemableERC20Factory.address,
    };

    saleFactory = (await Util.deploy(
      saleFactoryJson,
      deployer,
      []
    )) as SaleFactory & Contract;
    const currentBlock = await ethers.provider.getBlockNumber();

    // // Address and block to the subgraph
    // const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
    // const configLocal = JSON.parse(Util.fetchFile(pathConfigLocal));

    // configLocal.saleFactory = saleFactory.address;
    // configLocal.startBlockSaleFactory = currentBlock;
    // Util.writeFile(pathConfigLocal, JSON.stringify(configLocal, null, 4));

    // exec(`yarn deploy-build:localhost`);

    // subgraph = fetchSubgraph(subgraphUser, subgraphName);
  });

  it("should query the saleFactory after construction correctly", async function () {
    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(1000);

    const saleFactoryQuery = `
      {
        saleFactory (id: "${saleFactory.address.toLowerCase()}") {
          address
          children {
            id
          }
          redeemableERC20Factory
        }
      }
    `;

    const saleFactoryQueryResponse = (await subgraph({
      query: saleFactoryQuery,
    })) as FetchResult;

    const saleFactoryData = saleFactoryQueryResponse.data.saleFactory;

    expect(saleFactoryData.address).to.equals(
      saleFactory.address.toLowerCase()
    );
    expect(saleFactoryData.children).to.be.empty;
    expect(saleFactoryData.redeemableERC20Factory).to.equals(
      redeemableERC20Factory.address.toLowerCase()
    );
  });

  it("", async function () {
    console;
  });

  it("", async function () {
    console;
  });
});
