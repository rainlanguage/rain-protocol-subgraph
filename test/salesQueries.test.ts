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
  ContractTransaction,
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

interface StateConfig {
  sources: Uint8Array[];
  constants: number[] | BigNumber[];
  stackLength: number;
  argumentsLength: number;
}

interface BuyConfig {
  feeRecipient: string;
  fee: BigNumber;
  minimumUnits: BigNumber;
  desiredUnits: BigNumber;
  maximumPrice: BigNumber;
}

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

let startBlock: number,
  canStartStateConfig: StateConfig,
  canEndStateConfig: StateConfig,
  calculatePriceStateConfig: StateConfig,
  buyConfig: BuyConfig;

// Use to save the tx between statements
let transaction: ContractTransaction;

describe("Sales queries test", function () {
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

  xit("should query the saleFactory after construction correctly", async function () {
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
    const saleTimeout = 30;
    const minimumRaise = ethers.BigNumber.from("100000").mul(Util.RESERVE_ONE);
    const cooldownDuration = 1;
    const dustSize = 0;
    const fee = ethers.BigNumber.from("1").mul(Util.RESERVE_ONE);

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

    before("creating the sale child", async function () {
      startBlock = (await ethers.provider.getBlockNumber()) + 1;

      canStartStateConfig = afterBlockNumberConfig(startBlock);

      canEndStateConfig = afterBlockNumberConfig(startBlock + saleTimeout);

      calculatePriceStateConfig = {
        sources: sources,
        constants: constants,
        stackLength: 3,
        argumentsLength: 0,
      };

      const tx = await saleFactory.createChildTyped(
        {
          canStartStateConfig: canStartStateConfig,
          canEndStateConfig: canEndStateConfig,
          calculatePriceStateConfig: calculatePriceStateConfig,
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
    });

    xit("should query the sale child after creation", async function () {
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

    xit("should query the init properties of the sale correctly", async function () {
      const initUnitsAvailable = await redeemableERC20Token.balanceOf(
        sale.address
      );

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const saleQuery = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            recipient
            cooldownDuration
            minimumRaise
            dustSize
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

      expect(saleData.unitsAvailable).to.equals(initUnitsAvailable);
      expect(saleData.totalRaised).to.equals(0);
      expect(saleData.percentRaised).to.equals(0);
      expect(saleData.totalFees).to.equals(0);
      expect(saleData.saleStatus).to.equals(Status.PENDING);
    });

    xit("should query correctly the null values", async function () {
      const saleQuery = `
      {
        sale (id: "${sale.address.toLowerCase()}") {
          buys
          refunds
          startEvent {
            id
          }
          endEvent {
            id
          }
        }
      }
    `;

      const response = (await subgraph({
        query: saleQuery,
      })) as FetchResult;

      const saleData = response.data.sale;

      expect(saleData.buys).to.be.empty;
      expect(saleData.refunds).to.be.empty;

      // Because any event was emitted
      expect(saleData.startEvent.id).to.be.null;
      expect(saleData.endEvent.id).to.be.null;
    });

    xit("should query the state configs after creation correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const statesQuery = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            canStartStateConfig {
              sources
              constants
              stackLength
              argumentsLength
            }
            canEndStateConfig {
              sources
              constants
              stackLength
              argumentsLength
            }
            calculatePriceStateConfig {
              sources
              constants
              stackLength
              argumentsLength
            }
          }
        }
      `;

      const response = (await subgraph({
        query: statesQuery,
      })) as FetchResult;

      const startData = response.data.sale.canStartStateConfig;
      const endData = response.data.sale.canEndStateConfig;
      const calculatePriceData = response.data.sale.calculatePriceStateConfig;

      expect(startData.sources).to.equals(canStartStateConfig.sources);
      expect(startData.constants).to.equals(canStartStateConfig.constants);
      expect(startData.stackLength).to.equals(canStartStateConfig.stackLength);
      expect(startData.argumentsLength).to.equals(
        canStartStateConfig.argumentsLength
      );

      expect(endData.sources).to.equals(canEndStateConfig.sources);
      expect(endData.constants).to.equals(canEndStateConfig.constants);
      expect(endData.stackLength).to.equals(canEndStateConfig.stackLength);
      expect(endData.argumentsLength).to.equals(
        canEndStateConfig.argumentsLength
      );

      expect(calculatePriceData.sources).to.equals(
        calculatePriceStateConfig.sources
      );
      expect(calculatePriceData.constants).to.equals(
        calculatePriceStateConfig.constants
      );
      expect(calculatePriceData.stackLength).to.equals(
        calculatePriceStateConfig.stackLength
      );
      expect(calculatePriceData.argumentsLength).to.equals(
        calculatePriceStateConfig.argumentsLength
      );
    });

    xit("should query the correct ERC20 tokens", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const tokensQuery = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            token {
              id
            }
            reserve {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: tokensQuery,
      })) as FetchResult;

      const erc20Tokens = response.data.sale;

      expect(erc20Tokens.token.id).to.equals(
        redeemableERC20Token.address.toLowerCase()
      );
      expect(erc20Tokens.reserve.id).to.equals(reserve.address.toLowerCase());
    });

    xit("should query the redeemableERC20 entity", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          redeemableERC20 (id: "${redeemableERC20Token.address.toLowerCase()}") {
            redeems{
              id
            }
            minimumTier
            name
            symbol
            totalSupply
            holders {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const redeemableERC20Data = response.data.redeemableERC20;

      expect(redeemableERC20Data.holders).to.be.empty;
      expect(redeemableERC20Data.redeems).to.be.empty;
      expect(redeemableERC20Data.minimumTier).to.equals(Tier.ZERO);
      expect(redeemableERC20Data.name).to.equals(redeemableERC20Config.name);
      expect(redeemableERC20Data.symbol).to.equals(
        redeemableERC20Config.symbol
      );
      expect(redeemableERC20Data.totalSupply).to.equals(
        redeemableERC20Config.initialSupply
      );
    });

    it("should query after sale start correctly", async function () {
      await Util.createEmptyBlock(
        startBlock - (await ethers.provider.getBlockNumber())
      );

      const tx = await sale.connect(signer1).start();

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            startEvent {
              id
            }
          }
          saleStart (id: "${tx.hash.toLowerCase()}") {
            saleContract {
              address
            }
            transactionHash
            sender
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const saleData = response.data.sale;
      const saleEventData = response.data.saleStart;

      expect(saleData.startEvent.id).to.equals(tx.hash.toLowerCase());

      expect(saleEventData.transactionHash).to.equals(tx.hash.toLowerCase());
      expect(saleEventData.sender).to.equals(signer1.address.toLowerCase());
      expect(saleEventData.saleContract.address).to.equals(
        sale.address.toLowerCase()
      );
    });

    it("should recognize the saleBuy after a buy correctly", async function () {
      // Values to Buy
      // - buy 10% of total supply
      const desiredUnits0 = totalTokenSupply.div(10);
      const expectedPrice0 = basePrice.add(desiredUnits0.div(supplyDivisor));
      const expectedCost0 = expectedPrice0.mul(desiredUnits0).div(Util.ONE);

      buyConfig = {
        feeRecipient: feeRecipient.address,
        fee,
        minimumUnits: desiredUnits0,
        desiredUnits: desiredUnits0,
        maximumPrice: expectedPrice0,
      };

      // give signer1 reserve to cover cost + fee
      await reserve.transfer(signer1.address, expectedCost0.add(fee));

      await reserve
        .connect(signer1)
        .approve(sale.address, expectedCost0.add(fee));

      transaction = await sale.connect(signer1).buy(buyConfig);

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            buys {
              id
            }
          saleBuy (id: "${transaction.hash.toLowerCase()}") {
            transactionHash
            saleContractAddress
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const saleData = response.data.sale;
      const saleBuyData = response.data.saleBuy;

      expect(saleData.buys).to.have.lengthOf(1);
      expect(saleData.buys[0].id).to.equals(transaction.hash.toLowerCase());

      expect(saleBuyData.transactionHash).to.equals(
        transaction.hash.toLowerCase()
      );
      expect(saleBuyData.saleContractAddress).to.equals(
        sale.address.toLowerCase()
      );
    });

    it("should query the Buy config values correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          saleBuy (id: "${transaction.hash.toLowerCase()}") {
            feeRecipientAddress
            fee
            minimumUnits
            desiredUnits
            maximumPrice
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const buyData = response.data.saleBuy;

      expect(buyData.fee).to.equals(buyConfig.fee);
      expect(buyData.minimumUnits).to.equals(buyConfig.minimumUnits);
      expect(buyData.desiredUnits).to.equals(buyConfig.desiredUnits);
      expect(buyData.maximumPrice).to.equals(buyConfig.maximumPrice);
      expect(buyData.feeRecipientAddress).to.equals(
        buyConfig.feeRecipient.toLowerCase()
      );
    });

    it("should query the SaleFeeRecipient after a buy", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const saleFeeRecipientId = `${sale.address.toLowerCase()}-${recipient.address.toLocaleLowerCase()}`;

      const query = `
        {
          saleBuy (id: "${transaction.hash.toLowerCase()}") {
            feeRecipient {
              address
            }
          }
          saleFeeRecipient (id: "${saleFeeRecipientId}") {
            address
            totalFees
            buys {
              id
            }
            refunds {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const saleBuyData = response.data.saleBuy;
      const saleFeeRecipientData = response.data.saleFeeRecipient;

      expect(saleBuyData.feeRecipient.address).to.equals(
        recipient.address.toLocaleLowerCase()
      );

      expect(saleFeeRecipientData.address).to.equals(
        recipient.address.toLocaleLowerCase()
      );
      expect(saleFeeRecipientData.totalFees).to.equals(buyConfig.fee);
      expect(saleFeeRecipientData.buys).to.have.lengthOf(1);
      expect(saleFeeRecipientData.refunds).to.have.lengthOf(0);
    });

    it("should query the Receipt after a buy", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const receipt = (await Util.getEventArgs(transaction, "Buy", sale))
        .receipt;

      // This is the #{Sale.address}+{receipt.id}. We use the events args obtained
      const saleReceiptID = `${sale.address.toLowerCase()}-${receipt.id}`;

      const totalInCalculated = ethers.BigNumber.from(receipt.units)
        .mul(receipt.price)
        .div(ethers.BigNumber.from("1" + eighteenZeros));

      const query = `
        {
          saleBuy (id: "${transaction.hash.toLowerCase()}") {
            receipt {
              receiptId
            }
            totalIn
          }
          saleReceipt  (id: "${saleReceiptID}") {
            id
            receiptId
            feeRecipient
            fee
            units
            price
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const saleBuyData = response.data.saleBuy;
      const saleReceipttData = response.data.saleReceipt;

      expect(saleBuyData.receipt.receiptId).to.equals(receipt.id);
      expect(saleBuyData.totalIn).to.equals(totalInCalculated);

      expect(saleReceipttData.id).to.equals(saleReceiptID);
      expect(saleReceipttData.receiptId).to.equals(receipt.id);
      expect(saleReceipttData.feeRecipient).to.equals(receipt.feeRecipient);
      expect(saleReceipttData.fee).to.equals(receipt.fee);
      expect(saleReceipttData.units).to.equals(receipt.units);
      expect(saleReceipttData.price).to.equals(receipt.price);
    });
  });

  describe("Sale with a non-ERC20 token", function () {});
});
