import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { concat } from "ethers/lib/utils";

import * as Util from "./utils/utils";
import {
  op,
  waitForSubgraphToBeSynced,
  getEventArgs,
  Tier,
  SaleStatus,
  zeroAddress,
  VMState,
  AllStandardOps,
  betweenBlockNumbersSource,
} from "./utils/utils";

// Typechain Factories
import { ReserveTokenTest__factory } from "../typechain/factories/ReserveTokenTest__factory";
import { RedeemableERC20__factory } from "../typechain/factories/RedeemableERC20__factory";

// Types
import type { FetchResult } from "apollo-fetch";
import { ContractTransaction } from "ethers";
import type { ReserveTokenTest } from "../typechain/ReserveTokenTest";
import type { CombineTier } from "../typechain/CombineTier";
import type { RedeemableERC20 } from "../typechain/RedeemableERC20";
import type {
  Sale,
  BuyEvent,
  RefundEvent,
  StartEvent,
  StateConfigStruct,
  SaleConfigStruct,
  SaleRedeemableERC20ConfigStruct,
} from "../typechain/Sale";

import {
  // Subgraph
  subgraph,
  // Signers
  deployer,
  creator,
  signer1,
  recipient,
  // Factories
  saleFactory,
  feeRecipient,
  combineTierFactory,
  redeemableERC20Factory,
  noticeBoard,
} from "./1_initQueries.test.";

let reserve: ReserveTokenTest,
  combineTier: CombineTier,
  sale: Sale,
  redeemableERC20Contract: RedeemableERC20,
  transaction: ContractTransaction,
  transactionAux: ContractTransaction;

let tier: CombineTier;

/**
 * Deploy a sale
 */
const deploySale = async (
  _saleConfig?: Partial<SaleConfigStruct>,
  _saleRedeemableConfig?: Partial<SaleRedeemableERC20ConfigStruct>
): Promise<{
  sale: Sale;
  redeemableERC20: RedeemableERC20;
  saleReserve: ReserveTokenTest;
}> => {
  // SaleConfig predefined values
  let saleReserve = await new ReserveTokenTest__factory(deployer).deploy();
  const cooldownDuration = 1;
  const dustSize = 0;
  const minimumRaise = ethers.BigNumber.from("50000").mul(Util.RESERVE_ONE);
  const saleTimeout = 100;

  const startBlock = await ethers.provider.getBlockNumber();
  const saleEnd = 30;

  const basePrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);
  const maxUnits = ethers.BigNumber.from(3);
  const constants = [
    basePrice,
    startBlock - 1,
    startBlock + saleEnd - 1,
    maxUnits,
  ];

  const vBasePrice = op(AllStandardOps.CONSTANT, 0);
  const vStart = op(AllStandardOps.CONSTANT, 1);
  const vEnd = op(AllStandardOps.CONSTANT, 2);
  const vMaxUnits = op(AllStandardOps.CONSTANT, 3);
  const sources = [
    Util.betweenBlockNumbersSource(vStart, vEnd),
    // prettier-ignore
    concat([
      // maxUnits
      vMaxUnits, // static amount
      // price
      vBasePrice,
    ]),
  ];

  const _vmStateConfig: StateConfigStruct = {
    sources: sources,
    constants: constants,
  };

  // SaleRedeemableERC20Config predefined values
  const totalTokenSupply = ethers.BigNumber.from("2000").mul(Util.ONE);
  const redeemableERC20Config = {
    name: "Token",
    symbol: "TKN",
    distributor: Util.zeroAddress,
    initialSupply: totalTokenSupply,
  };

  const saleConfig: SaleConfigStruct = {
    cooldownDuration: cooldownDuration,
    dustSize: dustSize,
    minimumRaise: minimumRaise,
    recipient: recipient.address,
    reserve: saleReserve.address,
    saleTimeout: saleTimeout,
    vmStateConfig: _vmStateConfig,
  };

  const saleRedeemableConfig: SaleRedeemableERC20ConfigStruct = {
    distributionEndForwardingAddress: Util.zeroAddress,
    erc20Config: redeemableERC20Config,
    minimumTier: Tier.ZERO,
    tier: tier.address,
  };

  // Check if it is necessary add a non predefined value
  if (_saleConfig) {
    if (saleConfig.cooldownDuration) {
      saleConfig.cooldownDuration = _saleConfig.cooldownDuration;
    }

    if (saleConfig.dustSize) {
      saleConfig.dustSize = _saleConfig.dustSize;
    }

    if (saleConfig.minimumRaise) {
      saleConfig.minimumRaise = _saleConfig.minimumRaise;
    }

    if (saleConfig.recipient) {
      saleConfig.recipient = _saleConfig.recipient;
    }

    if (saleConfig.reserve) {
      saleConfig.reserve = _saleConfig.reserve;
      saleReserve = new ReserveTokenTest__factory(deployer).attach(
        _saleConfig.reserve
      );
    }

    if (saleConfig.saleTimeout) {
      saleConfig.saleTimeout = _saleConfig.saleTimeout;
    }

    if (saleConfig.vmStateConfig) {
      saleConfig.vmStateConfig = _saleConfig.vmStateConfig;
    }
  }

  if (_saleRedeemableConfig) {
    if (_saleRedeemableConfig.distributionEndForwardingAddress) {
      saleRedeemableConfig.distributionEndForwardingAddress =
        _saleRedeemableConfig.distributionEndForwardingAddress;
    }

    if (_saleRedeemableConfig.erc20Config) {
      saleRedeemableConfig.erc20Config = _saleRedeemableConfig.erc20Config;
    }

    if (_saleRedeemableConfig.minimumTier) {
      saleRedeemableConfig.minimumTier = _saleRedeemableConfig.minimumTier;
    }

    if (_saleRedeemableConfig.tier) {
      saleRedeemableConfig.tier = _saleRedeemableConfig.tier;
    }
  }

  const sale = await Util.saleDeploy(
    saleFactory,
    creator,
    saleConfig,
    saleRedeemableConfig
  );

  const redeemableERC20 = new RedeemableERC20__factory(deployer).attach(
    await Util.getChild(redeemableERC20Factory, sale.deployTransaction)
  );

  // Save new addresses
  return { sale, redeemableERC20, saleReserve };
};

describe("Sales queries test", function () {
  before("deploying fresh test contracts", async function () {
    // Deploying a tier
    tier = await Util.deployAlwaysTier(combineTierFactory, creator);
  });

  describe("SaleFactory entity", async () => {
    it("should query all the basic fields correctly", async () => {
      // Get the Sale implementation
      const implementation = await Util.getImplementation(saleFactory);

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
        query,
      })) as FetchResult;

      const data = response.data.saleFactory;

      expect(data.address).to.equals(saleFactory.address.toLowerCase());
      expect(data.implementation).to.equals(implementation.toLowerCase());
      expect(data.redeemableERC20Factory).to.equals(
        redeemableERC20Factory.address.toLowerCase()
      );
    });

    it("should query multiples Sales from the entity correctly", async () => {
      // Deploying two sales to be query
      const { sale: sale1 } = await deploySale();
      const { sale: sale2 } = await deploySale();

      await waitForSubgraphToBeSynced();

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
        query,
      })) as FetchResult;

      const data = response.data.saleFactory;

      expect(data.children).to.deep.include({
        id: sale1.address.toLowerCase(),
      });
      expect(data.children).to.deep.include({
        id: sale2.address.toLowerCase(),
      });
    });
  });

  xdescribe("Success sale", function () {
    const saleTimeout = 30;
    const maxUnits = ethers.BigNumber.from(3);
    const minimumRaise = ethers.BigNumber.from("150000").mul(Util.RESERVE_ONE);

    const totalTokenSupply = ethers.BigNumber.from("2000").mul(Util.ONE);
    const redeemableERC20Config = {
      name: "Token",
      symbol: "TKN",
      distributor: zeroAddress,
      initialSupply: totalTokenSupply,
    };

    const staticPrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);

    let startBlock: number, vmStateConfig: VMState;

    const cooldownDuration = 1;
    const dustSize = 0;

    const minimumTier = Tier.ZERO;
    const distributionEndForwardingAddress = ethers.constants.AddressZero;

    const fee = ethers.BigNumber.from("1").mul(Util.RESERVE_ONE);

    // Test aux
    let totalRaisedExpected = ethers.BigNumber.from("0"),
      totalFeesExpected = ethers.BigNumber.from("0"),
      feeRecipientTotalFees = ethers.BigNumber.from("0");

    before("creating the sale child", async function () {
      // 5 blocks from now
      startBlock = (await ethers.provider.getBlockNumber()) + 5;

      const constants = [
        staticPrice,
        startBlock - 1,
        startBlock + saleTimeout - 1,
        maxUnits,
      ];

      const vBasePrice = op(AllStandardOps.CONSTANT, 0);
      const vStart = op(AllStandardOps.CONSTANT, 1);
      const vEnd = op(AllStandardOps.CONSTANT, 2);
      const vMaxUnits = op(AllStandardOps.CONSTANT, 3);
      const sources = [
        betweenBlockNumbersSource(vStart, vEnd),
        // prettier-ignore
        concat([
          // maxUnits
          vMaxUnits, // static amount
          // price
          vBasePrice,
        ]),
      ];

      vmStateConfig = {
        constants: constants,
        sources: sources,
      };

      sale = await Util.saleDeploy(
        saleFactory,
        creator,
        {
          vmStateConfig: vmStateConfig,
          recipient: recipient.address,
          reserve: reserve.address,
          cooldownDuration: cooldownDuration,
          minimumRaise,
          dustSize: dustSize,
          saleTimeout: 100,
        },
        {
          erc20Config: redeemableERC20Config,
          tier: combineTier.address,
          minimumTier: minimumTier,
          distributionEndForwardingAddress: distributionEndForwardingAddress,
        }
      );

      // Creating the instance for contracts
      redeemableERC20Contract = new RedeemableERC20__factory(deployer).attach(
        await Util.getChild(redeemableERC20Factory, sale.deployTransaction)
      );

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      redeemableERC20Contract.deployTransaction = sale.deployTransaction;

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
        query,
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
        query,
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
        query,
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
        query,
      })) as FetchResult;
      const data = response.data.sale;

      expect(data.saleStatus).to.equals(SaleStatus.PENDING);

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
        query,
      })) as FetchResult;

      const startData = response.data.sale.canStartStateConfig;
      const endData = response.data.sale.canEndStateConfig;
      const priceData = response.data.sale.calculatePriceStateConfig;
    });

    it("should query the RedeemableERC20 entity", async function () {
      const [deployBlock, deployTime] = await Util.getTxTimeblock(
        redeemableERC20Contract.deployTransaction
      );

      const treasuryAssetId = `${redeemableERC20Contract.address.toLowerCase()} - ${reserve.address.toLowerCase()}`;

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
      expect(data.treasuryAssets).to.deep.include({ id: treasuryAssetId });
      expect(data.tier.id).to.equals(combineTier.address.toLowerCase());

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
        query,
      })) as FetchResult;

      const data = response.data.redeemableERC20;

      expect(data.name).to.equals(redeemableERC20Config.name);
      expect(data.symbol).to.equals(redeemableERC20Config.symbol);
      expect(data.decimals).to.equals(await redeemableERC20Contract.decimals());
      expect(data.totalSupply).to.equals(redeemableERC20Config.initialSupply);

      expect(data.tier.id).to.equals(combineTier.address.toLowerCase());
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
        query,
      })) as FetchResult;
      const dataSale = queryResponse.data.sale.notices;
      const dataNotice = queryResponse.data.notice;

      expect(dataSale).deep.include({ id: noticeId });

      expect(dataNotice.sender).to.equals(signer1.address.toLowerCase());
      expect(dataNotice.subject.id).to.equals(sale.address.toLowerCase());
      expect(dataNotice.data).to.equals("0x01");
    });

    it("should query the Sale after start correctly", async function () {
      // Waiting to start the sale
      await Util.createEmptyBlock(
        startBlock - (await ethers.provider.getBlockNumber())
      );

      // Starting with signer1
      transaction = await sale.connect(signer1).start();

      await waitForSubgraphToBeSynced();

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            saleStatus
            startEvent {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.sale;

      expect(data.saleStatus).to.equals(SaleStatus.ACTIVE);
      expect(data.startEvent.id).to.equals(transaction.hash.toLowerCase());
    });

    it("should query the SaleStart after start the Sale", async function () {
      const saleStartId = transaction.hash.toLowerCase();

      const [deployBlock, deployTime] = await Util.getTxTimeblock(transaction);

      // Get the sender from event
      const { sender } = (await getEventArgs(
        transaction,
        "Start",
        sale
      )) as StartEvent["args"];

      const query = `
        {
          saleStart (id: "${saleStartId}") {
            transactionHash
            sender
            saleContract {
              id
            }
            block
            timestamp
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.saleStart;

      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
      expect(data.sender).to.equals(sender.toLowerCase());

      expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
      expect(data.block).to.equals(deployBlock.toString());
      expect(data.timestamp).to.equals(deployTime.toString());
    });

    it("should update the Sale after buy correctly", async function () {
      // Buy the 50% of the units availables
      const desiredUnits = (
        await redeemableERC20Contract.balanceOf(sale.address)
      ).div(2);

      const cost = staticPrice.mul(desiredUnits).div(Util.ONE);

      // give signer1 reserve to cover cost + fee
      await reserve.transfer(signer1.address, cost.add(fee));
      const signer1ReserveBalance = await reserve.balanceOf(signer1.address);

      await reserve
        .connect(signer1)
        .approve(sale.address, signer1ReserveBalance);

      const buyConfig = {
        feeRecipient: feeRecipient.address,
        fee: fee,
        minimumUnits: desiredUnits,
        desiredUnits: desiredUnits,
        maximumPrice: staticPrice,
      };

      // Buying the half of units
      transaction = await sale.connect(signer1).buy(buyConfig);

      const { receipt } = (await getEventArgs(
        transaction,
        "Buy",
        sale
      )) as BuyEvent["args"];

      const totalInExpected = receipt.units
        .mul(receipt.price)
        .div(Util.ONE)
        .add(receipt.fee);

      // Manage the expected values
      // Fees
      totalFeesExpected = totalFeesExpected.add(receipt.fee);
      feeRecipientTotalFees = feeRecipientTotalFees.add(receipt.fee);

      // Total raised
      totalRaisedExpected = totalRaisedExpected.add(
        totalInExpected.sub(receipt.fee) // the fee is not consired as amount raise
      );

      await waitForSubgraphToBeSynced();

      const unitsAvailableExpected = await redeemableERC20Contract.balanceOf(
        sale.address
      );

      const percentRaisedExpected = totalRaisedExpected
        .mul(100)
        .div(minimumRaise);

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
        query,
      })) as FetchResult;
      const data = response.data.sale;

      expect(data.unitsAvailable).to.equals(unitsAvailableExpected);
      expect(data.totalRaised).to.equals(totalRaisedExpected);
      expect(data.percentRaised).to.equals(percentRaisedExpected);
      expect(data.totalFees).to.equals(totalFeesExpected);
    });

    it("should query the SaleBuy after buy", async function () {
      const [buyBlock, buyTimestamp] = await Util.getTxTimeblock(transaction);

      const saleBuyId = transaction.hash.toLowerCase();
      const feeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;

      const { receipt, config } = (await getEventArgs(
        transaction,
        "Buy",
        sale
      )) as BuyEvent["args"];

      const { fee: feeExpected, units, price, id: receiptId } = receipt;

      const {
        minimumUnits: minimumUnitsExpected,
        desiredUnits: desiredUnitsExpected,
        maximumPrice: maximumPriceExpected,
      } = config;

      const totalInExpected = units.mul(price).div(Util.ONE).add(feeExpected);

      const saleReceiptId = `${sale.address.toLowerCase()} - ${receiptId}`;

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            buys {
              id
            }
          }
          saleBuy (id: "${saleBuyId}") {
            transactionHash
            sender
            block
            timestamp
            saleContract {
              id
            }
            saleContractAddress
            feeRecipient {
              id
            }
            feeRecipientAddress
            totalIn
            fee
            minimumUnits
            desiredUnits
            maximumPrice
            receipt {
              id
            }
            refunded
            refundEvent {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const saleData = response.data.sale;
      const data = response.data.saleBuy;

      expect(saleData.buys).deep.include(
        { id: saleBuyId },
        `buy with ID ${saleBuyId} it is NOT present on the Sale`
      );

      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.block).to.equals(buyBlock.toString());
      expect(data.timestamp).to.equals(buyTimestamp.toString());

      expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
      expect(data.saleContractAddress).to.equals(sale.address.toLowerCase());
      expect(data.feeRecipient.id).to.equals(feeRecipientId);
      expect(data.feeRecipientAddress).to.equals(
        feeRecipient.address.toLowerCase()
      );

      expect(data.fee).to.equals(feeExpected);
      expect(data.minimumUnits).to.equals(minimumUnitsExpected);
      expect(data.desiredUnits).to.equals(desiredUnitsExpected);
      expect(data.maximumPrice).to.equals(maximumPriceExpected);
      expect(data.totalIn).to.equals(totalInExpected);

      expect(data.receipt.id).to.equals(saleReceiptId);
      expect(data.refunded).to.be.false;
      expect(data.refundEvent).to.be.null;
    });

    it("should query the SaleTransaction corresponding to a SaleBuy after a buy should", async function () {
      const [saleBlock, saleTimestamp] = await Util.getTxTimeblock(transaction);

      const saleTransactionId = transaction.hash.toLowerCase();
      const feeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;

      const { receipt } = (await getEventArgs(
        transaction,
        "Buy",
        sale
      )) as BuyEvent["args"];

      const saleReceiptId = `${sale.address.toLowerCase()} - ${receipt.id}`;

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            saleTransactions {
              id
            }
          }
          saleTransaction (id: "${saleTransactionId}") {
            transactionHash
            sender
            block
            timestamp
            saleContract {
              id
            }
            saleContractAddress
            feeRecipient {
              id
            }
            feeRecipientAddress
            receipt {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const dataSale = response.data.sale;
      const data = response.data.saleTransaction;

      expect(dataSale.saleTransactions).deep.include({ id: saleTransactionId });

      expect(data.transactionHash).to.equals(saleTransactionId);
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.block).to.equals(saleBlock.toString());
      expect(data.timestamp).to.equals(saleTimestamp.toString());

      expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
      expect(data.saleContractAddress).to.equals(sale.address.toLowerCase());
      expect(data.feeRecipient.id).to.equals(feeRecipientId);
      expect(data.feeRecipientAddress).to.equals(
        feeRecipient.address.toLowerCase()
      );

      expect(data.receipt.id).to.equals(saleReceiptId);
    });

    it("should query the SaleReceipt after a buy", async function () {
      const { receipt } = (await getEventArgs(
        transaction,
        "Buy",
        sale
      )) as BuyEvent["args"];

      const { id: receiptId, feeRecipient, fee, units, price } = receipt;

      const saleReceiptId = `${sale.address.toLowerCase()} - ${receiptId}`;

      const query = `
        {
          saleReceipt (id: "${saleReceiptId}") {
            receiptId
            feeRecipient
            fee
            units
            price
            saleTransaction
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.saleReceipt;

      expect(data.receiptId).to.equals(receiptId);
      expect(data.feeRecipient).to.equals(feeRecipient.toLowerCase());
      expect(data.fee).to.equals(fee);
      expect(data.units).to.equals(units);
      expect(data.price).to.equals(price);
      expect(data.saleTransaction).to.equals(transaction.hash.toLowerCase());
    });

    it("should query the SaleFeeRecipient after a buy", async function () {
      const saleFeeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;
      const saleBuyId = transaction.hash.toLowerCase();

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            saleFeeRecipients {
              id
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
            sale {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const dataSale = response.data.sale;
      const data = response.data.saleFeeRecipient;

      expect(dataSale.saleFeeRecipients).deep.include(
        { id: saleFeeRecipientId },
        `sale does not include the saleFeeRecipient with ID ${saleFeeRecipientId}`
      );

      expect(data.address).to.equals(feeRecipient.address.toLowerCase());
      expect(data.totalFees).to.equals(feeRecipientTotalFees);

      expect(data.buys).deep.include({ id: saleBuyId });
      expect(data.refunds).to.be.empty;
      expect(data.sale.id).to.equals(sale.address.toLowerCase());
    });

    it("should update the Sale after a refund", async function () {
      // Using the same receipt emitted on the last buy
      const { receipt } = (await getEventArgs(
        transaction,
        "Buy",
        sale
      )) as BuyEvent["args"];

      // Saving the Tx to futher reference
      transactionAux = transaction;

      await redeemableERC20Contract
        .connect(signer1)
        .approve(sale.address, receipt.units);

      transaction = await sale.connect(signer1).refund(receipt);

      await waitForSubgraphToBeSynced();

      // Since it is the same Receipt, we can use it again
      const totalOutExpected = receipt.units
        .mul(receipt.price)
        .div(Util.ONE)
        .add(receipt.fee);

      // Manage the expected values
      // Fees
      totalFeesExpected = totalFeesExpected.sub(receipt.fee);
      feeRecipientTotalFees = feeRecipientTotalFees.sub(receipt.fee);

      // Total raised
      totalRaisedExpected = totalRaisedExpected.sub(
        totalOutExpected.sub(receipt.fee)
      ); // the fee is not consired as amount raise

      const unitsAvailableExpected = await redeemableERC20Contract.balanceOf(
        sale.address
      );

      const percentRaisedExpected = totalRaisedExpected
        .mul(100)
        .div(minimumRaise);

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
        query,
      })) as FetchResult;

      const data = response.data.sale;

      expect(data.unitsAvailable).to.equals(unitsAvailableExpected);
      expect(data.totalRaised).to.equals(totalRaisedExpected);
      expect(data.percentRaised).to.equals(percentRaisedExpected);
      expect(data.totalFees).to.equals(totalFeesExpected);
    });

    it("should query the SaleRefund after refund", async function () {
      const [refundBlock, refundTime] = await Util.getTxTimeblock(transaction);

      const { receipt } = (await getEventArgs(
        transaction,
        "Refund",
        sale
      )) as RefundEvent["args"];

      const { id: receiptId, units, price, fee } = receipt;

      const saleRefundId = transaction.hash.toLowerCase();
      const feeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;
      const saleReceiptId = `${sale.address.toLowerCase()} - ${receiptId}`;

      const feeExpected = fee;
      const totalOutExpected = units.mul(price).div(Util.ONE).add(fee);

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            refunds {
              id
            }
          }
          saleRefund (id: "${saleRefundId}") {
            transactionHash
            sender
            block
            timestamp
            saleContract {
              id
            }
            saleContractAddress
            feeRecipient {
              id
            }
            feeRecipientAddress
            fee
            totalOut
            receipt {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const dataSale = response.data.sale;
      const data = response.data.saleRefund;

      expect(dataSale.refunds).deep.include({ id: saleRefundId });

      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.block).to.equals(refundBlock.toString());
      expect(data.timestamp).to.equals(refundTime.toString());

      expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
      expect(data.saleContractAddress).to.equals(sale.address.toLowerCase());
      expect(data.feeRecipient.id).to.equals(feeRecipientId);
      expect(data.feeRecipientAddress).to.equals(
        feeRecipient.address.toLowerCase()
      );

      expect(data.fee).to.equals(feeExpected);
      expect(data.totalOut).to.equals(totalOutExpected);
      expect(data.receipt.id).to.equals(saleReceiptId);
    });

    it("should update the SaleBuy entity after refund", async function () {
      // Using the tx auxiliar that contain the tx where Buy was made
      const saleBuyId = transactionAux.hash.toLowerCase();

      // Transaction with the refund
      const saleRefundId = transaction.hash.toLowerCase();

      const query = `
        {
          saleBuy (id: "${saleBuyId}") {
            refunded
            refundEvent {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.saleBuy;

      expect(data.refunded).to.be.true;
      expect(data.refundEvent.id).to.equals(saleRefundId);
    });

    it("should query the SaleTransaction corresponding to a SaleRefund after a refund", async function () {
      const [saleBlock, saleTimestamp] = await Util.getTxTimeblock(transaction);

      const saleTransactionId = transaction.hash.toLowerCase();
      const feeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;

      const { receipt } = (await getEventArgs(
        transaction,
        "Refund",
        sale
      )) as RefundEvent["args"];

      const saleReceiptId = `${sale.address.toLowerCase()} - ${receipt.id}`;

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            saleTransactions {
              id
            }
          }
          saleTransaction (id: "${saleTransactionId}") {
            transactionHash
            sender
            block
            timestamp
            saleContract {
              id
            }
            saleContractAddress
            feeRecipient {
              id
            }
            feeRecipientAddress
            receipt {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const dataSale = response.data.sale;
      const data = response.data.saleTransaction;

      expect(dataSale.saleTransactions).deep.include({ id: saleTransactionId });

      expect(data.transactionHash).to.equals(saleTransactionId);
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.block).to.equals(saleBlock.toString());
      expect(data.timestamp).to.equals(saleTimestamp.toString());

      expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
      expect(data.saleContractAddress).to.equals(sale.address.toLowerCase());
      expect(data.feeRecipient.id).to.equals(feeRecipientId);
      expect(data.feeRecipientAddress).to.equals(
        feeRecipient.address.toLowerCase()
      );

      expect(data.receipt.id).to.equals(saleReceiptId);
    });

    it("should update the SaleFeeRecipient after refund", async function () {
      const saleFeeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;

      const saleRefundId = transaction.hash.toLowerCase();

      const query = `
        {
          saleFeeRecipient (id: "${saleFeeRecipientId}") {
            totalFees
            refunds {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.saleFeeRecipient;

      expect(data.totalFees).to.equals(feeRecipientTotalFees);
      expect(data.refunds).deep.include({ id: saleRefundId });
    });

    it("should update the Sale after reaching the minimum raise", async function () {
      // Buy all the remain supply to end
      const desiredUnits = await redeemableERC20Contract.balanceOf(
        sale.address
      );
      const cost = staticPrice.mul(desiredUnits).div(Util.ONE);

      // give signer1 reserve to cover cost + fee
      await reserve.transfer(signer1.address, cost.add(fee));
      const signer1ReserveBalance = await reserve.balanceOf(signer1.address);

      await reserve
        .connect(signer1)
        .approve(sale.address, signer1ReserveBalance);

      const buyConfig = {
        feeRecipient: feeRecipient.address,
        fee,
        minimumUnits: desiredUnits,
        desiredUnits,
        maximumPrice: staticPrice,
      };

      transaction = await sale.connect(signer1).buy(buyConfig);

      const { receipt } = (await getEventArgs(
        transaction,
        "Buy",
        sale
      )) as BuyEvent["args"];

      const totalInExpected = receipt.units
        .mul(receipt.price)
        .div(Util.ONE)
        .add(receipt.fee);

      // Add the fees to manage the expected value
      totalFeesExpected = totalFeesExpected.add(receipt.fee);
      feeRecipientTotalFees = feeRecipientTotalFees.add(receipt.fee);
      totalRaisedExpected = totalRaisedExpected.add(
        totalInExpected.sub(receipt.fee)
      );

      await waitForSubgraphToBeSynced();

      const unitsAvailableExpected = await redeemableERC20Contract.balanceOf(
        sale.address
      );

      // Since the sale reach the minimum, then will be 100%
      const percentRaisedExpected = "100";

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
        query,
      })) as FetchResult;

      const data = response.data.sale;

      expect(data.unitsAvailable).to.equals(unitsAvailableExpected);
      expect(data.totalRaised).to.equals(totalRaisedExpected);
      expect(data.percentRaised).to.equals(percentRaisedExpected);
      expect(data.totalFees).to.equals(totalFeesExpected);
    });

    it("should update the Sale after a end the Sale", async function () {
      // Since the minimun raise was reached, the sale automatically was ended
      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            saleStatus
            endEvent {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.sale;

      expect(data.saleStatus).to.equals(SaleStatus.SUCCESS);
      expect(data.endEvent.id).to.equals(transaction.hash.toLowerCase());
    });

    it("should query SaleEnd after a sale end", async function () {
      const saleEndId = transaction.hash.toLowerCase();

      const [endBlock, endTime] = await Util.getTxTimeblock(transaction);

      const query = `
        {
          saleEnd (id: "${saleEndId}") {
            transactionHash
            sender
            block
            timestamp
            saleContract {
              id
            }
            saleStatus
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.saleEnd;

      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.block).to.equals(endBlock.toString());
      expect(data.timestamp).to.equals(endTime.toString());

      expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
      expect(data.saleStatus).to.equals(SaleStatus.SUCCESS);
    });
  });

  xdescribe("Failed sale", function () {
    const saleTimeout = 30;
    const minimumRaise = ethers.BigNumber.from("150000").mul(Util.RESERVE_ONE);

    const totalTokenSupply = ethers.BigNumber.from("2000").mul(Util.ONE);
    const redeemableERC20Config = {
      name: "Token",
      symbol: "TKN",
      distributor: zeroAddress,
      initialSupply: totalTokenSupply,
    };

    let startBlock: number, vmStateConfig: VMState;

    const cooldownDuration = 1;
    const dustSize = 0;

    const minimumTier = Tier.ZERO;
    const distributionEndForwardingAddress = ethers.constants.AddressZero;

    before("creating the sale child", async function () {
      // 5 blocks from now
      startBlock = (await ethers.provider.getBlockNumber()) + 5;

      const basePrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);
      const maxUnits = ethers.BigNumber.from(3);
      const constants = [
        basePrice,
        startBlock - 1,
        startBlock + saleTimeout - 1,
        maxUnits,
      ];

      const vBasePrice = op(AllStandardOps.CONSTANT, 0);
      const vStart = op(AllStandardOps.CONSTANT, 1);
      const vEnd = op(AllStandardOps.CONSTANT, 2);
      const vMaxUnits = op(AllStandardOps.CONSTANT, 3);
      const sources = [
        betweenBlockNumbersSource(vStart, vEnd),
        // prettier-ignore
        concat([
          // maxUnits
          vMaxUnits, // static amount
          // price
          vBasePrice,
        ]),
      ];

      vmStateConfig = {
        constants: constants,
        sources: sources,
      };

      sale = await Util.saleDeploy(
        saleFactory,
        creator,
        {
          vmStateConfig: vmStateConfig,
          recipient: recipient.address,
          reserve: reserve.address,
          cooldownDuration: cooldownDuration,
          minimumRaise,
          dustSize: dustSize,
          saleTimeout: 100,
        },
        {
          erc20Config: redeemableERC20Config,
          tier: combineTier.address,
          minimumTier: minimumTier,
          distributionEndForwardingAddress: distributionEndForwardingAddress,
        }
      );

      // Creating the instance for contracts
      redeemableERC20Contract = new RedeemableERC20__factory(deployer).attach(
        await Util.getChild(redeemableERC20Factory, sale.deployTransaction)
      );

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      redeemableERC20Contract.deployTransaction = sale.deployTransaction;

      // await waitForSubgraphToBeSynced();
    });

    it("should query the Sale as failed correctly", async function () {
      // wait until sale can start
      while (
        !(await sale.canLive()) &&
        (await sale.saleStatus()) == SaleStatus.PENDING
      ) {
        await Util.createEmptyBlock();
      }

      assert(await sale.canLive(), "sale should be able to start");

      // Sale started
      await sale.start();

      const saleStatusActive = await sale.saleStatus();
      assert(saleStatusActive === SaleStatus.ACTIVE);

      // wait until sale can end
      while (
        !(await sale.canLive()) &&
        (await sale.saleStatus()) == SaleStatus.ACTIVE
      ) {
        await Util.createEmptyBlock();
      }

      assert(await sale.canLive(), "sale should be able to end");

      // Sale ended as failed
      transaction = await sale.connect(signer1).end();
      expect(await sale.saleStatus()).to.be.equals(SaleStatus.FAIL);

      // wait for sync
      await waitForSubgraphToBeSynced();

      const saleEndId = transaction.hash.toLowerCase();

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            saleStatus
            endEvent {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.sale;

      expect(data.saleStatus).to.equals(SaleStatus.FAIL);
      expect(data.endEvent.id).to.equals(saleEndId);
    });

    it("should query the SaleEnd after a sale failing", async function () {
      expect(await sale.saleStatus()).to.be.equals(
        SaleStatus.FAIL,
        "sale is not failed"
      );

      const saleEndId = transaction.hash.toLowerCase();

      const query = `
        {
          saleEnd (id: "${saleEndId}") {
            transactionHash
            sender
            saleContract {
              id
            }
            saleStatus
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.saleEnd;

      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
      expect(data.saleStatus).to.equals(SaleStatus.FAIL);
    });
  });

  xdescribe("Sale with a non-ERC20 token as reserve", function () {
    // The subgraph must not crash with non-ERC20 token / address as reserve
    let startBlock: number, vmStateConfig: VMState;

    const cooldownDuration = 1;
    const minimumRaise = ethers.BigNumber.from("150000").mul(Util.RESERVE_ONE);
    const dustSize = 0;

    const saleTimeout = 30;

    const redeemableERC20Config = {
      name: "Token",
      symbol: "TKN",
      distributor: zeroAddress,
      initialSupply: ethers.BigNumber.from("2000").mul(Util.ONE),
    };
    const minimumTier = Tier.ZERO;
    const distributionEndForwardingAddress = zeroAddress;

    let nonErc20: string;

    before("creating the sale child", async function () {
      // 5 blocks from now
      startBlock = (await ethers.provider.getBlockNumber()) + 5;

      const basePrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);
      const maxUnits = ethers.BigNumber.from(3);
      const constants = [
        basePrice,
        startBlock - 1,
        startBlock + saleTimeout - 1,
        maxUnits,
      ];

      const vBasePrice = op(AllStandardOps.CONSTANT, 0);
      const vStart = op(AllStandardOps.CONSTANT, 1);
      const vEnd = op(AllStandardOps.CONSTANT, 2);
      const vMaxUnits = op(AllStandardOps.CONSTANT, 3);
      const sources = [
        betweenBlockNumbersSource(vStart, vEnd),
        // prettier-ignore
        concat([
          // maxUnits
          vMaxUnits, // static amount
          // price
          vBasePrice,
        ]),
      ];

      vmStateConfig = { constants: constants, sources: sources };

      // It could be an non-ERC20 address
      nonErc20 = signer1.address;

      sale = await Util.saleDeploy(
        saleFactory,
        creator,
        {
          vmStateConfig: vmStateConfig,
          recipient: recipient.address,
          reserve: nonErc20,
          cooldownDuration: cooldownDuration,
          minimumRaise,
          dustSize: dustSize,
          saleTimeout: 100,
        },
        {
          erc20Config: redeemableERC20Config,
          tier: combineTier.address,
          minimumTier: minimumTier,
          distributionEndForwardingAddress: distributionEndForwardingAddress,
        }
      );

      // Creating the instance for contracts
      redeemableERC20Contract = new RedeemableERC20__factory(deployer).attach(
        await Util.getChild(redeemableERC20Factory, sale.deployTransaction)
      );

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      redeemableERC20Contract.deployTransaction = sale.deployTransaction;

      await waitForSubgraphToBeSynced();
    });

    it("should query as null the reserve when is a non-ERC20 token", async function () {
      const [blockDeploy, timeDeploy] = await Util.getTxTimeblock(
        sale.deployTransaction
      );

      const query = `
        {
          sale (id: "${sale.address.toLowerCase()}") {
            reserve {
              id
              name
              symbol
              decimals
              totalSupply
              deployBlock
              deployTimestamp
            }
          }
        }
      `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.sale.reserve;

      expect(data.id).to.equals(nonErc20.toLowerCase());
      expect(data.name).to.be.null;
      expect(data.symbol).to.be.null;
      expect(data.decimals).to.be.null;
      expect(data.totalSupply).to.be.null;

      expect(data.deployBlock).to.equals(blockDeploy.toString());
      expect(data.deployTimestamp).to.equals(timeDeploy.toString());
    });
  });
});
