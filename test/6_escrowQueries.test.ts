/* eslint-disable @typescript-eslint/no-unused-vars */

import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractTransaction, Signer, BigNumber } from "ethers";
import { FetchResult } from "apollo-fetch";
import * as Util from "./utils/utils";
import { deploy, waitForSubgraphToBeSynced, Tier } from "./utils/utils";

import reserveToken from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveTokenTest.sol/ReserveTokenTest.json";
import readWriteTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ReadWriteTier.sol/ReadWriteTier.json";
import redeemableERC20ClaimEscrowJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/escrow/RedeemableERC20ClaimEscrow.sol/RedeemableERC20ClaimEscrow.json";
import bPoolFeeEscrowJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/escrow/BPoolFeeEscrow.sol/BPoolFeeEscrow.json";
import claimEscroWrapperJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/wrappers/RedeemableERC20ClaimEscrowWrapper.sol/RedeemableERC20ClaimEscrowWrapper.json";

import { ReserveTokenTest } from "@beehiveinnovation/rain-protocol/typechain/ReserveTokenTest";
import { ReadWriteTier } from "@beehiveinnovation/rain-protocol/typechain/ReadWriteTier";
import { RedeemableERC20ClaimEscrow } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20ClaimEscrow";
import { BPoolFeeEscrow } from "@beehiveinnovation/rain-protocol/typechain/BPoolFeeEscrow";
import { RedeemableERC20ClaimEscrowWrapper } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20ClaimEscrowWrapper";
import { Trust } from "@beehiveinnovation/rain-protocol/typechain/Trust";
import { RedeemableERC20 } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20";
import { ConfigurableRightsPool } from "@beehiveinnovation/rain-protocol/typechain/ConfigurableRightsPool";
import { BPool } from "@beehiveinnovation/rain-protocol/typechain/BPool";
import {
  // Subgraph
  subgraph,
  // Signers
  deployer,
  creator,
  seeder1,
  signer1,
  signer2,
  // Factories
  trustFactory,
  redeemableERC20ClaimEscrow as claimEscrow, // With a new name
} from "./1_trustQueries.test";

let claimableReserveToken: ReserveTokenTest,
  tier: ReadWriteTier,
  claimEscrowWrapper: RedeemableERC20ClaimEscrowWrapper,
  transaction: ContractTransaction; // use to save/facilite a tx;

let reserve: ReserveTokenTest,
  trust: Trust,
  crp: ConfigurableRightsPool,
  bPool: BPool,
  redeemableERC20: RedeemableERC20,
  minimumTradingDuration: number,
  minimumCreatorRaise: BigNumber,
  successLevel: BigNumber,
  startBlock: number;

// Aux
let trustAddress: string,
  claimEscrowAddress: string,
  claimableTokenAddress: string,
  depositor1: string,
  depositor2: string,
  zeroDecimals: string;

describe("Subgraph RedeemableERC20ClaimEscrow test", function () {
  before(async function () {
    // Same tier for all
    tier = (await deploy(readWriteTierJson, deployer, [])) as ReadWriteTier;
    await tier.setTier(signer1.address, Tier.FOUR, []);
    await tier.setTier(signer2.address, Tier.FOUR, []);

    // Fill to avoid long queries
    claimEscrowAddress = claimEscrow.address.toLowerCase();
    depositor1 = signer1.address.toLowerCase();
    depositor2 = signer2.address.toLowerCase();
  });

  it("should query RedeemableERC20ClaimEscrow correctly", async function () {
    const query = `
      {
        redeemableERC20ClaimEscrow (id: "${claimEscrow.address.toLowerCase()}") {
          address
        }
      }
    `;
    const response = (await subgraph({
      query: query,
    })) as FetchResult;

    const data = response.data.redeemableERC20ClaimEscrow;
    console.log("data : ", JSON.stringify(data));
    console.log(
      "redeemableERC20ClaimEscrow : ",
      claimEscrow.address.toLowerCase()
    );

    expect(data.address).to.equals(claimEscrow.address.toLowerCase());
  });

  describe("Escrow with succesfull Sale", function () {
    before("deploy fresh test contracts", async function () {
      // New reserve token
      claimableReserveToken = (await deploy(
        reserveToken,
        deployer,
        []
      )) as ReserveTokenTest;

      // Make a new ISale with a basic Setup
      ({
        reserve,
        trust,
        crp,
        bPool,
        redeemableERC20,
        minimumTradingDuration,
        minimumCreatorRaise,
        successLevel,
      } = await Util.basicSetup(
        deployer,
        creator,
        seeder1,
        trustFactory,
        tier
      ));

      startBlock = await ethers.provider.getBlockNumber();

      // Fill to avoid long queries
      trustAddress = trust.address.toLowerCase();
      claimableTokenAddress = claimableReserveToken.address.toLowerCase();
      zeroDecimals = "0".repeat(await claimableReserveToken.decimals());
    });

    it("should update the RedeemableERC20ClaimEscrow entity after a PendingDeposit", async function () {
      // Make a swap with the Util function
      const spend = ethers.BigNumber.from("200" + Util.sixZeros);
      await Util.swapReserveForTokens(
        crp,
        bPool,
        reserve,
        redeemableERC20,
        signer1,
        spend
      );

      // Deposit some claimable tokens
      const depositAmount = ethers.BigNumber.from("100" + zeroDecimals);
      await claimableReserveToken.transfer(signer1.address, depositAmount);

      await claimableReserveToken
        .connect(signer1)
        .approve(claimEscrow.address, depositAmount);

      // Depositing with signer1
      transaction = await claimEscrow
        .connect(signer1)
        .depositPending(
          trust.address,
          claimableReserveToken.address,
          depositAmount
        );

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(2000);

      const pendingDepositId = transaction.hash.toLowerCase();
      const pendingDepositorTokenId = `${trustAddress} - ${claimEscrowAddress} - ${depositor1} - ${claimableTokenAddress}`;
      const escrowDepositorId = `${claimEscrowAddress} - ${depositor1}`;

      const query = `
        {
          claimEscrow (id: "${claimEscrow.address.toLowerCase()}") {
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
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableERC20ClaimEscrow;

      expect(data.pendingDeposits).to.deep.include({ id: pendingDepositId });
      expect(data.pendingDepositorTokens).to.deep.include({
        id: pendingDepositorTokenId,
      });
      expect(data.depositors).to.deep.include({ id: escrowDepositorId });
    });

    it("should query the RedeemableEscrowPendingDeposit after a PendingDeposit", async function () {
      const { amount: deposited } = await Util.getEventArgs(
        transaction,
        "PendingDeposit",
        claimEscrow
      );

      const pendingDepositId = transaction.hash.toLowerCase();

      // PendingDeposit(msg.sender, sale_, redeemable_, token_, amount_);
      // PendingDeposit(signer1, trust, redeemableERC20, claimableReserveToken, deposited);
      const query = `
        {
          redeemableEscrowPendingDeposit (id: "${pendingDepositId}") {
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
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableERC20ClaimEscrow;
      //PendingDeposit(msg.sender, sale_, redeemable_, token_, amount_);
      //   event PendingDeposit(
      //     /// Anon `msg.sender` depositing the token.
      //     address sender,
      //     /// `Sale` contract deposit is under.
      //     address trust,
      //     /// Redeemable token that can claim this deposit.
      //     /// Implicitly snapshots the redeemable so malicious `Trust` cannot
      //     /// redirect funds later.
      //     address redeemable,
      //     /// `IERC20` token being deposited.
      //     address token,
      //     /// Amount of token deposited.
      //     uint256 amount
      // );

      // Prepare all to start to deposit claimable tokens
    });

    it("should query the RedeemableEscrowDepositor after a PendingDeposit");

    it(
      "should query the RedeemableEscrowPendingDepositorToken after a PendingDeposit"
    );

    it("should update the RedeemableERC20ClaimEscrow entity after a Deposit", async function () {
      // Make a swaps to raise all necessary funds
      const spend = ethers.BigNumber.from("200" + Util.sixZeros);
      while ((await reserve.balanceOf(bPool.address)).lt(successLevel)) {
        await Util.swapReserveForTokens(
          crp,
          bPool,
          reserve,
          redeemableERC20,
          signer1,
          spend
        );
      }

      // cover the dust amount
      const dustAtSuccessLevel = Util.determineReserveDust(successLevel).add(2); // rounding error
      await Util.swapReserveForTokens(
        crp,
        bPool,
        reserve,
        redeemableERC20,
        signer1,
        dustAtSuccessLevel
      );

      // create empty blocks to end of raise duration
      const beginEmptyBlocksBlock = await ethers.provider.getBlockNumber();
      const emptyBlocks =
        startBlock + minimumTradingDuration - beginEmptyBlocksBlock + 1;

      await Util.createEmptyBlock(emptyBlocks);

      await trust.endDutchAuction();

      transaction = await claimEscrow.sweepPending(
        trust.address,
        claimableReserveToken.address,
        signer1.address
      );
    });

    it("should update the RedeemableERC20ClaimEscrow entity after a Withdraw", async function () {
      const { supply } = await Util.getEventArgs(
        transaction,
        "Deposit",
        claimEscrow
      );
      const txWithdraw0 = await claimEscrow
        .connect(signer1)
        .withdraw(trust.address, claimableReserveToken.address, supply);
      const { amount: registeredWithdrawnAmountSigner1 } =
        await Util.getEventArgs(txWithdraw0, "Withdraw", claimEscrow);
    });
  });

  describe("Escrow with failed Sale", function () {
    before("deploy fresh test contracts", async function () {
      // New reserve token
      claimableReserveToken = (await deploy(
        reserveToken,
        deployer,
        []
      )) as ReserveTokenTest;

      // new basic Setup
      ({
        reserve,
        trust,
        crp,
        bPool,
        redeemableERC20,
        minimumTradingDuration,
        minimumCreatorRaise,
        successLevel,
      } = await Util.basicSetup(
        deployer,
        creator,
        seeder1,
        trustFactory,
        tier
      ));

      startBlock = await ethers.provider.getBlockNumber();

      // Fill to avoid long queries
      trustAddress = trust.address.toLowerCase();
      claimableTokenAddress = claimableReserveToken.address.toLowerCase();
      zeroDecimals = "0".repeat(await claimableReserveToken.decimals());
    });

    it("should update the RedeemableERC20ClaimEscrow entity after a Undeposit", async function () {
      // create empty blocks to end of raise duration
      const beginEmptyBlocksBlock = await ethers.provider.getBlockNumber();
      const emptyBlocks =
        startBlock + minimumTradingDuration - beginEmptyBlocksBlock + 1;

      // create empty blocks to end of raise duration
      await Util.createEmptyBlock(emptyBlocks);

      // end now to make a status failed
      await trust.endDutchAuction();

      const supply = await redeemableERC20.totalSupply();
      const depositAmount1 = ethers.BigNumber.from("100" + zeroDecimals);
      await claimableReserveToken.transfer(signer1.address, depositAmount1);
      await claimableReserveToken
        .connect(signer1)
        .approve(claimEscrow.address, depositAmount1);

      // can deposit and undeposit when fail
      await claimEscrow
        .connect(signer1)
        .deposit(trust.address, claimableReserveToken.address, depositAmount1);

      await claimEscrow
        .connect(signer1)
        .undeposit(
          trust.address,
          claimableReserveToken.address,
          supply,
          depositAmount1
        );
    });
  });
});
