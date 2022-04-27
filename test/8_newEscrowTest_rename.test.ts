import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { FetchResult } from "apollo-fetch";
import * as Util from "./utils/utils";
import { concat } from "ethers/lib/utils";

import {
  getEventArgs,
  waitForSubgraphToBeSynced,
  Tier,
  LEVELS,
  SaleStatus,
} from "./utils/utils";

// Typechain Factories
import { ReserveTokenTest__factory } from "../typechain/factories/ReserveTokenTest__factory";
import { RedeemableERC20__factory } from "../typechain/factories/RedeemableERC20__factory";

// Types
import type { ReserveTokenTest } from "../typechain/ReserveTokenTest";
import type { ERC20BalanceTier } from "../typechain/ERC20BalanceTier";
import type { Sale, BuyConfigStruct as BuyConfig } from "../typechain/Sale";
import type { RedeemableERC20 } from "../typechain/RedeemableERC20";

import type {
  DepositEvent,
  PendingDepositEvent,
  UndepositEvent,
  WithdrawEvent,
} from "../typechain/RedeemableERC20ClaimEscrow";

import type { BuyEvent } from "../typechain/Sale";

import {
  // Subgraph
  subgraph,
  // Signers
  deployer,
  creator,
  signer1,
  signer2,
  seeder1 as signer3,
  recipient,
  feeRecipient,
  // Factories
  saleFactory,
  redeemableERC20Factory,
  redeemableERC20ClaimEscrow as escrow,
  erc20BalanceTierFactory,
  noticeBoard,
} from "./1_trustQueries.test";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractTransaction, Signer } from "ethers";

let claimableReserve: ReserveTokenTest,
  saleReserve: ReserveTokenTest,
  reserveTier: ReserveTokenTest,
  sale: Sale,
  tier: ERC20BalanceTier,
  redeemableERC20: RedeemableERC20;

let escrowAddress: string,
  claimableReserveAddress: string,
  saleAddress: string,
  redeemableAddress: string,
  signer1Address: string,
  signer2Address: string,
  signer3Address: string;

// TODO: Remove old test after finish this

/**
 * Deploy a sale with prederminated values and setup to the env to avoid code repetition
 *
 * @param tokenReceiver -  the signer that will received and have approve to escrow all their tokens
 */
const deploySale = async (
  tokenReceiver: SignerWithAddress,
  divToken = 2
): Promise<{
  sale: Sale;
  redeemableERC20: RedeemableERC20;
  saleReserve: ReserveTokenTest;
}> => {
  const saleReserve = await new ReserveTokenTest__factory(deployer).deploy();

  const startBlock = await ethers.provider.getBlockNumber();
  const saleTimeout = 30;

  const minimumRaise = ethers.BigNumber.from("50000").mul(Util.RESERVE_ONE);
  const totalTokenSupply = ethers.BigNumber.from("2000").mul(Util.ONE);
  const redeemableERC20Config = {
    name: "Token",
    symbol: "TKN",
    distributor: Util.zeroAddress,
    initialSupply: totalTokenSupply,
  };
  const staticPrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);

  const constants = [staticPrice];
  const vBasePrice = Util.op(Util.OpcodeSale.VAL, 0);

  const sources = [concat([vBasePrice])];

  const sale = await Util.saleDeploy(
    saleFactory,
    creator,
    {
      canStartStateConfig: Util.afterBlockNumberConfig(startBlock),
      canEndStateConfig: Util.afterBlockNumberConfig(startBlock + saleTimeout),
      calculatePriceStateConfig: {
        sources,
        constants,
        stackLength: 1,
        argumentsLength: 0,
      },
      recipient: recipient.address,
      reserve: saleReserve.address,
      cooldownDuration: 1,
      minimumRaise: minimumRaise,
      dustSize: 0,
    },
    {
      erc20Config: redeemableERC20Config,
      tier: tier.address,
      minimumTier: Tier.ZERO,
      distributionEndForwardingAddress: Util.zeroAddress,
    }
  );

  const redeemableERC20 = new RedeemableERC20__factory(deployer).attach(
    await Util.getChild(redeemableERC20Factory, sale.deployTransaction)
  );

  // Save new addresses
  saleAddress = sale.address.toLowerCase();
  redeemableAddress = redeemableERC20.address.toLowerCase();

  // Sending tokens to the default signer and approve to the sale
  const amount = (await saleReserve.totalSupply()).div(divToken);
  await saleReserve.transfer(tokenReceiver.address, amount);
  await saleReserve.connect(tokenReceiver).approve(sale.address, amount);

  return { sale, redeemableERC20, saleReserve };
};

/**
 * Pass a already started sale and finish it
 */
const finishSale = async (_sale: Sale): Promise<void> => {
  if ((await _sale.saleStatus()) === SaleStatus.ACTIVE) {
    while (!(await _sale.canEnd())) {
      await Util.createEmptyBlock();
    }
    await _sale.end();
  }
};

/**
 * Make a buy with in `_sale`
 * @param _sale - the sale used to buy
 * @param buyer - the signer that will buy
 * @param buyConfig - (optional) An buy configuration. If not provided, will buy with a predeterminated config
 */
const buySale = async (
  _sale: Sale,
  buyer: Signer,
  buyConfig: BuyConfig = null
): Promise<ContractTransaction> => {
  if (!buyConfig) {
    const desiredUnits = 100;
    const fee = 10;
    buyConfig = {
      feeRecipient: feeRecipient.address,
      fee: fee,
      minimumUnits: desiredUnits,
      desiredUnits: desiredUnits,
      maximumPrice: (await sale.calculatePrice(desiredUnits)).add(100),
    };
  }

  return await _sale.connect(buyer).buy(buyConfig);
};

describe("Subgraph RedeemableERC20ClaimEscrow test", function () {
  before("deploy general contracts", async function () {
    // Deploying tokens
    claimableReserve = await new ReserveTokenTest__factory(deployer).deploy();
    reserveTier = await new ReserveTokenTest__factory(deployer).deploy();

    // Deploying a tier
    tier = await Util.erc20BalanceTierDeploy(erc20BalanceTierFactory, creator, {
      erc20: reserveTier.address,
      tierValues: LEVELS,
    });

    // Providing to signers a lot of tokens to avoid sending everytime
    const amount = (await claimableReserve.totalSupply()).div(3);
    await claimableReserve.transfer(signer1.address, amount);
    await claimableReserve.transfer(signer2.address, amount);
    await claimableReserve.transfer(signer3.address, amount);

    // Approve the escrow to use the respective all tokens from signers
    await claimableReserve.connect(signer1).approve(escrow.address, amount);
    await claimableReserve.connect(signer2).approve(escrow.address, amount);
    await claimableReserve.connect(signer3).approve(escrow.address, amount);

    // Save to reduce long lines
    claimableReserveAddress = claimableReserve.address.toLowerCase();
    escrowAddress = escrow.address.toLowerCase();
    signer1Address = signer1.address.toLowerCase();
    signer2Address = signer2.address.toLowerCase();
    signer3Address = signer3.address.toLowerCase();
  });

  describe("RedeemableERC20ClaimEscrow entity", function () {
    beforeEach("deploying fresh sale", async function () {
      // In each `it` statement will have a fresh sale, redeemable and saleReserve
      ({ sale, redeemableERC20 } = await deploySale(signer1));
    });

    it("should update RedeemableERC20ClaimEscrow after a PendingDeposit", async function () {
      const tx = await escrow
        .connect(signer1)
        .depositPending(sale.address, claimableReserve.address, 1000);

      await waitForSubgraphToBeSynced();

      // IDs
      const pendingDepositId = tx.hash.toLowerCase();
      const pendingDepositorTokenId = `${saleAddress} - ${escrowAddress} - ${signer1Address} - ${claimableReserveAddress}`;
      const escrowDepositorId = `${escrowAddress} - ${signer1Address}`;

      const query = `
        {
          redeemableERC20ClaimEscrow (id: "${escrowAddress}") {
            pendingDeposits {
              id
            }
            pendingDepositorTokens {
              id
            }
            depositors {
              id
            }
          }
        }
      `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableERC20ClaimEscrow;

      expect(data.pendingDeposits).to.deep.include(
        { id: pendingDepositId },
        `pendingDeposits response does not include ID "${pendingDepositId}"`
      );

      expect(data.pendingDepositorTokens).to.deep.include(
        { id: pendingDepositorTokenId },
        `pendingDepositorTokens response does not include ID "${pendingDepositorTokenId}"`
      );

      expect(data.depositors).to.deep.include(
        { id: escrowDepositorId },
        `depositors response does not include ID "${escrowDepositorId}"`
      );
    });

    it("should update RedeemableERC20ClaimEscrow after a Deposit", async function () {
      // Start sale
      await sale.start();

      // Make a buy to have Redeemable
      await buySale(sale, signer1);

      // Finish the sale
      await finishSale(sale);

      // Make deposit
      const tx = await escrow
        .connect(signer1)
        .deposit(sale.address, claimableReserve.address, 1000);

      const { supply } = (await getEventArgs(
        tx,
        "Deposit",
        escrow
      )) as DepositEvent["args"];

      await waitForSubgraphToBeSynced();

      // IDs
      const escrowDeposit = tx.hash.toLowerCase();
      const escrowDepositorId = `${escrowAddress} - ${signer1Address}`;
      const escrowSupplyTokenDepositId = `${saleAddress} - ${escrowAddress} - ${supply} - ${claimableReserveAddress}`;
      const escrowSupplyTokenDepositorId = `${saleAddress} - ${escrowAddress} - ${supply} - ${claimableReserveAddress} - ${signer1Address}`;

      const query = `
        {
          redeemableERC20ClaimEscrow (id: "${escrowAddress}") {
            deposits {
              id
            }
            depositors {
              id
            }
            supplyTokenDeposits {
              id
            }
            supplyTokenDepositors {
              id
            }
          }
        }
      `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableERC20ClaimEscrow;

      expect(data.deposits).to.deep.include({ id: escrowDeposit });
      expect(data.depositors).to.deep.include({ id: escrowDepositorId });

      expect(data.supplyTokenDeposits).to.deep.include({
        id: escrowSupplyTokenDepositId,
      });
      expect(data.supplyTokenDepositors).to.deep.include({
        id: escrowSupplyTokenDepositorId,
      });
    });

    it("should update RedeemableERC20ClaimEscrow after a Undeposit", async function () {
      // Start sale
      await sale.start();

      // Make a buy of all Redeemable

      await buySale(sale, signer1);

      // Finish the sale as failed since does not reach the minimum raise
      await finishSale(sale);
      assert((await sale.saleStatus()) === SaleStatus.FAIL);

      // Make deposit
      const txDeposit = await escrow
        .connect(signer1)
        .deposit(saleAddress, claimableReserveAddress, 1000);

      const { supply, amount } = (await getEventArgs(
        txDeposit,
        "Deposit",
        escrow
      )) as DepositEvent["args"];

      const txUndeposit = await escrow
        .connect(signer1)
        .undeposit(saleAddress, claimableReserveAddress, supply, amount);

      await waitForSubgraphToBeSynced();

      // IDs
      const escrowUndepositId = txUndeposit.hash.toLowerCase();

      const query = `
          {
            redeemableERC20ClaimEscrow (id: "${escrowAddress}") {
              undeposits {
                id
              }
            }
          }
        `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableERC20ClaimEscrow;

      expect(data.undeposits).to.deep.include({ id: escrowUndepositId });
    });

    it("should update RedeemableERC20ClaimEscrow after a Withdraw", async function () {
      // Start sale
      await sale.start();

      // Make a buy of all Redeemable
      const desiredUnits = await redeemableERC20.totalSupply();
      const fee = 10;
      const buyConfig = {
        feeRecipient: feeRecipient.address,
        fee: fee,
        minimumUnits: desiredUnits,
        desiredUnits: desiredUnits,
        maximumPrice: (await sale.calculatePrice(desiredUnits)).add(100),
      };

      await buySale(sale, signer1, buyConfig);

      // Finish the sale as Succes since reach the minimum raise
      await finishSale(sale);
      assert((await sale.saleStatus()) === SaleStatus.SUCCESS);

      // Make deposit
      const txDeposit = await escrow
        .connect(signer1)
        .deposit(saleAddress, claimableReserveAddress, 1000);

      const { supply } = (await getEventArgs(
        txDeposit,
        "Deposit",
        escrow
      )) as DepositEvent["args"];

      const txWithdraw = await escrow
        .connect(signer1)
        .withdraw(saleAddress, claimableReserveAddress, supply);

      await waitForSubgraphToBeSynced();

      // IDs
      const escrowWithdrawId = txWithdraw.hash.toLowerCase();
      const escrowSupplyTokenWithdrawerId = `${saleAddress} - ${escrowAddress} - ${supply} - ${claimableReserveAddress} - ${signer1Address}`;
      const escrowWithdrawerId = `${escrowAddress} - ${signer1Address}`;

      const query = `
          {
            redeemableERC20ClaimEscrow (id: "${escrowAddress}") {
              withdraws {
                id
              }
              supplyTokenWithdrawers {
                id
              }
              withdrawers {
                id
              }
            }
          }
        `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableERC20ClaimEscrow;

      expect(data.withdraws).to.deep.include({ id: escrowWithdrawId });
      expect(data.withdrawers).to.deep.include({ id: escrowWithdrawerId });
      expect(data.supplyTokenWithdrawers).to.deep.include({
        id: escrowSupplyTokenWithdrawerId,
      });
    });

    it("should update RedeemableERC20ClaimEscrow after a Notice", async function () {
      const dataToSend = "0x01";
      const notices = [
        {
          subject: escrow.address,
          data: dataToSend,
        },
      ];

      const tx = await noticeBoard.connect(signer2).createNotices(notices);

      const noticeId = `${escrowAddress} - ${tx.hash.toLowerCase()} - 0`;
      await waitForSubgraphToBeSynced();

      const query = `
        {
          redeemableERC20ClaimEscrow (id: "${escrowAddress}") {
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
      const dataEscrow = queryResponse.data.redeemableERC20ClaimEscrow.notices;
      const dataNotice = queryResponse.data.notice;

      expect(dataEscrow).deep.include({ id: noticeId });

      expect(dataNotice.sender).to.equals(signer2Address);
      expect(dataNotice.subject.id).to.equals(escrowAddress);
      expect(dataNotice.data).to.equals(dataToSend);
    });
  });

  describe("RedeemableEscrowDepositor entity", function () {
    beforeEach("deploying fresh sale", async function () {
      // In each `it` statement will have a fresh sale, redeemable and saleReserve
      ({ sale } = await deploySale(signer2));
    });

    it("should update RedeemableEscrowDepositor after a PendingDeposit", async function () {
      const tx = await escrow
        .connect(signer2)
        .depositPending(sale.address, claimableReserve.address, 1000);

      await waitForSubgraphToBeSynced();

      // IDs
      const pendingDepositId = tx.hash.toLowerCase();
      const escrowDepositorId = `${escrowAddress} - ${signer2Address}`;
      const pendingDepositorTokenId = `${saleAddress} - ${escrowAddress} - ${signer2Address} - ${claimableReserveAddress}`;

      const query = `
          {
            redeemableEscrowDepositor (id: "${escrowDepositorId}") {
              address
              pendingDepositorTokens {
                id
              }
              pendingDeposits {
                id
              }
            }
          }
        `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowDepositor;

      expect(data.address).to.be.equals(signer2Address);
      expect(data.pendingDeposits).to.deep.include({ id: pendingDepositId });
      expect(data.pendingDepositorTokens).to.deep.include({
        id: pendingDepositorTokenId,
      });
    });

    it("should update RedeemableEscrowDepositor after a Deposit", async function () {
      // Start sale
      await sale.start();

      // Make a buy to have Redeemable
      await buySale(sale, signer2);

      // Finish the sale
      await finishSale(sale);

      // Make deposit
      const txDeposit = await escrow
        .connect(signer2)
        .deposit(sale.address, claimableReserve.address, 1000);

      const { supply } = (await getEventArgs(
        txDeposit,
        "Deposit",
        escrow
      )) as DepositEvent["args"];

      await waitForSubgraphToBeSynced();

      // IDs
      const escrowDeposit = txDeposit.hash.toLowerCase();
      const escrowDepositorId = `${escrowAddress} - ${signer2Address}`;
      const escrowSupplyTokenDepositId = `${saleAddress} - ${escrowAddress} - ${supply} - ${claimableReserveAddress}`;

      const query = `
        {
          redeemableEscrowDepositor (id: "${escrowDepositorId}") {
            supplyTokenDeposits {
              id
            }
            deposits {
              id
            }
          }
        }
      `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowDepositor;

      expect(data.deposits).to.deep.include({ id: escrowDeposit });
      expect(data.supplyTokenDeposits).to.deep.include({
        id: escrowSupplyTokenDepositId,
      });
    });

    it("should update RedeemableEscrowDepositor after a Undeposit", async function () {
      // Start sale
      await sale.start();

      // Make a buy of all Redeemable

      await buySale(sale, signer2);

      // Finish the sale as failed since does not reach the minimum raise
      await finishSale(sale);
      assert((await sale.saleStatus()) === SaleStatus.FAIL);

      // Make deposit
      const txDeposit = await escrow
        .connect(signer2)
        .deposit(saleAddress, claimableReserveAddress, 1000);

      const { supply, amount } = (await getEventArgs(
        txDeposit,
        "Deposit",
        escrow
      )) as DepositEvent["args"];

      const txUndeposit = await escrow
        .connect(signer2)
        .undeposit(saleAddress, claimableReserveAddress, supply, amount);

      await waitForSubgraphToBeSynced();

      // IDs
      const escrowUndepositId = txUndeposit.hash.toLowerCase();
      const escrowDepositorId = `${escrowAddress} - ${signer2Address}`;

      const query = `
          {
            redeemableEscrowDepositor (id: "${escrowDepositorId}") {
              undeposits {
                id
              }
            }
          }
        `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowDepositor;

      expect(data.undeposits).to.deep.include({ id: escrowUndepositId });
    });
  });

  describe("RedeemableEscrowPendingDepositorToken entity", function () {
    beforeEach("deploying fresh sale", async function () {
      // In each `it` statement will have a fresh sale, redeemable and saleReserve
      ({ sale, redeemableERC20 } = await deploySale(signer1));
    });

    it("should query RedeemableEscrowPendingDepositorToken after PendingDeposits correctly", async function () {
      // Make two depositPending
      const txDepositPending1 = await escrow
        .connect(signer1)
        .depositPending(sale.address, claimableReserve.address, 1000);

      const txDepositPending2 = await escrow
        .connect(signer1)
        .depositPending(sale.address, claimableReserve.address, 2500);

      const { amount: amount1 } = (await getEventArgs(
        txDepositPending1,
        "PendingDeposit",
        escrow
      )) as PendingDepositEvent["args"];

      const { amount: amount2 } = (await getEventArgs(
        txDepositPending2,
        "PendingDeposit",
        escrow
      )) as PendingDepositEvent["args"];

      await waitForSubgraphToBeSynced();

      // queries
      const totalDepositedExpected = amount1.add(amount2);
      const pendingDepositId_1 = txDepositPending1.hash.toLowerCase();
      const pendingDepositId_2 = txDepositPending2.hash.toLowerCase();
      const escrowDepositorId = `${escrowAddress} - ${signer1Address}`;
      const pendingDepositorTokenId = `${saleAddress} - ${escrowAddress} - ${signer1Address} - ${claimableReserveAddress}`;

      const query = `
        {
          redeemableEscrowPendingDepositorToken (id: "${pendingDepositorTokenId}") {
            iSale {
              saleStatus
            }
            iSaleAddress
            escrow {
              id
            }
            escrowAddress
            depositor {
              id
            }
            depositorAddress
            pendingDeposits {
              id
            }
            token {
              id
            }
            tokenAddress
            totalDeposited
            swept
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowPendingDepositorToken;

      expect(data.iSale.saleStatus).to.be.equals(await sale.saleStatus());
      expect(data.iSaleAddress).to.be.equals(saleAddress);

      expect(data.escrow.id).to.be.equals(escrowAddress);
      expect(data.escrowAddress).to.be.equals(escrowAddress);

      expect(data.depositor.id).to.be.equals(escrowDepositorId);
      expect(data.depositorAddress).to.be.equals(signer1Address);

      expect(data.pendingDeposits).to.deep.include({ id: pendingDepositId_1 });
      expect(data.pendingDeposits).to.deep.include({ id: pendingDepositId_2 });

      expect(data.token.id).to.be.equals(claimableReserveAddress);
      expect(data.tokenAddress).to.be.equals(claimableReserveAddress);

      expect(data.totalDeposited).to.be.equals(totalDepositedExpected);
      expect(data.swept, `no sweep pending was made`).to.be.false;
    });

    it("should update RedeemableEscrowPendingDepositorToken after a SweepPending", async function () {
      const txDepositPending = await escrow
        .connect(signer1)
        .depositPending(sale.address, claimableReserve.address, 1000);

      const { amount } = (await getEventArgs(
        txDepositPending,
        "PendingDeposit",
        escrow
      )) as PendingDepositEvent["args"];

      // Finishing the sale
      await sale.start();
      await finishSale(sale);

      // Call sweepPending
      await escrow
        .connect(signer1)
        .sweepPending(saleAddress, claimableReserveAddress, signer1Address);

      await waitForSubgraphToBeSynced();

      // IDs
      const pendingDepositorTokenId = `${saleAddress} - ${escrowAddress} - ${signer1Address} - ${claimableReserveAddress}`;

      const query = `
        {
          redeemableEscrowPendingDepositorToken (id: "${pendingDepositorTokenId}") {
            iSale {
              saleStatus
            }
            totalDeposited
            swept
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.redeemableEscrowPendingDepositorToken;

      expect(data.iSale.saleStatus).to.be.equals(await sale.saleStatus());
      expect(data.totalDeposited).to.be.equals(amount);
      expect(data.swept, `swap pending was already called`).to.be.true;
    });
  });

  describe("RedeemableEscrowPendingDeposit entity", function () {
    it("should query RedeemableEscrowPendingDeposit after a PendingDeposit", async function () {
      // This will have a fresh sale, redeemable and saleReserve
      ({ sale } = await deploySale(signer1));

      const txDepositPending = await escrow
        .connect(signer1)
        .depositPending(sale.address, claimableReserve.address, 1000);

      const { amount } = (await getEventArgs(
        txDepositPending,
        "PendingDeposit",
        escrow
      )) as PendingDepositEvent["args"];

      await waitForSubgraphToBeSynced();

      // IDs
      const pendingDepositId = txDepositPending.hash.toLowerCase();
      const escrowDepositorId = `${escrowAddress} - ${signer1Address}`;

      const query = `
        {
          redeemableEscrowPendingDeposit (id: "${pendingDepositId}") {
            depositor {
              id
            }
            depositorAddress
            escrow {
              id
            }
            escrowAddress
            iSale {
              saleStatus
            }
            iSaleAddress
            redeemable {
              id
            }
            token {
              id
            }
            tokenAddress
            amount
          }
        }
      `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowPendingDeposit;

      expect(data.depositor.id).to.be.equals(escrowDepositorId);
      expect(data.depositorAddress).to.be.equals(signer1Address);

      expect(data.escrow.id).to.be.equals(escrowAddress);
      expect(data.escrowAddress).to.be.equals(escrowAddress);

      expect(data.redeemable.id).to.be.equals(redeemableAddress);
      expect(data.token.id).to.be.equals(claimableReserveAddress);
      expect(data.tokenAddress).to.be.equals(claimableReserveAddress);
      expect(data.amount).to.be.equals(amount);

      expect(data.iSaleAddress).to.be.equals(saleAddress);
      expect(data.iSale.saleStatus).to.be.equals(await sale.saleStatus());
    });
  });

  describe("RedeemableEscrowDeposit entity", function () {
    it("should update RedeemableEscrowDeposit after a Deposit", async function () {
      // This will have a fresh sale, redeemable and saleReserve
      ({ sale } = await deploySale(signer1));

      await sale.start();

      // Make a buy to have Redeemable
      await buySale(sale, signer1);

      // Finish the sale
      await finishSale(sale);

      // Make deposit
      const txDeposit = await escrow
        .connect(signer1)
        .deposit(sale.address, claimableReserve.address, 1000);

      const { amount, supply } = (await getEventArgs(
        txDeposit,
        "Deposit",
        escrow
      )) as DepositEvent["args"];

      await waitForSubgraphToBeSynced();

      // IDs
      const escrowDeposit = txDeposit.hash.toLowerCase();
      const escrowDepositorId = `${escrowAddress} - ${signer1Address}`;

      const query = `
        {
          redeemableEscrowDeposit (id: "${escrowDeposit}") {
            depositor {
              id
            }
            depositorAddress
            escrow {
              id
            }
            escrowAddress
            iSale {
              saleStatus
            }
            iSaleAddress
            token {
              id
            }
            tokenAddress
            tokenAmount
            redeemable {
              id
            }
            redeemableSupply
          }
        }
      `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowDeposit;

      expect(data.depositor.id).to.be.equals(escrowDepositorId);
      expect(data.depositorAddress).to.be.equals(signer1Address);

      expect(data.escrow.id).to.be.equals(escrowAddress);
      expect(data.escrowAddress).to.be.equals(escrowAddress);

      expect(data.iSaleAddress).to.be.equals(saleAddress);
      expect(data.iSale.saleStatus).to.be.equals(await sale.saleStatus());

      expect(data.token.id).to.be.equals(claimableReserveAddress);
      expect(data.tokenAddress).to.be.equals(claimableReserveAddress);
      expect(data.tokenAmount).to.be.equals(amount);

      expect(data.redeemable.id).to.be.equals(redeemableAddress);
      expect(data.redeemableSupply).to.be.equals(supply);
    });
  });

  describe("RedeemableEscrowUndeposit entity", function () {
    it("should update RedeemableEscrowUndeposit after a Undeposit", async function () {
      // This will have a fresh sale, redeemable and saleReserve
      ({ sale } = await deploySale(signer1));

      // Start sale
      await sale.start();

      // Make a buy
      await buySale(sale, signer1);

      // Finish the sale as failed since does not reach the minimum raise
      await finishSale(sale);
      assert((await sale.saleStatus()) === SaleStatus.FAIL);

      // Make deposit
      const txDeposit = await escrow
        .connect(signer1)
        .deposit(saleAddress, claimableReserveAddress, 1000);

      const { supply, amount } = (await getEventArgs(
        txDeposit,
        "Deposit",
        escrow
      )) as DepositEvent["args"];

      const txUndeposit = await escrow
        .connect(signer1)
        .undeposit(saleAddress, claimableReserveAddress, supply, amount);

      const { supply: undepositSupply, amount: undepositAmount } =
        (await getEventArgs(
          txUndeposit,
          "Undeposit",
          escrow
        )) as UndepositEvent["args"];

      await waitForSubgraphToBeSynced();

      // IDs
      const escrowUndepositId = txUndeposit.hash.toLowerCase();

      const query = `
        {
          redeemableEscrowUndeposit (id: "${escrowUndepositId}") {
            sender
            escrow {
              id
            }
            escrowAddress
            iSale {
              saleStatus
            }
            iSaleAddress
            token {
              id
            }
            tokenAddress
            redeemableSupply
            tokenAmount
          }
        }
      `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowUndeposit;

      expect(data.sender).to.be.equals(signer1Address);

      expect(data.escrow.id).to.be.equals(escrowAddress);
      expect(data.escrowAddress).to.be.equals(escrowAddress);

      expect(data.iSale.saleStatus).to.be.equals(await sale.saleStatus());
      expect(data.iSaleAddress).to.be.equals(saleAddress);

      expect(data.token.id).to.be.equals(claimableReserveAddress);
      expect(data.tokenAddress).to.be.equals(claimableReserveAddress);

      expect(data.tokenAmount).to.be.equals(undepositAmount);
      expect(data.redeemableSupply).to.be.equals(undepositSupply);
    });
  });

  describe("RedeemableEscrowWithdraw entity", function () {
    it("should update RedeemableEscrowWithdraw after a Withdraw", async function () {
      // This will have a fresh sale, redeemable and saleReserve
      ({ sale, redeemableERC20 } = await deploySale(signer1));

      // Start sale
      await sale.start();

      // Make a buy of all Redeemable
      const desiredUnits = await redeemableERC20.totalSupply();
      const fee = 10;
      const buyConfig = {
        feeRecipient: feeRecipient.address,
        fee: fee,
        minimumUnits: desiredUnits,
        desiredUnits: desiredUnits,
        maximumPrice: (await sale.calculatePrice(desiredUnits)).add(100),
      };

      await buySale(sale, signer1, buyConfig);

      // Finish the sale as failed since does not reach the minimum raise
      await finishSale(sale);
      assert((await sale.saleStatus()) === SaleStatus.SUCCESS);

      // Make deposit
      const txDeposit = await escrow
        .connect(signer1)
        .deposit(saleAddress, claimableReserveAddress, 1000);

      const { supply } = (await getEventArgs(
        txDeposit,
        "Deposit",
        escrow
      )) as DepositEvent["args"];

      const txWithdraw = await escrow
        .connect(signer1)
        .withdraw(saleAddress, claimableReserveAddress, supply);

      const { supply: withdrawSupply, amount: withdrawAmount } =
        (await getEventArgs(
          txWithdraw,
          "Withdraw",
          escrow
        )) as WithdrawEvent["args"];

      await waitForSubgraphToBeSynced();

      // IDs
      const escrowWithdrawId = txWithdraw.hash.toLowerCase();

      const query = `
          {
            redeemableEscrowWithdraw (id: "${escrowWithdrawId}") {
              withdrawer
              escrow {
                id
              }
              escrowAddress
              iSale {
                saleStatus
              }
              iSaleAddress
              redeemable {
                id
              }
              token {
                id
              }
              tokenAddress
              redeemableSupply
              tokenAmount
            }
          }
        `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowWithdraw;

      expect(data.withdrawer).to.be.equals(signer1Address);
      expect(data.escrow.id).to.be.equals(escrowAddress);
      expect(data.escrowAddress).to.be.equals(escrowAddress);

      expect(data.iSale.saleStatus).to.be.equals(await sale.saleStatus());
      expect(data.iSaleAddress).to.be.equals(saleAddress);

      expect(data.redeemable.id).to.be.equals(redeemableAddress);
      expect(data.token.id).to.be.equals(claimableReserveAddress);

      expect(data.redeemableSupply).to.be.equals(withdrawSupply);
      expect(data.tokenAmount).to.be.equals(withdrawAmount);
    });
  });

  describe("RedeemableEscrowWithdrawer entity", function () {
    it("should update RedeemableEscrowWithdrawer after withdraw", async function () {
      ({ sale, redeemableERC20 } = await deploySale(signer2));
      // Start sale
      await sale.start();

      // Make a buy of all Redeemable
      const desiredUnits = await redeemableERC20.totalSupply();
      const fee = 10;
      const buyConfig = {
        feeRecipient: feeRecipient.address,
        fee: fee,
        minimumUnits: desiredUnits,
        desiredUnits: desiredUnits,
        maximumPrice: (await sale.calculatePrice(desiredUnits)).add(100),
      };

      await buySale(sale, signer2, buyConfig);

      // Finish the sale as failed since does not reach the minimum raise
      await finishSale(sale);
      assert((await sale.saleStatus()) === SaleStatus.SUCCESS);

      // Make deposit
      const txDeposit = await escrow
        .connect(signer2)
        .deposit(saleAddress, claimableReserveAddress, 2000);

      const { supply } = (await getEventArgs(
        txDeposit,
        "Deposit",
        escrow
      )) as DepositEvent["args"];

      const txWithdraw = await escrow
        .connect(signer2)
        .withdraw(saleAddress, claimableReserveAddress, supply);

      await waitForSubgraphToBeSynced();

      // IDs
      const escrowWithdrawId = txWithdraw.hash.toLowerCase();
      const escrowWithdrawerId = `${escrowAddress} - ${signer2Address}`;

      const query = `
          {
            redeemableEscrowWithdrawer (id: "${escrowWithdrawerId}") {
              address
              escrow {
                id
              }
              escrowAddress
              withdraws {
                id
              }
            }
          }
        `;
      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowWithdrawer;

      expect(data.address).to.be.equals(signer2Address);
      expect(data.escrow.id).to.be.equals(escrowAddress);
      expect(data.escrowAddress).to.be.equals(escrowAddress);
      expect(data.withdraws).to.deep.include({ id: escrowWithdrawId });
    });
  });

  describe("RedeemableEscrowSupplyTokenWithdrawer entity", function () {
    beforeEach("deploying fresh sale", async function () {
      // In each `it` statement will have a fresh sale, redeemable and saleReserve
      ({ sale, redeemableERC20, saleReserve } = await deploySale(signer1, 3));
      const amount = (await saleReserve.totalSupply()).div(3);

      await saleReserve.transfer(signer2Address, amount);
      await saleReserve.transfer(signer3Address, amount);
      await saleReserve.connect(signer2).approve(sale.address, amount);
      await saleReserve.connect(signer3).approve(sale.address, amount);
      await sale.start();
    });

    it("should update the RedeemableEscrowSupplyTokenWithdrawer after a single withdraw", async function () {
      // Make a buy of all Redeemable
      const desiredUnits = (await redeemableERC20.totalSupply()).div(3);
      const fee = 10;
      const buyConfig = {
        feeRecipient: feeRecipient.address,
        fee: fee,
        minimumUnits: desiredUnits,
        desiredUnits: desiredUnits,
        maximumPrice: (await sale.calculatePrice(desiredUnits)).mul(2),
      };

      // TODO: Check why still failing the sale
      await buySale(sale, signer1, buyConfig);
      await buySale(sale, signer2, buyConfig);

      while ((await sale.saleStatus()) == SaleStatus.ACTIVE) {
        console.log(await sale.saleStatus());
        buyConfig.desiredUnits = await redeemableERC20.totalSupply();
        await buySale(sale, signer3, buyConfig);
      }

      // Finish the sale as failed since does not reach the minimum raise
      await finishSale(sale);
      assert((await sale.saleStatus()) === SaleStatus.SUCCESS);

      // Make deposit
      const txDeposit = await escrow
        .connect(signer1)
        .deposit(saleAddress, claimableReserveAddress, 2000);

      const { supply: depositSupply } = (await getEventArgs(
        txDeposit,
        "Deposit",
        escrow
      )) as DepositEvent["args"];

      const txDeposit2 = await escrow
        .connect(signer2)
        .deposit(saleAddress, claimableReserveAddress, 2000);

      const txDeposit3 = await escrow
        .connect(signer3)
        .deposit(saleAddress, claimableReserveAddress, 2000);

      const txWithdraw = await escrow
        .connect(signer1)
        .withdraw(saleAddress, claimableReserveAddress, depositSupply);

      const { supply: withdrawSupply } = (await getEventArgs(
        txWithdraw,
        "Withdraw",
        escrow
      )) as WithdrawEvent["args"];

      assert(depositSupply.toString() === withdrawSupply.toString());

      const txWithdraw2 = await escrow
        .connect(signer1)
        .withdraw(saleAddress, claimableReserveAddress, depositSupply);

      // await waitForSubgraphToBeSynced();

      const escrowSupplyTokenDepositId = `${saleAddress} - ${escrowAddress} - ${depositSupply} - ${claimableReserveAddress}`;
      const escrowSupplyTokenWithdrawerId = `${saleAddress} - ${escrowAddress} - ${withdrawSupply} - ${claimableReserveAddress} - ${signer2Address}`;

      const query = `
        {
          redeemableEscrowSupplyTokenWithdrawer (id: "${escrowSupplyTokenWithdrawerId}") {
            deposit {
              id
            }
            withdrawerAddress
            redeemableBalance
            withdraws: [RedeemableEscrowWithdraw!] #all Withdraw events for this withdrawer, for the linked RedeemableEscrowSupplyTokenDeposit
            "Total amount withdrawn by withdrawer"
            totalWithdrawn: BigInt! #increased by Withdraw.amount with every Withdraw event that matches the id {sale}-{escrow}-{supply}-{token}-{withdrawer}
            "Amount against which RedeemableEscrowWithdraw emits"
            totalWithdrawnAgainst: BigInt!
            "Amount claimable by withdrawer"
            claimable: BigInt! # (redeemable.balanceOf(withdrawer) * RedeemableEscrowSupplyTokenDeposit.perRedeemable) - totalWithdrawn
          }
        }
      `;
      // const response = (await subgraph({
      //   query,
      // })) as FetchResult;
      // const data = response.data.redeemableEscrowSupplyTokenWithdrawer;
    });
  });

  describe("RedeemableEscrowSupplyTokenDeposit entity", async function () {
    // ...
  });
  describe("RedeemableEscrowSupplyTokenDepositorentity", async function () {
    // ...
  });
  describe("UnknownSale entity", async function () {
    // ...
  });
});
