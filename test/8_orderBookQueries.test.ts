import { ethers } from "hardhat";
import { concat } from "ethers/lib/utils";
import { BigNumber } from "ethers";

import {
  op,
  getEventArgs,
  eighteenZeros,
  OrderBookOpcode,
  waitForSubgraphToBeSynced,
} from "./utils/utils";
import * as Util from "./utils/utils";

// Typechain Factories
import { ReserveTokenTest__factory } from "../typechain/factories/ReserveTokenTest__factory";

// Types
import type { FetchResult } from "apollo-fetch";
import type { ReserveTokenTest } from "../typechain/ReserveTokenTest";
import type {
  // Structs - configs
  OrderConfigStruct,
  OrderStruct,
  DepositConfigStruct,
  BountyConfigStruct,
  // Events
  OrderLiveEvent,
  DepositEvent,
} from "../typechain/OrderBook";

import {
  // Subgraph
  subgraph,
  // Contracts
  orderBook,
  // Signers
  deployer,
  signer1,
  signer2,
  signer3 as bountyAccount,
} from "./1_initQueries.test.";
import { expect } from "chai";

let tokenA: ReserveTokenTest, tokenB: ReserveTokenTest;

function getOrderIdFromOrder(_order: Readonly<OrderStruct>): string {
  const encodeOrder = ethers.utils.defaultAbiCoder.encode(
    ["tuple(address, address, uint256, address, uint256, uint256, bytes)"],
    [
      [
        _order.owner,
        _order.inputToken,
        _order.inputVaultId,
        _order.outputToken,
        _order.outputVaultId,
        _order.tracking,
        _order.vmState,
      ],
    ]
  );

  return BigNumber.from(ethers.utils.keccak256(encodeOrder)).toString();
}

describe.only("Orderbook test", () => {
  const TRACK_CLEARED_ORDER = 0x1;
  const cOrderHash = op(OrderBookOpcode.CONTEXT, 0);

  beforeEach("deploying fresh test contracts", async () => {
    tokenA = await new ReserveTokenTest__factory(deployer).deploy();
    tokenB = await new ReserveTokenTest__factory(deployer).deploy();
  });

  describe("Order entity", async () => {
    it("should query the Order after addOrder", async () => {
      const InputVault = 1;
      const OutputVault = 2;

      // ASK ORDER
      const askPrice = ethers.BigNumber.from("1" + eighteenZeros);
      const askBlock = await ethers.provider.getBlockNumber();
      const askConstants = [askPrice, askBlock, 5];
      const vAskPrice = op(OrderBookOpcode.CONSTANT, 0);
      const vAskBlock = op(OrderBookOpcode.CONSTANT, 1);
      const v5 = op(OrderBookOpcode.CONSTANT, 2);
      // prettier-ignore
      const askSource = concat([
        // outputMax = (currentBlock - askBlock) * 5 - aliceCleared
        // 5 tokens available per block
              op(OrderBookOpcode.BLOCK_NUMBER),
              vAskBlock,
            op(OrderBookOpcode.SUB, 2),
            v5,
          op(OrderBookOpcode.MUL, 2),
            cOrderHash,
          op(OrderBookOpcode.ORDER_FUNDS_CLEARED),
        op(OrderBookOpcode.SUB, 2),
        vAskPrice,
      ]);

      const askOrderConfig: OrderConfigStruct = {
        inputToken: tokenA.address,
        inputVaultId: InputVault,
        outputToken: tokenB.address,
        outputVaultId: OutputVault,
        tracking: TRACK_CLEARED_ORDER,
        vmStateConfig: {
          sources: [askSource],
          constants: askConstants,
        },
      };

      const transaction = await orderBook
        .connect(signer1)
        .addOrder(askOrderConfig);

      const { config: orderConfig } = (await getEventArgs(
        transaction,
        "OrderLive",
        orderBook
      )) as OrderLiveEvent["args"];

      const orderId = getOrderIdFromOrder(orderConfig);
      const vault_inputVaultID = `${orderConfig.inputVaultId.toString()} - ${orderConfig.owner.toLowerCase()}`; // {vaultId}-{owner}
      const vault_outputVaultID = `${orderConfig.outputVaultId.toString()} - ${orderConfig.owner.toLowerCase()}`; // {vaultId}-{owner}

      await waitForSubgraphToBeSynced();

      // Make the order with a fixed ID
      const query = `
        {
          orders {
            id
            owner
            tracking
            vmState
            orderLiveness
            inputToken {
              id
            }
            outputToken {
              id
            }
            inputVault {
              id
            }
            outputVault {
              id
            }
            inputTokenVault {
              id
            }
            outputTokenVault {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.orders[0];

      expect(data.orderLiveness).to.be.true;
      expect(data.owner).to.be.equals(orderConfig.owner.toLowerCase());

      expect(data.tracking).to.be.equals(orderConfig.tracking);
      expect(data.vmState).to.be.equals(orderConfig.vmState);

      expect(data.inputToken.id).to.be.equals(
        orderConfig.inputToken.toLowerCase()
      );
      expect(data.outputToken.id).to.be.equals(
        orderConfig.outputToken.toLowerCase()
      );

      // Vault
      expect(data.inputVault.id).to.be.equals(vault_inputVaultID);
      expect(data.outputVault.id).to.be.equals(vault_outputVaultID);

      // TokenVault
      expect(
        data.inputTokenVault.id,
        "wrong - there is not match for inputTokenVault yet"
      ).to.be.not.null;
      expect(
        data.outputTokenVault.id,
        "wrong - there is not match for outputTokenVault yet"
      ).to.be.not.null;
    });

    it("should update orderLiveness to false in the Order after removeOrder", async () => {
      const InputVault = 10;
      const OutputVault = 20;

      // ASK ORDER
      const askPrice = ethers.BigNumber.from("1" + eighteenZeros);
      const askBlock = await ethers.provider.getBlockNumber();
      const askConstants = [askPrice, askBlock, 5];
      const vAskPrice = op(OrderBookOpcode.CONSTANT, 0);
      const vAskBlock = op(OrderBookOpcode.CONSTANT, 1);
      const v5 = op(OrderBookOpcode.CONSTANT, 2);
      // prettier-ignore
      const askSource = concat([
        // outputMax = (currentBlock - askBlock) * 5 - aliceCleared
        // 5 tokens available per block
              op(OrderBookOpcode.BLOCK_NUMBER),
              vAskBlock,
            op(OrderBookOpcode.SUB, 2),
            v5,
          op(OrderBookOpcode.MUL, 2),
            cOrderHash,
          op(OrderBookOpcode.ORDER_FUNDS_CLEARED),
        op(OrderBookOpcode.SUB, 2),
        vAskPrice,
      ]);

      const askOrderConfig: OrderConfigStruct = {
        inputToken: tokenA.address,
        inputVaultId: InputVault,
        outputToken: tokenB.address,
        outputVaultId: OutputVault,
        tracking: TRACK_CLEARED_ORDER,
        vmStateConfig: {
          sources: [askSource],
          constants: askConstants,
        },
      };

      const txAddOrder = await orderBook
        .connect(signer1)
        .addOrder(askOrderConfig);

      const { config: orderConfig } = (await getEventArgs(
        txAddOrder,
        "OrderLive",
        orderBook
      )) as OrderLiveEvent["args"];

      // Removing the order
      await orderBook.connect(signer1).removeOrder(orderConfig);

      const orderId = getOrderIdFromOrder(orderConfig);

      await waitForSubgraphToBeSynced();

      const query = `
        {
          order (id: "${orderId}") {
            orderLiveness
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.order;

      expect(data.orderLiveness).to.be.false;
    });

    it("should update orderLiveness to true in the Order after addOrder again", async () => {
      const InputVault = 10;
      const OutputVault = 20;

      // ASK ORDER
      const askPrice = ethers.BigNumber.from("1" + eighteenZeros);
      const askBlock = await ethers.provider.getBlockNumber();
      const askConstants = [askPrice, askBlock, 5];
      const vAskPrice = op(OrderBookOpcode.CONSTANT, 0);
      const vAskBlock = op(OrderBookOpcode.CONSTANT, 1);
      const v5 = op(OrderBookOpcode.CONSTANT, 2);
      // prettier-ignore
      const askSource = concat([
        // outputMax = (currentBlock - askBlock) * 5 - aliceCleared
        // 5 tokens available per block
              op(OrderBookOpcode.BLOCK_NUMBER),
              vAskBlock,
            op(OrderBookOpcode.SUB, 2),
            v5,
          op(OrderBookOpcode.MUL, 2),
            cOrderHash,
          op(OrderBookOpcode.ORDER_FUNDS_CLEARED),
        op(OrderBookOpcode.SUB, 2),
        vAskPrice,
      ]);

      const askOrderConfig: OrderConfigStruct = {
        inputToken: tokenA.address,
        inputVaultId: InputVault,
        outputToken: tokenB.address,
        outputVaultId: OutputVault,
        tracking: TRACK_CLEARED_ORDER,
        vmStateConfig: {
          sources: [askSource],
          constants: askConstants,
        },
      };

      const txAddOrder = await orderBook
        .connect(signer1)
        .addOrder(askOrderConfig);

      const { config: orderConfig } = (await getEventArgs(
        txAddOrder,
        "OrderLive",
        orderBook
      )) as OrderLiveEvent["args"];

      // Removing the order
      await orderBook.connect(signer1).removeOrder(orderConfig);

      // Add again the order
      await orderBook.connect(signer1).addOrder(askOrderConfig);

      const orderId = getOrderIdFromOrder(orderConfig);

      await waitForSubgraphToBeSynced();

      const query = `
        {
          order (id: "${orderId}") {
            orderLiveness
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.order;

      expect(data.orderLiveness).to.be.true;
    });

    it("should update the Order after a deposit", async () => {
      const InputVault = 1;
      const OutputVault = 2;

      // ASK ORDER
      const askPrice = ethers.BigNumber.from("1" + eighteenZeros);
      const askBlock = await ethers.provider.getBlockNumber();
      const askConstants = [askPrice, askBlock, 5];
      const vAskPrice = op(OrderBookOpcode.CONSTANT, 0);
      const vAskBlock = op(OrderBookOpcode.CONSTANT, 1);
      const v5 = op(OrderBookOpcode.CONSTANT, 2);
      // prettier-ignore
      const askSource = concat([
        // outputMax = (currentBlock - askBlock) * 5 - aliceCleared
        // 5 tokens available per block
              op(OrderBookOpcode.BLOCK_NUMBER),
              vAskBlock,
            op(OrderBookOpcode.SUB, 2),
            v5,
          op(OrderBookOpcode.MUL, 2),
            cOrderHash,
          op(OrderBookOpcode.ORDER_FUNDS_CLEARED),
        op(OrderBookOpcode.SUB, 2),
        vAskPrice,
      ]);

      const askOrderConfig: OrderConfigStruct = {
        inputToken: tokenA.address,
        inputVaultId: InputVault,
        outputToken: tokenB.address,
        outputVaultId: OutputVault,
        tracking: TRACK_CLEARED_ORDER,
        vmStateConfig: {
          sources: [askSource],
          constants: askConstants,
        },
      };

      const txAddOrder = await orderBook
        .connect(signer1)
        .addOrder(askOrderConfig);

      // DEPOSITS
      // Provide tokens to Signer1
      const amountB = ethers.BigNumber.from("1000" + eighteenZeros);
      await tokenB.transfer(signer1.address, amountB);

      const depositConfigOrder: DepositConfigStruct = {
        token: tokenB.address,
        vaultId: OutputVault,
        amount: amountB,
      };

      await tokenB
        .connect(signer1)
        .approve(orderBook.address, depositConfigOrder.amount);

      // Signer1 deposits tokenB into his output vault
      const txDepositOrder = await orderBook
        .connect(signer1)
        .deposit(depositConfigOrder);

      const { config: orderConfig } = (await getEventArgs(
        txAddOrder,
        "OrderLive",
        orderBook
      )) as OrderLiveEvent["args"];

      const { config: depositConfig } = (await getEventArgs(
        txDepositOrder,
        "Deposit",
        orderBook
      )) as DepositEvent["args"];

      expect(orderConfig.outputToken).to.be.equals(depositConfig.token);
      expect(orderConfig.outputVaultId).to.be.equals(depositConfig.vaultId);

      await waitForSubgraphToBeSynced();

      const orderId = getOrderIdFromOrder(orderConfig);
      // {vaultId}-{owner}-{token}
      const outputTokenVault_Id = `${orderConfig.outputVaultId.toString()} - ${orderConfig.owner.toLowerCase()} - ${orderConfig.outputToken.toLowerCase()}`;

      const query = `
        {
          order (id: "${orderId}") {
            outputTokenVault {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.order;
      expect(data.outputTokenVault.id).to.be.equals(outputTokenVault_Id);
    });

    it("should update the Order after a clear", async () => {
      const signer1InputVault = ethers.BigNumber.from(1);
      const signer1OutputVault = ethers.BigNumber.from(2);
      const signer2InputVault = ethers.BigNumber.from(1);
      const signer2OutputVault = ethers.BigNumber.from(2);
      const bountyAccVaultA = ethers.BigNumber.from(1);
      const bountyAccVaultB = ethers.BigNumber.from(2);

      // ASK ORDER

      const askPrice = ethers.BigNumber.from("90" + eighteenZeros);
      const askBlock = await ethers.provider.getBlockNumber();
      const askConstants = [askPrice, askBlock, 5];
      const vAskPrice = op(OrderBookOpcode.CONSTANT, 0);
      const vAskBlock = op(OrderBookOpcode.CONSTANT, 1);
      const v5 = op(OrderBookOpcode.CONSTANT, 2);
      // prettier-ignore
      const askSource = concat([
        // outputMax = (currentBlock - askBlock) * 5 - aliceCleared
        // 5 tokens available per block
              op(OrderBookOpcode.BLOCK_NUMBER),
              vAskBlock,
            op(OrderBookOpcode.SUB, 2),
            v5,
          op(OrderBookOpcode.MUL, 2),
            cOrderHash,
          op(OrderBookOpcode.ORDER_FUNDS_CLEARED),
        op(OrderBookOpcode.SUB, 2),
        vAskPrice,
      ]);

      const askOrderConfig: OrderConfigStruct = {
        inputToken: tokenA.address,
        inputVaultId: signer1InputVault,
        outputToken: tokenB.address,
        outputVaultId: signer1OutputVault,
        tracking: TRACK_CLEARED_ORDER,
        vmStateConfig: {
          sources: [askSource],
          constants: askConstants,
        },
      };

      const txAskOrderLive = await orderBook
        .connect(signer1)
        .addOrder(askOrderConfig);

      const { config: askConfig } = (await getEventArgs(
        txAskOrderLive,
        "OrderLive",
        orderBook
      )) as OrderLiveEvent["args"];

      // BID ORDER
      const bidOutputMax = Util.max_uint256;
      const bidPrice = Util.fixedPointDiv(Util.ONE, askPrice);
      const bidConstants = [bidOutputMax, bidPrice];
      const vBidOutputMax = op(OrderBookOpcode.CONSTANT, 0);
      const vBidPrice = op(OrderBookOpcode.CONSTANT, 1);
      // prettier-ignore
      const bidSource = concat([
        vBidOutputMax,
        vBidPrice,
      ]);
      const bidOrderConfig: OrderConfigStruct = {
        inputToken: tokenB.address,
        inputVaultId: signer2InputVault,
        outputToken: tokenA.address,
        outputVaultId: signer2OutputVault,
        tracking: 0x0,
        vmStateConfig: {
          sources: [bidSource],
          constants: bidConstants,
        },
      };

      const txBidOrderLive = await orderBook
        .connect(signer2)
        .addOrder(bidOrderConfig);

      const { config: bidConfig } = (await Util.getEventArgs(
        txBidOrderLive,
        "OrderLive",
        orderBook
      )) as OrderLiveEvent["args"];

      // DEPOSITS
      const amountB = ethers.BigNumber.from("1000" + Util.eighteenZeros);
      const amountA = ethers.BigNumber.from("1000" + Util.eighteenZeros);

      await tokenB.transfer(signer1.address, amountB);
      await tokenA.transfer(signer2.address, amountA);

      const depositConfigSigner1: DepositConfigStruct = {
        token: tokenB.address,
        vaultId: signer1OutputVault,
        amount: amountB,
      };
      const depositConfigSigner2: DepositConfigStruct = {
        token: tokenA.address,
        vaultId: signer2OutputVault,
        amount: amountA,
      };

      await tokenB
        .connect(signer1)
        .approve(orderBook.address, depositConfigSigner1.amount);
      await tokenA
        .connect(signer2)
        .approve(orderBook.address, depositConfigSigner2.amount);

      // Signer1 deposits tokenB into her output vault
      await orderBook.connect(signer1).deposit(depositConfigSigner1);
      // Signer2 deposits tokenA into his output vault
      await orderBook.connect(signer2).deposit(depositConfigSigner2);

      // BOUNTY BOT CLEARS THE ORDER
      const bountyConfig: BountyConfigStruct = {
        aVaultId: bountyAccVaultA,
        bVaultId: bountyAccVaultB,
      };

      await orderBook
        .connect(bountyAccount)
        .clear(askConfig, bidConfig, bountyConfig);

      await waitForSubgraphToBeSynced();

      const orderId = getOrderIdFromOrder(askConfig);
      // {vaultId}-{owner}-{token}
      const inputTokenVault_Id = `${askConfig.inputVaultId.toString()} - ${askConfig.owner.toLowerCase()} - ${askConfig.inputToken.toLowerCase()}`;
      const outputTokenVault_Id = `${askConfig.outputVaultId.toString()} - ${askConfig.owner.toLowerCase()} - ${askConfig.outputToken.toLowerCase()}`;

      const query = `
          {
            order (id: "${orderId}") {
              inputTokenVault {
                id
              }
              outputTokenVault {
                id
              }
            }
          }
        `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.order;
      expect(data.inputTokenVault.id).to.be.equals(inputTokenVault_Id);
      expect(data.outputTokenVault.id).to.be.equals(outputTokenVault_Id);
    });
  });
});
