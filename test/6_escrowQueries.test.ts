/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { expect, assert } from "chai";
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
const enum SaleStatus {
  Pending,
  Active,
  Success,
  Fail,
}

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
  redeemableAddress: string,
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

    await waitForSubgraphToBeSynced();
  });

  describe("Escrow with succesfull Sale", function () {
    let totalDeposited = ethers.BigNumber.from("0");

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
      redeemableAddress = redeemableERC20.address.toLowerCase();
      zeroDecimals = "0".repeat(await claimableReserveToken.decimals());

      await waitForSubgraphToBeSynced();
    });

    it("should update the RedeemableERC20ClaimEscrow entity after a PendingDeposit", async function () {
      // Make a swap with signer1 the Util function
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

      await waitForSubgraphToBeSynced();

      const pendingDepositId = transaction.hash.toLowerCase();
      const pendingDepositorTokenId = `${trustAddress} - ${claimEscrowAddress} - ${depositor1} - ${claimableTokenAddress}`;
      const escrowDepositorId = `${claimEscrowAddress} - ${depositor1}`;

      const query = `
        {
          redeemableERC20ClaimEscrow (id: "${claimEscrowAddress}") {
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

    it("should query the ERC20 token that was used in PendingDeposit", async function () {
      const query = `
        {
          erc20 (id: "${claimableTokenAddress}") {
            name
            symbol
            decimals
            totalSupply
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.erc20;

      expect(data.name).to.equals(await claimableReserveToken.name());
      expect(data.symbol).to.equals(await claimableReserveToken.symbol());
      expect(data.decimals).to.equals(await claimableReserveToken.decimals());
      expect(data.totalSupply).to.equals(
        await claimableReserveToken.totalSupply()
      );
    });

    it("should query the RedeemableEscrowPendingDeposit after a PendingDeposit", async function () {
      const { amount: deposited } = await Util.getEventArgs(
        transaction,
        "PendingDeposit",
        claimEscrow
      );

      const pendingDepositId = transaction.hash.toLowerCase();
      const escrowDepositorId = `${claimEscrowAddress} - ${depositor1}`;

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
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowPendingDeposit;

      // Depositor expected values
      expect(data.depositor.id).to.equals(
        escrowDepositorId,
        `depositor ID in response is NOT "${escrowDepositorId}"`
      );
      expect(data.depositorAddress).to.equals(
        depositor1,
        `depositor address in response is NOT ${depositor1}`
      );

      // Escrow expected values
      expect(data.escrow.id).to.equals(
        claimEscrowAddress,
        `escrow ID in response is NOT "${claimEscrowAddress}"`
      );
      expect(data.escrowAddress).to.equals(
        claimEscrowAddress,
        `escrow address in response is NOT "${claimEscrowAddress}"`
      );

      // Sale expected values
      expect(data.iSale.saleStatus).to.equals(
        SaleStatus.Pending,
        `wrong sale status in redeemableEscrowPendingDeposit`
      );
      expect(data.iSaleAddress).to.equals(
        trustAddress,
        `trust address in response is NOT "${trustAddress}"`
      );

      // Tokens expected values
      expect(data.redeemable.id).to.equals(
        redeemableAddress,
        `redeemable address in response is NOT "${redeemableAddress}"`
      );
      expect(data.token.id).to.equals(
        claimableTokenAddress,
        `token ID in response is NOT "${claimableTokenAddress}"`
      );
      expect(data.tokenAddress).to.equals(
        claimableTokenAddress,
        `token address in response is NOT "${claimableTokenAddress}"`
      );
      expect(data.amount).to.equals(
        deposited,
        `deposit amount in response is NOT "${deposited}"`
      );
    });

    it("should query the RedeemableEscrowDepositor after a PendingDeposit", async function () {
      const pendingDepositId = transaction.hash.toLowerCase();
      const pendingDepositorTokenId = `${trustAddress} - ${claimEscrowAddress} - ${depositor1} - ${claimableTokenAddress}`;
      const escrowDepositorId = `${claimEscrowAddress} - ${depositor1}`;

      const query = `
        {
          redeemableEscrowDepositor (id: "${escrowDepositorId}") {
            address
            supplyTokenDeposits {
              id
            }
            deposits {
              id
            }
            pendingDepositorTokens {
              id
            }
            pendingDeposits {
              id
            }
            undeposits {
              id
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowDepositor;

      expect(data.address).to.equals(
        depositor1,
        `wrong address in redeemableEscrowDepositor. It was expected ${depositor1}`
      );

      // Deposits
      expect(data.supplyTokenDeposits, `no deposit yet`).to.be.empty;
      expect(data.deposits, `no deposit yet`).to.be.empty;

      // Undeposits
      expect(data.undeposits, `no undeposit yet`).to.be.empty;

      // Pending deposits
      expect(data.pendingDepositorTokens).to.deep.include(
        { id: pendingDepositorTokenId },
        `pendingDepositorTokens response does not include "${pendingDepositorTokenId}"`
      );
      expect(data.pendingDeposits).to.deep.include(
        { id: pendingDepositId },
        `pendingDeposits response does not include ${pendingDepositId}`
      );
    });

    it("should query the RedeemableEscrowPendingDepositorToken after a PendingDeposit", async function () {
      const { amount: deposited } = await Util.getEventArgs(
        transaction,
        "PendingDeposit",
        claimEscrow
      );
      const pendingDepositId = transaction.hash.toLowerCase();
      const pendingDepositorTokenId = `${trustAddress} - ${claimEscrowAddress} - ${depositor1} - ${claimableTokenAddress}`;
      const escrowDepositorId = `${claimEscrowAddress} - ${depositor1}`;

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
        query: query,
      })) as FetchResult;

      const data = response.data.redeemableEscrowPendingDepositorToken;

      // Sale expected response
      expect(data.iSale.saleStatus).to.equals(
        SaleStatus.Pending,
        `wrong sale status`
      );
      expect(data.iSaleAddress).to.equals(
        trustAddress,
        `wrong sale address. Expected ${trustAddress}`
      );

      // Escrow expected response
      expect(data.escrow.id).to.equals(
        claimEscrowAddress,
        `wrong escrow ID. Expected ${claimEscrowAddress}`
      );
      expect(data.escrowAddress).to.equals(
        claimEscrowAddress,
        `wrong escrow address. Expected ${claimEscrowAddress}`
      );

      // Depositor expected response
      expect(data.depositor.id).to.equals(
        escrowDepositorId,
        `wrong escrow depositor ID. Expected ${escrowDepositorId}`
      );
      expect(data.depositorAddress).to.equals(
        depositor1,
        `wrong escrow depositor address. Expected ${depositor1}`
      );
      expect(data.pendingDeposits).to.deep.include(
        { id: pendingDepositId },
        `pendingDeposits response does NOT include the pendingDepositId "${pendingDepositId}"`
      );

      // Token relate expected response
      expect(data.token.id).to.equals(
        claimableTokenAddress,
        `wrong ERC20 token ID. Expected ${claimableTokenAddress}`
      );
      expect(data.tokenAddress).to.equals(
        claimableTokenAddress,
        `wrong ERC20 token address. Expected ${claimableTokenAddress}`
      );

      expect(data.totalDeposited).to.equals(
        deposited,
        `wrong amount in response
        expected  ${deposited.toString()}
        got       ${data.totalDeposited}`
      );

      expect(data.swept, `depositor has not made SweepPending`).to.be.false;
    });

    it("should update the RedeemableERC20ClaimEscrow entity after a Deposit", async function () {
      // Make swaps to raise all necessary funds and get a ISale finished with signer2
      const spend = ethers.BigNumber.from("200" + Util.sixZeros);
      while ((await reserve.balanceOf(bPool.address)).lt(successLevel)) {
        await Util.swapReserveForTokens(
          crp,
          bPool,
          reserve,
          redeemableERC20,
          signer2,
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
        signer2,
        dustAtSuccessLevel
      );

      // create empty blocks to end of raise duration
      const beginEmptyBlocksBlock = await ethers.provider.getBlockNumber();
      const emptyBlocks =
        startBlock + minimumTradingDuration - beginEmptyBlocksBlock + 1;

      await Util.createEmptyBlock(emptyBlocks);

      await trust.endDutchAuction();

      // Make a deposit with same signer1
      const depositAmount = ethers.BigNumber.from("100" + zeroDecimals);
      await claimableReserveToken.transfer(signer1.address, depositAmount);
      await claimableReserveToken
        .connect(signer1)
        .approve(claimEscrow.address, depositAmount);

      // Deposit with same signer that made a depositPending
      transaction = await claimEscrow
        .connect(signer1)
        .deposit(trust.address, claimableReserveToken.address, depositAmount);

      totalDeposited = totalDeposited.add(depositAmount);

      await waitForSubgraphToBeSynced();

      const { supply: redeemableSupply } = await Util.getEventArgs(
        transaction,
        "Deposit",
        claimEscrow
      );
      assert(
        (await redeemableERC20.totalSupply()).eq(redeemableSupply),
        `wrong total supply`
      );

      const depositId = transaction.hash.toLowerCase();
      const escrowSupplyTokenDepositId = `${trustAddress} - ${claimEscrowAddress} - ${redeemableSupply} - ${claimableTokenAddress}`;

      const query = `
        {
          redeemableERC20ClaimEscrow (id: "${claimEscrowAddress}") {
            deposits {
              id
            }
            supplyTokenDeposits {
              id
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableERC20ClaimEscrow;

      expect(data.deposits).deep.include(
        { id: depositId },
        `redeemableERC20ClaimEscrow does not include the deposit ID "${depositId}"`
      );
      expect(data.supplyTokenDeposits).deep.include(
        { id: escrowSupplyTokenDepositId },
        `redeemableERC20ClaimEscrow does not include the supplyTokenDeposit ID "${escrowSupplyTokenDepositId}"`
      );
    });

    it("should update the RedeemableEscrowDepositor after a Deposit", async function () {
      const { supply: redeemableSupply } = await Util.getEventArgs(
        transaction,
        "Deposit",
        claimEscrow
      );
      assert(
        (await redeemableERC20.totalSupply()).eq(redeemableSupply),
        `wrong total supply`
      );

      const escrowSupplyTokenDepositId = `${trustAddress} - ${claimEscrowAddress} - ${redeemableSupply} - ${claimableTokenAddress}`;
      const depositId = transaction.hash.toLowerCase();

      const escrowDepositorId = `${claimEscrowAddress} - ${depositor1}`;

      const query = `
        {
          redeemableEscrowDepositor (id: "${escrowDepositorId}") {
            address
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
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowDepositor;

      expect(data.address).to.equals(
        depositor1,
        `wrong address in redeemableEscrowDepositor. It was expected ${depositor1}`
      );

      // Deposits
      expect(data.supplyTokenDeposits).to.deep.include(
        { id: escrowSupplyTokenDepositId },
        `supplyTokenDeposits response does not include "${escrowSupplyTokenDepositId}"`
      );
      expect(data.deposits).to.deep.include(
        { id: depositId },
        `deposits response does not include ${depositId}`
      );
    });

    it("should query the RedeemableEscrowDeposit after a Deposit", async function () {
      const { amount: deposited, supply: redeemableSupply } =
        await Util.getEventArgs(transaction, "Deposit", claimEscrow);

      assert(
        (await redeemableERC20.totalSupply()).eq(redeemableSupply),
        `wrong total supply`
      );

      const escrowDepositorId = `${claimEscrowAddress} - ${depositor1}`;
      const depositId = transaction.hash.toLowerCase();

      const query = `
        {
          redeemableEscrowDeposit (id: "${depositId}") {
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
            redeemableSupply
            tokenAmount
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowDeposit;

      expect(data.depositor.id).to.equals(
        escrowDepositorId,
        `wrong depositor entity.  Should be user that made deposit pending
        expected  ${escrowDepositorId}
        got       ${data.depositor.id}`
      );
      expect(data.depositorAddress).to.equals(
        depositor1,
        `wrong depositor address. Should be user that made deposit pending
        expected  ${depositor1}
        got       ${data.depositorAddress}`
      );

      expect(data.escrow.id).to.equals(
        claimEscrowAddress,
        `wrong redeemableERC20ClaimEscrow entity`
      );
      expect(data.escrowAddress).to.equals(
        claimEscrowAddress,
        `wrong redeemableERC20ClaimEscrow address`
      );

      expect(data.iSale.saleStatus).to.equals(
        SaleStatus.Success,
        `wrong sale status -  the Sale is succesful
        expected  ${SaleStatus.Success}
        got       ${data.iSale.saleStatus}`
      );
      expect(data.iSaleAddress).to.equals(trustAddress, `wrong Sale address`);

      expect(data.redeemable.id).to.equals(
        redeemableAddress,
        `wrong redeemable entity`
      );
      expect(data.token.id).to.equals(
        claimableTokenAddress,
        `wrong erc20 token entity`
      );
      expect(data.tokenAddress).to.equals(
        claimableTokenAddress,
        `wrong erc20 token address`
      );

      expect(data.redeemableSupply).to.equals(
        redeemableSupply.toString(),
        `wrong redeemable supply - should be the same as when the deposit was made
        expected  ${redeemableSupply}
        got       ${data.redeemableSupply}`
      );
      expect(data.tokenAmount).to.equals(
        deposited.toString(),
        `wrong token amount deposited
        expected  ${deposited}
        got       ${data.tokenAmount}`
      );
    });

    it("should query the RedeemableEscrowSupplyTokenDeposit after a Deposit", async function () {
      const depositId = transaction.hash.toLowerCase();

      const { supply: redeemableSupply } = await Util.getEventArgs(
        transaction,
        "Deposit",
        claimEscrow
      );

      assert(
        (await redeemableERC20.totalSupply()).eq(redeemableSupply),
        `wrong total supply`
      );

      const escrowDepositorId = `${claimEscrowAddress} - ${depositor1}`;
      const escrowSupplyTokenDepositId = `${trustAddress} - ${claimEscrowAddress} - ${redeemableSupply} - ${claimableTokenAddress}`;

      const query = `
        {
          redeemableEscrowSupplyTokenDeposit (id: "${escrowSupplyTokenDepositId}") {
            iSale {
              saleStatus
            }
            iSaleAddress
            escrow {
              id
            }
            escrowAddress
            deposits {
              id
            }
            depositors {
              id
            }
            depositorAddress
            token {
              id
            }
            tokenAddress
            redeemableSupply
            totalDeposited
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowSupplyTokenDeposit;

      expect(data.iSale.saleStatus).to.equals(
        SaleStatus.Success,
        `wrong sale status -  the Sale is succesful
        expected  ${SaleStatus.Success}
        got       ${data.iSale.saleStatus}`
      );
      expect(data.iSaleAddress).to.equals(trustAddress, `wrong Sale address`);

      expect(data.escrow.id).to.equals(
        claimEscrowAddress,
        `wrong redeemableERC20ClaimEscrow entity`
      );
      expect(data.escrowAddress).to.equals(
        claimEscrowAddress,
        `wrong redeemableERC20ClaimEscrow address`
      );

      expect(data.deposits).deep.include(
        { id: depositId },
        `redeemableEscrowSupplyTokenDeposit does not include deposit ID ${depositId}`
      );

      expect(data.depositors).deep.include(
        { id: escrowDepositorId },
        `redeemableEscrowSupplyTokenDeposit does not include the depositor entity ID ${escrowDepositorId}`
      );
      expect(data.depositorAddress).deep.include(
        depositor1,
        `redeemableEscrowSupplyTokenDeposit does not include the depositor addres ${depositor1}`
      );

      expect(data.token.id).to.equals(
        claimableTokenAddress,
        `redeemableEscrowSupplyTokenDeposit does not include the correct token: ${claimableTokenAddress}`
      );
      expect(data.tokenAddress).to.equals(
        claimableTokenAddress,
        `wrong tokenAddress in entity. Expected ${claimableTokenAddress} `
      );

      expect(data.redeemableSupply).to.equals(
        redeemableSupply.toString(),
        `wrong redeemableSupply
        expected  ${redeemableSupply}
        got       ${data.redeemableSupply}`
      );
      expect(data.totalDeposited).to.equals(
        totalDeposited.toString(),
        `wrong totalDeposit amount
        expected  ${totalDeposited}
        got       ${data.totalDeposited}`
      );
    });

    it("should not update the swept of a RedeemableEscrowPendingDepositorToken after Deposit from same user", async function () {
      const pendingDepositorTokenId = `${trustAddress} - ${claimEscrowAddress} - ${depositor1} - ${claimableTokenAddress}`;

      const query = `
        {
          redeemableEscrowPendingDepositorToken (id: "${pendingDepositorTokenId}") {
            swept
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowPendingDepositorToken;

      expect(data.swept, `sweepPending has not been called`).to.be.false;
    });

    it("should update the RedeemableERC20ClaimEscrow entity after a SweepPending", async function () {
      // Different signer that who made the depositPending
      transaction = await claimEscrow
        .connect(signer2)
        .sweepPending(
          trust.address,
          claimableReserveToken.address,
          signer1.address
        );

      const { amount: deposited } = await Util.getEventArgs(
        transaction,
        "Deposit",
        claimEscrow
      );

      totalDeposited = totalDeposited.add(deposited);

      await waitForSubgraphToBeSynced();

      const depositId = transaction.hash.toLowerCase();

      const query = `
        {
          redeemableERC20ClaimEscrow (id: "${claimEscrowAddress}") {
            deposits {
              id
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableERC20ClaimEscrow;

      expect(data.deposits).to.deep.include(
        { id: depositId },
        `deposit response does not include the ID "${depositId}"`
      );
    });

    it("should update the swept in RedeemableEscrowPendingDepositorToken after a SweepPending", async function () {
      const pendingDepositorTokenId = `${trustAddress} - ${claimEscrowAddress} - ${depositor1} - ${claimableTokenAddress}`;

      const query = `
        {
          redeemableEscrowPendingDepositorToken (id: "${pendingDepositorTokenId}") {
            swept
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowPendingDepositorToken;

      expect(data.swept, `swept has not been updated after sweep`).to.be.true;
    });

    it("should update the RedeemableEscrowDepositor after a SweepPending", async function () {
      const { supply: redeemableSupply } = await Util.getEventArgs(
        transaction,
        "Deposit",
        claimEscrow
      );

      assert(
        (await redeemableERC20.totalSupply()).eq(redeemableSupply),
        `wrong total supply`
      );

      const depositId = transaction.hash.toLowerCase();
      const escrowDepositorId = `${claimEscrowAddress} - ${depositor1}`;

      const escrowSupplyTokenDepositId = `${trustAddress} - ${claimEscrowAddress} - ${redeemableSupply} - ${claimableTokenAddress}`;

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
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowDepositor;

      expect(data.supplyTokenDeposits).deep.include(
        { id: escrowSupplyTokenDepositId },
        `redeemableEscrowDepositor does not include the supplyTokenDeposit ID "${escrowSupplyTokenDepositId}"`
      );
      expect(data.deposits).deep.include(
        { id: depositId },
        `redeemableEscrowDepositor does not include the deposit ID "${depositId}"`
      );
    });

    it("should query the RedeemableEscrowDeposit after a SweepPending", async function () {
      const { amount: deposited, supply: redeemableSupply } =
        await Util.getEventArgs(transaction, "Deposit", claimEscrow);

      assert(
        (await redeemableERC20.totalSupply()).eq(redeemableSupply),
        `wrong total supply`
      );

      const depositId = transaction.hash.toLowerCase();
      const escrowDepositorId = `${claimEscrowAddress} - ${depositor1}`;

      const query = `
        {
          redeemableEscrowDeposit (id: "${depositId}") {
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
            redeemableSupply
            tokenAmount
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowDeposit;

      expect(data.depositor.id).to.equals(
        escrowDepositorId,
        `wrong depositor entity.  Should be user that made deposit pending
        expected  ${escrowDepositorId}
        got       ${data.depositor.id}`
      );
      expect(data.depositorAddress).to.equals(
        depositor1,
        `wrong depositor address. Should be user that made deposit pending
        expected  ${depositor1}
        got       ${data.depositorAddress}`
      );

      expect(data.escrow.id).to.equals(
        claimEscrowAddress,
        `wrong redeemableERC20ClaimEscrow entity`
      );
      expect(data.escrowAddress).to.equals(
        claimEscrowAddress,
        `wrong redeemableERC20ClaimEscrow address`
      );

      expect(data.iSale.saleStatus).to.equals(
        SaleStatus.Success,
        `wrong sale status -  the Sale is succesful
        expected  ${SaleStatus.Success}
        got       ${data.iSale.saleStatus}`
      );
      expect(data.iSaleAddress).to.equals(trustAddress, `wrong Sale address`);

      expect(data.redeemable.id).to.equals(
        redeemableAddress,
        `wrong redeemable entity`
      );
      expect(data.token.id).to.equals(
        claimableTokenAddress,
        `wrong erc20 token entity`
      );
      expect(data.tokenAddress).to.equals(
        claimableTokenAddress,
        `wrong erc20 token address`
      );

      expect(data.redeemableSupply).to.equals(
        redeemableSupply.toString(),
        `wrong redeemable supply - should be the same as when the deposit was made
        expected  ${data.redeemableSupply}
        got       ${redeemableSupply}`
      );
      expect(data.tokenAmount).to.equals(
        deposited,
        `wrong token amount deposited
        expected  ${deposited}
        got       ${data.tokenAmount}`
      );
    });

    it("should update  the RedeemableEscrowSupplyTokenDeposit after a SweepPending", async function () {
      const { supply: redeemableSupply } = await Util.getEventArgs(
        transaction,
        "Deposit",
        claimEscrow
      );

      assert(
        (await redeemableERC20.totalSupply()).eq(redeemableSupply),
        `wrong total supply`
      );

      const depositId = transaction.hash.toLowerCase();
      const escrowSupplyTokenDepositId = `${trustAddress} - ${claimEscrowAddress} - ${redeemableSupply} - ${claimableTokenAddress}`;

      const query = `
        {
          redeemableEscrowSupplyTokenDeposit (id: "${escrowSupplyTokenDepositId}") {
            deposits {
              id
            }
            totalDeposited
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowSupplyTokenDeposit;

      expect(data.deposits).deep.include(
        { id: depositId },
        `redeemableEscrowSupplyTokenDeposit does not include deposit ID ${depositId}`
      );

      expect(data.totalDeposited).to.equals(
        totalDeposited.toString(),
        `wrong totalDeposit amount
        expected  ${totalDeposited}
        got       ${data.totalDeposited}`
      );
    });

    it("should update the RedeemableERC20ClaimEscrow entity after a Withdraw", async function () {
      const { supply: redeemableSupply, amount: amountWithdrawn } =
        await Util.getEventArgs(transaction, "Deposit", claimEscrow);

      assert(
        (await redeemableERC20.totalSupply()).eq(redeemableSupply),
        `wrong total supply`
      );

      transaction = await claimEscrow
        .connect(signer1)
        .withdraw(
          trust.address,
          claimableReserveToken.address,
          redeemableSupply
        );

      const { amount: Withdrawn } = await Util.getEventArgs(transaction, "Withdraw", claimEscrow);

      totalDeposited = totalDeposited.sub(Withdrawn);

      await waitForSubgraphToBeSynced();

      const withdrawId = transaction.hash.toLowerCase();
      const escrowWithdrawerId = `${claimEscrowAddress} - ${depositor1}`;

      const query = `
        {
          redeemableERC20ClaimEscrow (id: "${claimEscrowAddress}") {
            withdraws {
              id
            }
            withdrawers {
              id
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableERC20ClaimEscrow;

      expect(data.withdraws).deep.include(
        { id: withdrawId },
        `redeemableERC20ClaimEscrow does include the withdraw with ID "${withdrawId}"`
      );
      expect(data.withdrawers).deep.include(
        { id: escrowWithdrawerId },
        `redeemableERC20ClaimEscrow does include the withdrawer with ID "${escrowWithdrawerId}"`
      );
    });

    it("should query the RedeemableEscrowWithdraw after a Withdraw", async function () {
      const { amount: amountWithdrawn, supply: redeemableSupply } =
        await Util.getEventArgs(transaction, "Withdraw", claimEscrow);

      assert(
        (await redeemableERC20.totalSupply()).eq(redeemableSupply),
        `wrong total supply`
      );

      const withdrawId = transaction.hash.toLowerCase();

      const query = `
        {
          redeemableEscrowWithdraw (id: "${withdrawId}") {
            withdrawer
            escrow {
              id
            }
            escrowAddress
            iSaleAddress
            iSale {
              saleStatus
            }
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
        query: query,
      })) as FetchResult;

      const data = response.data.redeemableEscrowWithdraw;

      expect(data.withdrawer).to.equals(
        depositor1,
        `wrong withdrawer in redeemableEscrowWithdraw
        expected  ${depositor1}
        got       ${data.withdrawer}`
      );

      expect(data.escrow.id).to.equals(
        claimEscrowAddress,
        `wrong RedeemableERC20ClaimEscrow entity. Should be "${claimEscrowAddress}"`
      );
      expect(data.escrowAddress).to.equals(
        claimEscrowAddress,
        `wrong RedeemableERC20ClaimEscrow address. Should be "${claimEscrowAddress}"`
      );

      expect(data.iSale.saleStatus).to.equals(
        SaleStatus.Success,
        `wrong sale status
        expected  ${SaleStatus.Success}
        got       ${data.iSale.saleStatus}`
      );
      expect(data.iSaleAddress).to.equals(
        trustAddress,
        `wrong sale address
        expected  ${trustAddress}
        got       ${data.iSaleAddress}`
      );

      expect(data.redeemable.id).to.equals(
        redeemableAddress,
        `wrong redeemable address
        expected  ${redeemableAddress}
        got       ${data.redeemable.id}`
      );

      expect(data.token.id).to.equals(
        claimableTokenAddress,
        `wrong token address
        expected  ${claimableTokenAddress}
        got       ${data.token.id}`
      );
      expect(data.tokenAddress).to.equals(
        claimableTokenAddress,
        `wrong token address
        expected  ${claimableTokenAddress}
        got       ${data.tokenAddress}`
      );

      expect(data.redeemableSupply).to.equals(
        redeemableSupply,
        `wrong redeemableSupply in withdraw entity
        expected  ${redeemableSupply.toString()}
        got       ${data.redeemableSupply}`
      );

      expect(data.tokenAmount).to.equals(
        amountWithdrawn.toString(),
        `wrong tokenAmount out in withdraw entity
        expected  ${amountWithdrawn}
        got       ${data.tokenAmount}`
      );
    });

    it("should update the RedeemableEscrowWithdrawer after Withdraw", async function () {
      const withdrawId = transaction.hash.toLowerCase();
      const escrowWithdrawerId = `${claimEscrowAddress} - ${depositor1}`;

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
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowWithdrawer;

      expect(data.address).to.equals(
        depositor1,
        `wrong redeemableEscrowWithdrawer address. Should be "${depositor1}"`
      );

      expect(data.escrow.id).to.equals(
        claimEscrowAddress,
        `wrong RedeemableERC20ClaimEscrow entity. Should be "${claimEscrowAddress}"`
      );
      expect(data.escrowAddress).to.equals(
        claimEscrowAddress,
        `wrong RedeemableERC20ClaimEscrow address. Should be "${claimEscrowAddress}"`
      );

      expect(data.withdraws).deep.include(
        { id: withdrawId },
        `RedeemableEscrowWithdrawer does not include the withdraw with ID withdrawId`
      );
    });

    it("should decreased the totalDeposited in RedeemableEscrowSupplyTokenDeposit after a Withdraw", async function () {
      const { supply: redeemableSupply } = await Util.getEventArgs(
        transaction,
        "Withdraw",
        claimEscrow
      );

      assert(
        (await redeemableERC20.totalSupply()).eq(redeemableSupply),
        `wrong total supply`
      );

      const depositId = transaction.hash.toLowerCase();
      const escrowSupplyTokenDepositId = `${trustAddress} - ${claimEscrowAddress} - ${redeemableSupply} - ${claimableTokenAddress}`;

      const query = `
        {
          redeemableEscrowSupplyTokenDeposit (id: "${escrowSupplyTokenDepositId}") {
            totalDeposited
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowSupplyTokenDeposit;

      expect(data.totalDeposited).to.equals(
        totalDeposited.toString(),
        `wrong totalDeposit amount
        expected  ${totalDeposited}
        got       ${data.totalDeposited}`
      );
    });

    it("should query different RedeemableEscrowSupplyTokenDeposits with different tokens and supplies", async function () {
      // New claimable reserve token
      const claimableReserveToken2 = (await deploy(
        reserveToken,
        deployer,
        []
      )) as ReserveTokenTest;

      // Providing some claimableReserveToken2 to signer2
      const depositAmount1 = ethers.BigNumber.from("100" + zeroDecimals);
      await claimableReserveToken2.transfer(signer2.address, depositAmount1);

      await claimableReserveToken2
        .connect(signer2)
        .approve(claimEscrow.address, depositAmount1);

      // Deposit with signer2 the claimableReserveToken2
      const transaction1 = await claimEscrow
        .connect(signer2)
        .deposit(trust.address, claimableReserveToken2.address, depositAmount1);

      // ❗❗❗ NOW with different supply ❗❗❗❗

      // Singer 2 burn/redeem some Redeemable tokens used in the Sale
      const redeemAmount = (
        await redeemableERC20.balanceOf(signer2.address)
      ).div(2);

      // signer1 burns their RedeemableERC20 token balance for some reserve
      await reserve.transfer(redeemableERC20.address, "1" + Util.sixZeros);
      await redeemableERC20
        .connect(signer2)
        .redeem([reserve.address], redeemAmount);

      // Providing more claimableReserveToken2 to signer2
      const depositAmount2 = ethers.BigNumber.from("100" + zeroDecimals);
      await claimableReserveToken2.transfer(signer2.address, depositAmount2);

      await claimableReserveToken2
        .connect(signer2)
        .approve(claimEscrow.address, depositAmount2);

      // Deposit again with same signer2 and token but less redeemableSupply
      const transaction2 = await claimEscrow
        .connect(signer2)
        .deposit(trust.address, claimableReserveToken2.address, depositAmount2);

      await waitForSubgraphToBeSynced();

      const escrowDepositorId = `${claimEscrowAddress} - ${depositor2}`;
      const claimableToken2 = claimableReserveToken2.address.toLowerCase();

      // Using transactions to get the supply in that moment
      const { supply: supply1 } = await Util.getEventArgs(
        transaction1,
        "Deposit",
        claimEscrow
      );

      const { supply: supply2 } = await Util.getEventArgs(
        transaction2,
        "Deposit",
        claimEscrow
      );

      const escrowSupplyTokenDeposit_1 = `${trustAddress} - ${claimEscrowAddress} - ${supply1} - ${claimableToken2}`;
      const escrowSupplyTokenDeposit_2 = `${trustAddress} - ${claimEscrowAddress} - ${supply2} - ${claimableToken2}`;

      const depositId_1 = transaction1.hash.toLowerCase();
      const depositId_2 = transaction2.hash.toLowerCase();

      const query = `
        {
          redeemableERC20ClaimEscrow (id: "${claimEscrowAddress}") {
            supplyTokenDeposits {
              id
            }
          }
          redeemableEscrowDepositor (id: "${escrowDepositorId}"){
            supplyTokenDeposits {
              id
            }
          }
          supplyTokenDeposit_1: redeemableEscrowSupplyTokenDeposit (id: "${escrowSupplyTokenDeposit_1}") {
            deposits {
              id
            }
            tokenAddress
            redeemableSupply
          }
          supplyTokenDeposit_2: redeemableEscrowSupplyTokenDeposit (id: "${escrowSupplyTokenDeposit_2}") {
            deposits {
              id
            }
            tokenAddress
            redeemableSupply
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataClaimEscrow =
        response.data.redeemableERC20ClaimEscrow.supplyTokenDeposits;
      const dataDepositor =
        response.data.redeemableEscrowDepositor.supplyTokenDeposits;

      const supplyTokenDeposit_1 = response.data.supplyTokenDeposit_1;
      const supplyTokenDeposit_2 = response.data.supplyTokenDeposit_2;

      // RedeemableERC20ClaimEscrow
      expect(dataClaimEscrow).deep.include(
        { id: escrowSupplyTokenDeposit_1 },
        `response does NOT include the supplyTokenDeposit with ID "${escrowSupplyTokenDeposit_1}"`
      );
      expect(dataClaimEscrow).deep.include(
        { id: escrowSupplyTokenDeposit_2 },
        `response does NOT include the supplyTokenDeposit with ID "${escrowSupplyTokenDeposit_2}"`
      );

      // RedeemableEscrowDepositor
      expect(dataDepositor).deep.include(
        { id: escrowSupplyTokenDeposit_1 },
        `response does NOT include the escrow depositor with ID ${escrowSupplyTokenDeposit_1}`
      );
      expect(dataDepositor).deep.include(
        { id: escrowSupplyTokenDeposit_2 },
        `response does NOT include the escrow depositor with ID ${escrowSupplyTokenDeposit_2}`
      );

      // escrowSupplyTokenDeposit_1
      expect(supplyTokenDeposit_1.deposits).deep.include(
        { id: depositId_1 },
        `response does NOT include deposit with ID "${depositId_1}"`
      );
      expect(supplyTokenDeposit_1.tokenAddress).to.equals(
        claimableToken2,
        `wrong token address`
      );
      expect(supplyTokenDeposit_1.redeemableSupply).to.equals(
        supply1.toString(),
        `wrong supply
        expected  ${supply1}
        got       ${supplyTokenDeposit_1.redeemableSupply}`
      );

      // escrowSupplyTokenDeposit_2
      expect(supplyTokenDeposit_2.deposits).deep.include(
        { id: depositId_2 },
        `response does NOT include deposit with ID "${depositId_2}"`
      );
      expect(supplyTokenDeposit_2.tokenAddress).to.equals(
        claimableToken2,
        `wrong token address`
      );
      expect(supplyTokenDeposit_2.redeemableSupply).to.equals(
        supply2.toString(),
        `wrong supply
        expected  ${supply2}
        got       ${supplyTokenDeposit_2.redeemableSupply}`
      );
    });
  });

  describe("Escrow with failed Sale", function () {
    let totalDeposited = ethers.BigNumber.from("0");

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

      await waitForSubgraphToBeSynced();
    });

    it("should query RedeemableEscrowSupplyTokenDeposit after deposit normally", async function () {
      // create empty blocks to force end of raise duration
      const beginEmptyBlocksBlock = await ethers.provider.getBlockNumber();
      const emptyBlocks =
        startBlock + minimumTradingDuration - beginEmptyBlocksBlock + 1;

      // create empty blocks to end of raise duration
      await Util.createEmptyBlock(emptyBlocks);

      // end now to make a status failed
      await trust.endDutchAuction();

      // Make a deposit
      const depositAmount = ethers.BigNumber.from("100" + zeroDecimals);
      await claimableReserveToken.transfer(signer1.address, depositAmount);
      await claimableReserveToken
        .connect(signer1)
        .approve(claimEscrow.address, depositAmount);

      // can deposit and undeposit when fail
      transaction = await claimEscrow
        .connect(signer1)
        .deposit(trust.address, claimableReserveToken.address, depositAmount);

      totalDeposited = totalDeposited.add(depositAmount);

      // Waiting for sync
      await waitForSubgraphToBeSynced();

      const { supply: redeemableSupply } = await Util.getEventArgs(
        transaction,
        "Deposit",
        claimEscrow
      );

      const depositId = transaction.hash.toLowerCase();

      const supplyTokenDepositId = `${trustAddress} - ${claimEscrowAddress} - ${redeemableSupply} - ${claimableTokenAddress}`;

      const query = `
        {
          redeemableEscrowSupplyTokenDeposit (id: "${supplyTokenDepositId}"){
            deposits {
              id
            }
            totalDeposited
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowSupplyTokenDeposit;

      expect(data.deposits).deep.include({ id: depositId });
      expect(data.totalDeposited).to.equals(totalDeposited.toString());
    });

    it("should update the RedeemableERC20ClaimEscrow entity after a Undeposit", async function () {
      const { amount: deposited, supply: redeemableSupply } =
        await Util.getEventArgs(transaction, "Deposit", claimEscrow);

      const undepositAmount = ethers.BigNumber.from(deposited).div(2);

      transaction = await claimEscrow
        .connect(signer1)
        .undeposit(
          trust.address,
          claimableReserveToken.address,
          redeemableSupply,
          undepositAmount
        );

      totalDeposited = totalDeposited.sub(undepositAmount);

      await waitForSubgraphToBeSynced();

      const undepositId = transaction.hash.toLowerCase();
      const query = `
        {
          redeemableERC20ClaimEscrow (id: "${claimEscrowAddress}") {
            undeposits {
              id
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableERC20ClaimEscrow;

      expect(data.undeposits).deep.include(
        { id: undepositId },
        `redeemableERC20ClaimEscrow does NOT include the undeposit ID "${undepositId}"`
      );
    });

    it("should update RedeemableEscrowSupplyTokenDeposit after undeposit", async function () {
      const { supply: redeemableSupply } = await Util.getEventArgs(
        transaction,
        "Undeposit",
        claimEscrow
      );

      const supplyTokenDepositId = `${trustAddress} - ${claimEscrowAddress} - ${redeemableSupply} - ${claimableTokenAddress}`;

      const query = `
        {
          redeemableEscrowSupplyTokenDeposit (id: "${supplyTokenDepositId}") {
            totalDeposited
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowSupplyTokenDeposit;

      expect(data.totalDeposited).to.equals(
        totalDeposited.toString(),
        `wrong totalDeposit. Should be updated after undeposit
        expected  ${totalDeposited}
        got       ${data.totalDeposited}`
      );
    });

    it("should update RedeemableEscrowDepositor after undeposit", async function () {
      const undepositId = transaction.hash.toLowerCase();

      const escrowDepositorId = `${claimEscrowAddress} - ${depositor1}`;

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
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowDepositor;

      expect(data.undeposits).deep.include(
        { id: undepositId },
        `escrow depositor does NOT include the undeposit ID "${undepositId}"`
      );
    });

    it("should query RedeemableEscrowUndeposit after undeposit", async function () {
      const { supply: redeemableSupply, amount: undepositAmount } =
        await Util.getEventArgs(transaction, "Undeposit", claimEscrow);

      const undepositId = transaction.hash.toLowerCase();

      const query = `
        {
          redeemableEscrowUndeposit (id: "${undepositId}") {
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
        query: query,
      })) as FetchResult;
      const data = response.data.redeemableEscrowUndeposit;

      // Escrow expected values
      expect(data.escrow.id).to.equals(
        claimEscrowAddress,
        `escrow ID in response is NOT "${claimEscrowAddress}"`
      );
      expect(data.escrowAddress).to.equals(
        claimEscrowAddress,
        `escrow address in response is NOT "${claimEscrowAddress}"`
      );

      // Sale expected values
      expect(data.iSale.saleStatus).to.equals(
        SaleStatus.Fail,
        `wrong sale status in redeemableEscrowPendingDeposit`
      );
      expect(data.iSaleAddress).to.equals(
        trustAddress,
        `trust address in response is NOT "${trustAddress}"`
      );

      // Tokens expected values
      expect(data.token.id).to.equals(
        claimableTokenAddress,
        `wrong token ID in response. It is NOT "${claimableTokenAddress}"`
      );
      expect(data.tokenAddress).to.equals(
        claimableTokenAddress,
        `wrong token address in response. It is NOT "${claimableTokenAddress}"`
      );

      expect(data.redeemableSupply).to.equals(
        redeemableSupply,
        `wrong redeemableSupply amount in response
        expected  ${redeemableSupply}
        got       ${data.redeemableSupply}`
      );

      expect(data.tokenAmount).to.equals(
        undepositAmount,
        `wrong undeposit amount in response
        expected  ${undepositAmount}
        got       ${data.amount}`
      );
    });
  });
});
