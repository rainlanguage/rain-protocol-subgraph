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
  OpcodeSale,
  VMState,
} from "./utils/utils";

import reserveTokenJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveTokenTest.sol/ReserveTokenTest.json";
import redeemableTokenJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json";

import { ReserveTokenTest } from "@beehiveinnovation/rain-protocol/typechain/ReserveTokenTest";
import { ERC20BalanceTier } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTier";
import { RedeemableERC20 } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20";
import type {
  BuyEvent,
  Sale,
} from "@beehiveinnovation/rain-protocol/typechain/Sale";

import {
  // Subgraph fetch
  subgraph,
  //Signers
  deployer,
  creator,
  signer1,
  recipient,
  // Factories
  saleFactory,
  feeRecipient,
  erc20BalanceTierFactory,
  redeemableERC20Factory,
  noticeBoard,
} from "./1_trustQueries.test";

enum Status {
  PENDING,
  ACTIVE,
  SUCCESS,
  FAIL,
}

const afterBlockNumberConfig = (blockNumber: number) => {
  return {
    sources: [
      concat([
        // (BLOCK_NUMBER blockNumberSub1 gt)
        op(OpcodeSale.BLOCK_NUMBER),
        op(OpcodeSale.VAL, 0),
        op(OpcodeSale.GREATER_THAN),
      ]),
    ],
    constants: [blockNumber - 1],
    stackLength: 3,
    argumentsLength: 0,
  };
};

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
    erc20BalanceTier = await Util.erc20BalanceTierDeploy(
      erc20BalanceTierFactory,
      creator,
      {
        erc20: reserve.address,
        tierValues: LEVELS,
      }
    );
  });

  it("should query the saleFactory after construction correctly", async function () {
    // Get the Sale implementation
    const implementation = (
      await Util.getEventArgs(
        saleFactory.deployTransaction,
        "Implementation",
        saleFactory
      )
    ).implementation;

    const query = `
      {
        saleFactory (id: "${saleFactory.address.toLowerCase()}") {
          address
          implementation
          redeemableERC20Factory
        }
      }
    `;

    const response = (await subgraph({
      query: query,
    })) as FetchResult;

    const data = response.data.saleFactory;

    expect(data.address).to.equals(saleFactory.address.toLowerCase());
    expect(data.implementation).to.equals(implementation.toLowerCase());
    expect(data.redeemableERC20Factory).to.equals(
      redeemableERC20Factory.address.toLowerCase()
    );
  });

  describe("Success sale - Queries", function () {
    let startBlock: number;
    const saleTimeout = 30;
    const minimumRaise = ethers.BigNumber.from("150000").mul(Util.RESERVE_ONE);

    const totalTokenSupply = ethers.BigNumber.from("2000").mul(Util.ONE);
    const redeemableERC20Config = {
      name: "Token",
      symbol: "TKN",
      distributor: Util.zeroAddress,
      initialSupply: totalTokenSupply,
    };

    const staticPrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);

    const constants = [staticPrice];
    const vBasePrice = op(OpcodeSale.VAL, 0);

    const sources = [concat([vBasePrice])];

    let canStartStateConfig: VMState;
    let canEndStateConfig: VMState;
    const calculatePriceStateConfig = {
      sources,
      constants,
      stackLength: 1,
      argumentsLength: 0,
    };
    const cooldownDuration = 1;
    const dustSize = 0;

    const minimumTier = Tier.ZERO;
    const distributionEndForwardingAddress = ethers.constants.AddressZero;

    const fee = ethers.BigNumber.from("1").mul(Util.RESERVE_ONE);

    // Test aux
    let totalRaised = ethers.BigNumber.from("0"),
      totalFees = ethers.BigNumber.from("0");

    before("creating the sale child", async function () {
      // 5 blocks from now
      startBlock = (await ethers.provider.getBlockNumber()) + 5;

      canStartStateConfig = afterBlockNumberConfig(startBlock);
      canEndStateConfig = afterBlockNumberConfig(startBlock + saleTimeout);

      sale = await Util.saleDeploy(
        saleFactory,
        creator,
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
          tier: erc20BalanceTier.address,
          minimumTier: minimumTier,
          distributionEndForwardingAddress: distributionEndForwardingAddress,
        }
      );

      // Creating the instance for contracts
      redeemableERC20Contract = (await Util.getContractChild(
        sale.deployTransaction,
        redeemableERC20Factory,
        redeemableTokenJson
      )) as RedeemableERC20;

      await waitForSubgraphToBeSynced();
    });

    it("should query the sale child after creation", async function () {
      const query = `
        {
          saleFactory (id: "${saleFactory.address.toLowerCase()}") {
            children {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = response.data.saleFactory;

      expect(data.children).deep.include({ id: sale.address.toLowerCase() });
    });

    it("should query the Sale correctly", async function () {
      const [deployBlock, deployTime] = await Util.getTxTimeblock(
        sale.deployTransaction
      );

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            address
            deployer
            deployBlock
            deployTimestamp
            factory {
              id
            }
            reserve {
              id
            }
            token {
              id
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.sale;

      expect(data.address).to.equals(sale.address.toLowerCase());
      expect(data.deployer).to.equals(creator.address.toLowerCase());
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());

      expect(data.factory.id).to.equals(saleFactory.address.toLowerCase());
      expect(data.reserve.id).to.equals(reserve.address.toLowerCase());
      expect(data.token.id).to.equals(
        redeemableERC20Contract.address.toLowerCase()
      );
    });

    it("should query the initial properties of the Sale correctly", async function () {
      const query = `
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
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = response.data.sale;

      expect(data.recipient).to.equals(recipient.address.toLowerCase());
      expect(data.cooldownDuration).to.equals(cooldownDuration.toString());
      expect(data.minimumRaise).to.equals(minimumRaise.toString());
      expect(data.dustSize).to.equals(dustSize.toString());
      expect(data.unitsAvailable).to.equals(totalTokenSupply.toString());

      expect(data.totalRaised).to.equals("0");
      expect(data.percentRaised).to.equals("0");
      expect(data.totalFees).to.equals("0");
    });

    it("should query the Sale the initial status values", async function () {
      const query = `
      {
        sale (id: "${sale.address.toLowerCase()}") {
          saleStatus
          startEvent {
            id
          }
          endEvent {
            id
          }
          buys {
            id
          }
          refunds {
            id
          }
          saleTransactions {
            id
          }
          notices {
            id
          }
          saleFeeRecipients {
            id
          }
        }
      }
    `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.sale;

      expect(data.saleStatus).to.equals(Status.PENDING);

      expect(data.startEvent).to.be.null;
      expect(data.endEvent).to.be.null;

      expect(data.buys).to.be.empty;
      expect(data.refunds).to.be.empty;
      expect(data.saleTransactions).to.be.empty;
      expect(data.notices).to.be.empty;
      expect(data.saleFeeRecipients).to.be.empty;
    });

    it("should query the State configs after Sale creation", async function () {
      // Converting the configs
      const startConfigExpected = Util.convertConfig(canStartStateConfig);
      const endConfigExpected = Util.convertConfig(canEndStateConfig);
      const priceConfigExpected = Util.convertConfig(calculatePriceStateConfig);

      const query = `
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
        query: query,
      })) as FetchResult;

      const startData = response.data.sale.canStartStateConfig;
      const endData = response.data.sale.canEndStateConfig;
      const priceData = response.data.sale.calculatePriceStateConfig;

      expect(startData.sources).to.eql(startConfigExpected.sources);
      expect(startData.constants).to.eql(startConfigExpected.constants);
      expect(startData.stackLength).to.equals(startConfigExpected.stackLength);
      expect(startData.argumentsLength).to.equals(
        startConfigExpected.argumentsLength
      );

      expect(endData.sources).to.eql(endConfigExpected.sources);
      expect(endData.constants).to.eql(endConfigExpected.constants);
      expect(endData.stackLength).to.equals(endConfigExpected.stackLength);
      expect(endData.argumentsLength).to.equals(
        endConfigExpected.argumentsLength
      );

      expect(priceData.sources).to.eql(priceConfigExpected.sources);
      expect(priceData.constants).to.eql(priceConfigExpected.constants);
      expect(priceData.stackLength).to.equals(priceConfigExpected.stackLength);
      expect(priceData.argumentsLength).to.equals(
        priceConfigExpected.argumentsLength
      );
    });

    it("should query the RedeemableERC20 entity", async function () {
      const [deployBlock, deployTime] = await Util.getTxTimeblock(
        redeemableERC20Contract.deployTransaction
      );
      const query = `
        {
          redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            deployer
            admin
            factory
            redeems {
              id
            }
            treasuryAssets {
              id
            }
            tier {
              id
            }
            minimumTier
            name
            symbol
            totalSupply
            deployBlock
            deployTimestamp
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = response.data.redeemableERC20;

      expect(data.deployer).to.equals(creator.address.toLowerCase());
      expect(data.admin).to.equals(sale.address.toLowerCase());
      expect(data.factory).to.equals(
        redeemableERC20Factory.address.toLowerCase()
      );

      expect(data.redeems).to.be.empty;
      expect(data.treasuryAssets).to.deep.include({
        id: `${redeemableERC20Contract.address.toLowerCase()} - ${reserve.address.toLowerCase()}`,
      });
      expect(data.tier.id).to.equals(erc20BalanceTier.address.toLowerCase());

      expect(data.minimumTier).to.equals(minimumTier.toString());
      expect(data.name).to.equals(redeemableERC20Config.name);
      expect(data.symbol).to.equals(redeemableERC20Config.symbol);
      expect(data.totalSupply).to.equals(redeemableERC20Config.initialSupply);

      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should query the SaleRedeemableERC20 entity correctly", async function () {
      const [deployBlock, deployTime] = await Util.getTxTimeblock(
        redeemableERC20Contract.deployTransaction
      );
      const query = `
        {
            redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
            name
            symbol
            decimals
            totalSupply
            tier {
              id
            }
            minimumTier
            deployBlock
            deployTimestamp
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = response.data.redeemableERC20;

      expect(data.name).to.equals(redeemableERC20Config.name);
      expect(data.symbol).to.equals(redeemableERC20Config.symbol);
      expect(data.decimals).to.equals(await redeemableERC20Contract.decimals());
      expect(data.totalSupply).to.equals(redeemableERC20Config.initialSupply);

      expect(data.tier.id).to.equals(erc20BalanceTier.address.toLowerCase());
      expect(data.minimumTier).to.equals(minimumTier.toString());

      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTime.toString());
    });

    it("should query Notice in Sale correctly", async function () {
      const notices = [
        {
          subject: sale.address,
          data: "0x01",
        },
      ];

      transaction = await noticeBoard.connect(signer1).createNotices(notices);

      // const noticeId = `${transaction.hash.toLowerCase()} - 0`;
      const noticeId = `${sale.address.toLowerCase()} - ${transaction.hash.toLowerCase()} - 0`;
      await waitForSubgraphToBeSynced();

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            notices {
              id
            }
          }
          notice (id: "${noticeId}") {
            sender
            subject{
              id
            }
            data
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataSale = queryResponse.data.sale.notices;
      const dataNotice = queryResponse.data.notice;

      expect(dataSale).deep.include({ id: noticeId });

      expect(dataNotice.sender).to.equals(signer1.address.toLowerCase());
      expect(dataNotice.subject.id).to.equals(sale.address.toLowerCase());
      expect(dataNotice.data).to.equals("0x01");
    });

    it("should query after sale start correctly", async function () {
      // Waiting to start the sale
      await Util.createEmptyBlock(
        startBlock - (await ethers.provider.getBlockNumber())
      );

      // Starting with signer1
      const tx = await sale.connect(signer1).start();

      await waitForSubgraphToBeSynced();

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
      const desiredUnits = totalTokenSupply.div(2);
      const cost = staticPrice.mul(desiredUnits).div(Util.ONE);

      // give signer1 reserve to cover cost + fee
      await reserve.transfer(signer1.address, cost.add(fee));
      const signer1ReserveBalance = await reserve.balanceOf(signer1.address);

      await reserve
        .connect(signer1)
        .approve(sale.address, signer1ReserveBalance);

      buyConfig = {
        feeRecipient: feeRecipient.address,
        fee,
        minimumUnits: desiredUnits,
        desiredUnits,
        maximumPrice: staticPrice,
      };

      // Buying the half of units
      transaction = await sale.connect(signer1).buy(buyConfig);

      const { receipt } = (await Util.getEventArgs(
        transaction,
        "Buy",
        sale
      )) as BuyEvent["args"];

      const totalInCalculated = ethers.BigNumber.from(receipt.units)
        .mul(receipt.price)
        .div(ethers.BigNumber.from("1" + eighteenZeros));

      // Acumulating and saving the acumulates values
      totalRaised = totalRaised.add(totalInCalculated);
      totalFees = totalFees.add(fee);

      await waitForSubgraphToBeSynced();

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

      expect(saleData.buys).deep.include(
        { id: transaction.hash.toLowerCase() },
        `sale entity does not include the buy
        expected include the ID: ${transaction.hash.toLowerCase()}
        got buys with:
        ${JSON.stringify(saleData.buys, null, 2)}`
      );

      expect(saleBuyData.transactionHash).to.equals(
        transaction.hash.toLowerCase()
      );
      expect(saleBuyData.saleContractAddress).to.equals(
        sale.address.toLowerCase()
      );
    });

    it("should query sale properties after buy correctly", async function () {
      const percentRaised = totalRaised.mul(100).div(minimumRaise);

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
      const txHash = transaction.hash.toLowerCase();

      const query = `
        {
          saleBuy (id: "${txHash}") {
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
      const txHash = transaction.hash.toLowerCase();
      const saleFeeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLocaleLowerCase()}`;

      const query = `
        {
          saleBuy (id: "${txHash}") {
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
        feeRecipient.address.toLocaleLowerCase()
      );

      expect(saleFeeRecipientData.address).to.equals(
        feeRecipient.address.toLocaleLowerCase()
      );
      expect(saleFeeRecipientData.totalFees).to.equals(buyConfig.fee);
      expect(saleFeeRecipientData.buys).to.have.lengthOf(1);
      expect(saleFeeRecipientData.refunds).to.be.empty;
    });

    it("should query the Receipt after a buy", async function () {
      const txHash = transaction.hash.toLowerCase();

      const receipt = (await Util.getEventArgs(transaction, "Buy", sale))
        .receipt;
      // This is the #{Sale.address}+{receipt.id}. We use the events args obtained
      const saleReceiptID = `${sale.address.toLowerCase()} - ${receipt.id}`;

      const totalInCalculated = ethers.BigNumber.from(receipt.units)
        .mul(receipt.price)
        .div(ethers.BigNumber.from("1" + eighteenZeros));

      const query = `
        {
          saleBuy (id: "${txHash}") {
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
      expect(saleReceipttData.feeRecipient).to.equals(
        receipt.feeRecipient.toLowerCase()
      );
      expect(saleReceipttData.fee).to.equals(receipt.fee);
      expect(saleReceipttData.units).to.equals(receipt.units);
      expect(saleReceipttData.price).to.equals(receipt.price);
    });

    it("should query after minimum raise met correctly", async function () {
      // Buy all the remain supply to end
      const desiredUnits = totalTokenSupply.div(2);
      const cost = staticPrice.mul(desiredUnits).div(Util.ONE);

      // give signer1 reserve to cover cost + fee
      await reserve.transfer(signer1.address, cost.add(fee));
      const signer1ReserveBalance = await reserve.balanceOf(signer1.address);

      await reserve
        .connect(signer1)
        .approve(sale.address, signer1ReserveBalance);

      buyConfig = {
        feeRecipient: feeRecipient.address,
        fee,
        minimumUnits: desiredUnits,
        desiredUnits,
        maximumPrice: staticPrice,
      };

      transaction = await sale.connect(signer1).buy(buyConfig);

      const { receipt } = (await Util.getEventArgs(
        transaction,
        "Buy",
        sale
      )) as BuyEvent["args"];

      const totalInCalculated = ethers.BigNumber.from(receipt.units)
        .mul(receipt.price)
        .div(ethers.BigNumber.from("1" + eighteenZeros));

      const newUnitsAvailable = await redeemableERC20Contract.balanceOf(
        sale.address
      );

      // Acumulating and saving the acumulates values
      totalRaised = totalRaised.add(totalInCalculated);
      totalFees = totalFees.add(fee);

      const percentRaisedExpected = totalRaised.mul(100).div(minimumRaise);

      await waitForSubgraphToBeSynced();

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
      expect(saleData.percentRaised).to.equals(percentRaisedExpected);
      expect(saleData.totalFees).to.equals(totalFees);
      expect(saleData.saleStatus).to.equals(Status.SUCCESS);
    });

    it("should query SaleEnd after a sale end correctly", async function () {
      await waitForSubgraphToBeSynced();

      // Using the tx saved
      const [deployBlock, deployTime] = await Util.getTxTimeblock(transaction);

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

      expect(parseInt(saleEndData.block)).to.equals(deployBlock);
      expect(parseInt(saleEndData.timestamp)).to.equals(deployTime);
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

  describe("Zero minimum raise ", function () {
    // distributionEndForwardingAddress need to be non zero address
  });

  describe("Failed sale? - Query", function () {
    // SaleRefund
  });

  describe("Sale with a non-ERC20 token", function () {
    // The subgraph must not crash with non-ERC20 token / address as reserve
  });
});
