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
import { hexlify, concat } from "ethers/lib/utils";
import {
  op,
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
import redeemableERC20Json from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json";

import saleJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/sale/Sale.sol/Sale.json";

import saleFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/sale/SaleFactory.sol/SaleFactory.json";

import { ReserveToken } from "@beehiveinnovation/rain-protocol/typechain/ReserveToken";
import { RedeemableERC20Factory } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20Factory";
import { ReadWriteTier } from "@beehiveinnovation/rain-protocol/typechain/ReadWriteTier";
import { RedeemableERC20 } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20";
import type {
  BuyEvent,
  Sale,
} from "@beehiveinnovation/rain-protocol/typechain/Sale";
import type {
  SaleConfigStruct,
  SaleConstructorConfigStruct,
  SaleFactory,
  SaleRedeemableERC20ConfigStruct,
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
  ACTIVE,
  SUCCESS,
  FAIL,
}

const enum Opcode {
  SKIP,
  VAL,
  DUP,
  ZIPMAP,
  BLOCK_NUMBER,
  BLOCK_TIMESTAMP,
  SENDER,
  IS_ZERO,
  EQUAL_TO,
  LESS_THAN,
  GREATER_THAN,
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
  LAST_BUY_BLOCK,
  LAST_BUY_UNITS,
  LAST_BUY_PRICE,
  CURRENT_BUY_UNITS,
}

const afterBlockNumberConfig = (blockNumber: number) => {
  return {
    sources: [
      concat([
        // (BLOCK_NUMBER blockNumberSub1 gt)
        op(Opcode.BLOCK_NUMBER),
        op(Opcode.VAL, 0),
        op(Opcode.GREATER_THAN),
      ]),
    ],
    constants: [blockNumber - 1],
    stackLength: 3,
    argumentsLength: 0,
  };
};

const subgraphUser = "vishalkale151071";
const subgraphName = "rain-protocol";
let subgraph: ApolloFetch;

let reserve: ReserveToken & Contract,
  redeemableERC20Factory: RedeemableERC20Factory & Contract,
  readWriteTier: ReadWriteTier & Contract,
  saleConstructorConfig: SaleConstructorConfigStruct,
  saleFactory: SaleFactory & Contract,
  sale: Sale & Contract,
  redeemableERC20Token: RedeemableERC20 & Contract;

let deployer: SignerWithAddress,
  recipient: SignerWithAddress,
  feeRecipient: SignerWithAddress,
  signer1: SignerWithAddress;

describe("Sales queries test", function () {
  // beforeEach(async () => {
  //   const signers = await ethers.getSigners();
  //   deployer = signers[0];
  //   reserve = (await Util.deploy(reserveToken, deployer, [])) as ReserveToken &
  //     Contract;
  // });

  before(async function () {
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

    saleFactory = (await Util.deploy(saleFactoryJson, deployer, [
      saleConstructorConfig,
    ])) as SaleFactory & Contract;
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

    // The redeemableERC20Factory entity not exist yet, but Josh said that maybe will be implemented
    const saleFactoryQuery = `
      {
        saleFactory (id: "${saleFactory.address.toLowerCase()}") {
          address
          children {
            id
          }
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

  describe("Single sale - test", function () {
    const startBlock = (await ethers.provider.getBlockNumber()) + 1;
    const saleTimeout = 30;
    const minimumRaise = ethers.BigNumber.from("100000").mul(Util.RESERVE_ONE);
    const cooldownDuration = 1;
    const dustSize = 0;

    const totalTokenSupply = ethers.BigNumber.from("2000").mul(Util.ONE);
    const redeemableERC20Config = {
      name: "Token",
      symbol: "TKN",
      distributor: Util.zeroAddress,
      initialSupply: totalTokenSupply,
    };

    const basePrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);

    const supplyDivisor = ethers.BigNumber.from("1" + Util.sixteenZeros);

    const constants = [basePrice, supplyDivisor];
    const vBasePrice = op(Opcode.VAL, 0);
    const vSupplyDivisor = op(Opcode.VAL, 1);

    const sources = [
      concat([
        // ((CURRENT_BUY_UNITS priceDivisor /) 75 +)
        op(Opcode.CURRENT_BUY_UNITS),
        vSupplyDivisor,
        op(Opcode.DIV, 2),
        vBasePrice,
        op(Opcode.ADD, 2),
      ]),
    ];

    it("should query the sale child after creation", async function () {
      const tx = await saleFactory.createChildTyped(
        {
          canStartStateConfig: afterBlockNumberConfig(startBlock),
          canEndStateConfig: afterBlockNumberConfig(startBlock + saleTimeout),
          calculatePriceStateConfig: {
            sources,
            constants,
            stackLength: 3,
            argumentsLength: 0,
          },
          recipient: recipient.address,
          reserve: reserve.address,
          cooldownDuration: cooldownDuration,
          minimumRaise,
          dustSize: dustSize,
        },
        {
          erc20Config: redeemableERC20Config,
          tier: readWriteTier.address,
          minimumTier: Tier.ZERO,
        }
      );

      // Saving the actual sale
      sale = (await Util.getContractChild(tx, saleFactory, saleJson)) as Sale;

      // Reference to the token
      redeemableERC20Token = new ethers.Contract(
        await sale.token(),
        redeemableERC20Json.abi,
        deployer
      ) as RedeemableERC20;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const saleFactoryQuery = `
        {
          saleFactory (id: "${saleFactory.address.toLowerCase()}") {
            children {
              address
              deployer
            }
          }
        }
      `;

      const response = (await subgraph({
        query: saleFactoryQuery,
      })) as FetchResult;

      const saleFactoryData = response.data.saleFactory;
      const saleData = saleFactoryData.children[0];

      expect(saleFactoryData.children).to.have.lengthOf(1);
      expect(saleData.address).to.equals(sale.address.toLowerCase());
      expect(saleData.deployer).to.equals(deployer.address.toLowerCase());
    });

    it("should query the init properties of the sale correctly", async function () {
      const initUnitsAvailable = await redeemableERC20Token.balanceOf(
        sale.address
      );
      const initSaleStatus = Status.PENDING;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const saleQuery = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            recipient
            cooldownDuration
            minimumRaise
            dustSize
            buys
            refunds
            unitsAvailable
            totalRaised
            percentRaised
            totalFees
            saleStatus
          }
        }
      `;

      const response = (await subgraph({
        query: saleQuery,
      })) as FetchResult;

      const saleData = response.data.sale;

      expect(saleData.recipient).to.equals(recipient.address.toLowerCase());
      expect(saleData.cooldownDuration).to.equals(cooldownDuration);
      expect(saleData.minimumRaise).to.equals(minimumRaise);
      expect(saleData.dustSize).to.equals(dustSize);

      expect(saleData.buys).to.be.empty;
      expect(saleData.refunds).to.be.empty;

      expect(saleData.unitsAvailable).to.equals(initUnitsAvailable);
      expect(saleData.totalRaised).to.equals(0);
      expect(saleData.percentRaised).to.equals(0);
      expect(saleData.totalFees).to.equals(0);
      expect(saleData.saleStatus).to.equals(initSaleStatus);
    });

    it("", async function () {
      const reserveToken = reserve.address;
      console;
    });
  });

  describe("Sale with a non-ERC20 token", function () {});
});
