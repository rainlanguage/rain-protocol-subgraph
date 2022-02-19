/* eslint-disable @typescript-eslint/no-unused-vars */

import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { FetchResult } from "apollo-fetch";
import { concat } from "ethers/lib/utils";

import * as Util from "./utils/utils";
import {
  op,
  deploy,
  waitForSubgraphToBeSynced,
  eighteenZeros,
  Tier,
  LEVELS,
} from "./utils/utils";


import reserveTokenJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveTokenTest.sol/ReserveTokenTest.json";
import redeemableTokenJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json";
import erc20BalanceTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20BalanceTier.sol/ERC20BalanceTier.json";

import { ReserveTokenTest } from "@beehiveinnovation/rain-protocol/typechain/ReserveTokenTest";
import { ERC20BalanceTier } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTier";
import { RedeemableERC20 } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20";
import type {
  BuyEvent,
  Sale,
} from "@beehiveinnovation/rain-protocol/typechain/Sale";
import type {
  SaleConfigStruct,
  SaleFactory,
  SaleRedeemableERC20ConfigStruct,
} from "@beehiveinnovation/rain-protocol/typechain/SaleFactory";
import { isContext } from "vm";

import {
  // Subgraph fetch
  subgraph,
  //Signers
  deployer,
  creator,
  signer1,
  signer2,
  recipient,
  // Factories
  saleFactory,
  feeRecipient,
  erc20BalanceTierFactory,
  redeemableERC20Factory,
} from "./1_trustQueries.test";

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
  ERC20_BALANCE_OF,
  ERC20_TOTAL_SUPPLY,
  ERC721_BALANCE_OF,
  ERC721_OWNER_OF,
  ERC1155_BALANCE_OF,
  ERC1155_BALANCE_OF_BATCH,
  REMAINING_UNITS,
  TOTAL_RESERVE_IN,
  LAST_BUY_BLOCK,
  LAST_BUY_UNITS,
  LAST_BUY_PRICE,
  CURRENT_BUY_UNITS,
  TOKEN_ADDRESS,
  RESERVE_ADDRESS,
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

let reserve: ReserveTokenTest,
  erc20BalanceTier: ERC20BalanceTier,
  sale: Sale,
  redeemableERC20Contract: RedeemableERC20,
  buyConfig: BuyConfig,
  transaction: ContractTransaction; // Use to save the tx between statements

describe("Sales queries test", function () {
  before("getting the factory", async function () {
    reserve = (await deploy(
      reserveTokenJson,
      deployer,
      []
    )) as ReserveTokenTest;

    // Deploying a new Tier Contract
    erc20BalanceTier = (await Util.createChildTyped(
      erc20BalanceTierFactory,
      erc20BalanceTierJson,
      [
        {
          erc20: reserve.address,
          tierValues: LEVELS,
        },
      ],
      deployer
    )) as ERC20BalanceTier;
  });

  it("should query the saleFactory after construction correctly", async function () {
    // The redeemableERC20Factory entity not exist yet, but Josh said that maybe will be implemented
    const query = `
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

    const queryResponse = (await subgraph({
      query: query,
    })) as FetchResult;

    const data = queryResponse.data.saleFactory;

    expect(data.children).to.be.empty;
    expect(data.address).to.equals(saleFactory.address.toLowerCase());
    expect(data.redeemableERC20Factory).to.equals(
      redeemableERC20Factory.address.toLowerCase()
    );
  });

  describe("Success sale - Queries", function () {
    const fee = ethers.BigNumber.from("1").mul(Util.RESERVE_ONE);
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

    const basePrice = ethers.BigNumber.from("100").mul(Util.RESERVE_ONE);
    const balanceMultiplier = ethers.BigNumber.from("100").mul(
      Util.RESERVE_ONE
    );

    const constants = [basePrice, balanceMultiplier];
    const vBasePrice = op(Opcode.VAL, 0);
    const vFractionMultiplier = op(Opcode.VAL, 1);

    // prettier-ignore
    const sources = [
      concat([
          vBasePrice,
              vFractionMultiplier,
                op(Opcode.TOKEN_ADDRESS),
                op(Opcode.SENDER),
              op(Opcode.ERC20_BALANCE_OF),
            op(Opcode.MUL, 2),
              op(Opcode.TOKEN_ADDRESS),
            op(Opcode.ERC20_TOTAL_SUPPLY),
          op(Opcode.DIV, 2),
        op(Opcode.SUB, 2),
      ]),
    ];

    const supplyDivisor = ethers.BigNumber.from("1" + Util.sixteenZeros);

    let startBlock: number,
      canStartStateConfig: StateConfig,
      canEndStateConfig: StateConfig,
      calculatePriceStateConfig: StateConfig;

    // To have a control in sale
    let totalFees: BigNumber = ethers.BigNumber.from(0);
    let totalRaised: BigNumber = ethers.BigNumber.from(0);

    before("creating the sale child", async function () {
      // 2 blocks from now
      startBlock = (await ethers.provider.getBlockNumber()) + 2;
      canStartStateConfig = afterBlockNumberConfig(startBlock);
      canEndStateConfig = afterBlockNumberConfig(startBlock + saleTimeout);

      calculatePriceStateConfig = {
        sources,
        constants,
        stackLength: 6,
        argumentsLength: 0,
      };

      sale = await Util.saleDeploy(
        saleFactory,
        creator,
        {
          canStartStateConfig,
          canEndStateConfig,
          calculatePriceStateConfig,
          recipient: recipient.address,
          reserve: reserve.address,
          cooldownDuration,
          minimumRaise,
          dustSize,
        },
        {
          erc20Config: redeemableERC20Config,
          tier: erc20BalanceTier.address,
          minimumTier: Tier.ZERO,
        }
      );

      // Creating the instance for contracts
      redeemableERC20Contract = (await Util.getContractChild(
        sale.deployTransaction,
        redeemableERC20Factory,
        redeemableTokenJson
      )) as RedeemableERC20;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1500);
    });

    it("should query the sale child after creation", async function () {
      const query = `
        {
          saleFactory (id: "${saleFactory.address.toLowerCase()}") {
            children {
              id
              address
              deployer
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const factoryData = response.data.saleFactory;
      const saleData = factoryData.children[0];

      expect(factoryData.children).to.have.lengthOf(1);
      expect(saleData.id).to.equals(sale.address.toLowerCase());
      expect(saleData.address).to.equals(sale.address.toLowerCase());
      expect(saleData.deployer).to.equals(deployer.address.toLowerCase());
    });

    it("should query the init properties of the sale correctly", async function () {
      const initUnitsAvailable = await redeemableERC20Contract.balanceOf(
        sale.address
      );

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
      expect(saleData.cooldownDuration).to.equals(cooldownDuration.toString());
      expect(saleData.minimumRaise).to.equals(minimumRaise.toString());
      expect(saleData.dustSize).to.equals(dustSize.toString());

      expect(saleData.unitsAvailable).to.equals(initUnitsAvailable.toString());
      expect(saleData.totalRaised).to.equals("0");
      expect(saleData.percentRaised).to.equals("0");
      expect(saleData.totalFees).to.equals("0");
      expect(saleData.saleStatus).to.equals(Status.PENDING);
    });

    it("should query correctly the null values", async function () {
      const saleQuery = `
      {
        sale (id: "${sale.address.toLowerCase()}") {
          id
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
      expect(saleData.startEvent).to.be.null;
      expect(saleData.endEvent).to.be.null;
    });

    it("should query the state configs after creation correctly", async function () {
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

      // expect(startData.sources).to.equals(canStartStateConfig.sources);
      // expect(startData.constants).to.equals(canStartStateConfig.constants.map(ele => ele.toString()));
      expect(startData.stackLength).to.equals(
        canStartStateConfig.stackLength.toString()
      );
      expect(startData.argumentsLength).to.equals(
        canStartStateConfig.argumentsLength.toString()
      );

      // expect(endData.sources).to.equals(canEndStateConfig.sources);
      // expect(endData.constants).to.equals(canEndStateConfig.constants.map(ele => ele.toString()));
      expect(endData.stackLength).to.equals(
        canEndStateConfig.stackLength.toString()
      );
      expect(endData.argumentsLength).to.equals(
        canEndStateConfig.argumentsLength.toString()
      );

      // expect(calculatePriceData.sources).to.equals(calculatePriceStateConfig.sources);
      // expect(calculatePriceData.constants).to.equals(calculatePriceStateConfig.constants.map(ele => ele.toString()));
      expect(calculatePriceData.stackLength).to.equals(
        calculatePriceStateConfig.stackLength.toString()
      );
      expect(calculatePriceData.argumentsLength).to.equals(
        calculatePriceStateConfig.argumentsLength.toString()
      );
    });

    it("should query the correct ERC20 tokens", async function () {
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
        redeemableERC20Contract.address.toLowerCase()
      );
      expect(erc20Tokens.reserve.id).to.equals(reserve.address.toLowerCase());
    });

    it("should query the redeemableERC20 entity", async function () {
      const query = `
        {
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
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

      expect(redeemableERC20Data.redeems).to.be.empty;
      expect(redeemableERC20Data.minimumTier).to.equals(Tier.ZERO.toString());
      expect(redeemableERC20Data.name).to.equals(redeemableERC20Config.name);
      expect(redeemableERC20Data.symbol).to.equals(
        redeemableERC20Config.symbol
      );
      expect(redeemableERC20Data.totalSupply).to.equals(
        redeemableERC20Config.initialSupply
      );
    });

    it("should query the SaleRedeemableERC20 entity correctly", async function () {
      const saleRedeemableERC20 = redeemableERC20Contract.address.toLowerCase();
      const query = `
        {
          redeemableERC20 (id: "${saleRedeemableERC20}") {
            symbol
            totalSupply
            decimals
            name
            tier {
              address
            }
            minimumTier
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      // const queryData = response.data.saleRedeemableERC20;

      // expect(queryData.symbol).to.equals(await redeemableERC20Contract.symbol());
      // expect(queryData.name).to.equals(await redeemableERC20Contract.name());
      // expect(queryData.minimumTier).to.equals(Tier.ZERO);
      // expect(queryData.decimals).to.equals(
      //   await redeemableERC20Contract.decimals()
      // );
      // expect(queryData.totalSupply).to.equals(
      //   await redeemableERC20Contract.totalSupply()
      // );
      // expect(queryData.tier.address).to.equals(
      //   readWriteTier.address.toLowerCase()
      // );
    });

    it("should query after sale start correctly", async function () {
      // Waiting to start the sale
      await Util.createEmptyBlock(
        startBlock - (await ethers.provider.getBlockNumber())
      );

      // Starting with signer1
      const tx = await sale.connect(signer1).start();

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1200);

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            startEvent {
              id
            }
            saleStatus
          }
          saleStart (id: "${tx.hash.toLowerCase()}") {
            transactionHash
            sender
            saleContract {
              address
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const saleData = response.data.sale;
      const saleEventData = response.data.saleStart;

      expect(saleData.startEvent.id).to.equals(tx.hash.toLowerCase());
      expect(saleData.saleStatus).to.equals(Status.ACTIVE);

      expect(saleEventData.transactionHash).to.equals(tx.hash.toLowerCase());
      expect(saleEventData.sender).to.equals(signer1.address.toLowerCase());
      expect(saleEventData.saleContract.address).to.equals(
        sale.address.toLowerCase()
      );
    });

    it("should recognize the saleBuy after a buy correctly", async function () {
      // Values to Buy
      const signer1Balance0 = await redeemableERC20Contract.balanceOf(
        signer1.address
      );

      const desiredUnits0 = totalTokenSupply.div(10);
      const expectedPrice0 = basePrice;

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

      // give signer1 reserve to cover cost + fee
      await reserve.transfer(signer1.address, expectedCost0.add(fee));

      await reserve
        .connect(signer1)
        .approve(sale.address, expectedCost0.add(fee));

      // buy 10% of total supply
      transaction = await sale.connect(signer1).buy(buyConfig);

      const { receipt } = await Util.getEventArgs(transaction, "Buy", sale);

      const totalInCalculated = ethers.BigNumber.from(receipt.units)
        .mul(receipt.price)
        .div(ethers.BigNumber.from("1" + eighteenZeros));

      // Acumulating and saving the acumulates values
      totalRaised = totalRaised.add(totalInCalculated);
      totalFees = totalFees.add(fee);

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1500);

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            buys {
              id
            }
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

    it("should query sale properties after buy correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const percentRaised = totalRaised.div(minimumRaise);
      const initUnitsAvailable = await redeemableERC20Contract.balanceOf(
        sale.address
      );

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            unitsAvailable
            totalRaised
            percentRaised
            totalFees
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const saleData = response.data.sale;

      expect(saleData.unitsAvailable).to.equals(initUnitsAvailable);
      expect(saleData.totalRaised).to.equals(totalRaised);
      expect(saleData.percentRaised).to.equals(percentRaised);
      expect(saleData.totalFees).to.equals(totalFees);
    });

    it("should query the Buy config values correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const txHash = transaction.hash.toLowerCase();

      const query = `
        {
          saleBuy (id: "${transaction.blockHash.toLowerCase()}") {
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
          saleBuy (id: "${transaction.blockHash.toLowerCase()}") {
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
      expect(saleFeeRecipientData.refunds).to.be.empty;
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

    it("should query after minimum raise met correctly", async function () {
      // Buy all the remain supply to end
      const desiredUnits0 = await redeemableERC20Contract.balanceOf(
        sale.address
      );
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

      const receipt = (await Util.getEventArgs(transaction, "Buy", sale))
        .receipt;

      const totalInCalculated = ethers.BigNumber.from(receipt.units)
        .mul(receipt.price)
        .div(ethers.BigNumber.from("1" + eighteenZeros));

      const newUnitsAvailable = await redeemableERC20Contract.balanceOf(
        sale.address
      );

      // Acumulating and saving the acumulates values
      totalRaised = totalRaised.add(totalInCalculated);
      totalFees = totalFees.add(fee);

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            buys {
              id
            }
            endEvent {
              id
            }
            unitsAvailable
            totalRaised
            percentRaised
            totalFees
            saleStatus
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const saleData = response.data.sale;

      expect(saleData.buys).to.have.length(2);
      expect(saleData.endEvent.id).to.equals(transaction.hash.toLowerCase());
      expect(saleData.unitsAvailable).to.equals(newUnitsAvailable);
      expect(saleData.totalRaised).to.equals(totalRaised);
      // Im not sure if it `percentRaised` should be 1 (100%) even when the `totalRaised` is
      // greater than `minimumRaise`. Or could be for ex: 1.5 (150%)
      expect(saleData.percentRaised).to.equals(totalRaised.div(minimumRaise));
      expect(saleData.totalFees).to.equals(totalFees);
      expect(saleData.saleStatus).to.equals(Status.SUCCESS);
    });

    it("should query SaleEnd after a sale end correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          saleEnd (id: "${transaction.hash.toLowerCase()}") {
            block
            transactionHash
            timestamp
            sender
            saleStatus
            saleContract {
              address
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const saleEndData = response.data.saleEnd;

      expect(parseInt(saleEndData.block)).to.equals(transaction.blockNumber);
      expect(parseInt(saleEndData.timestamp)).to.equals(transaction.timestamp);
      expect(saleEndData.sender).to.equals(signer1.address.toLowerCase());
      expect(saleEndData.saleStatus).to.equals(Status.SUCCESS);
      expect(saleEndData.transactionHash).to.equals(
        transaction.hash.toLowerCase()
      );
      expect(saleEndData.saleContract.address).to.equals(
        sale.address.toLowerCase()
      );
    });
  });

  describe("Failed sale? - Query", function () {
    // SaleRefund
  });

  describe("Sale with a non-ERC20 token", function () {
    // The subgraph must not crash with non-ERC20 token / address as reserve
  });

  describe("Use a tier deployed with and without factory", function () {
    // Maybe i should add this to the Tiers test files
    // Existing ContractTier Entity when deployed with factory
    // UnknownTier when deployed without factory
  });
});
