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
  reserveDecimals: number,
  zeroDecimals: string,
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
  depositor2: string;



describe("Subgraph RedeemableERC20ClaimEscrow test", function () {
  before("Deploy fresh test contracts", async function () {
    // A readwrite Tier
    tier = (await deploy(readWriteTierJson, deployer, [])) as ReadWriteTier;
    await tier.setTier(signer1.address, Tier.FOUR, []);
    await tier.setTier(signer2.address, Tier.FOUR, []);

    // Reserve token
    claimableReserveToken = (await deploy(reserveToken, deployer, [])) as ReserveTokenTest;
    reserveDecimals = await claimableReserveToken.decimals();
    zeroDecimals = "0".repeat(reserveDecimals);

    // ClaimEscrowWrapper
    claimEscrowWrapper = (await deploy(claimEscroWrapperJson, deployer, [])) as RedeemableERC20ClaimEscrowWrapper;

    // Basic Setup
    ({ 
      reserve,
      trust,
      crp,
      bPool,
      redeemableERC20,
      minimumTradingDuration,
      minimumCreatorRaise,
      successLevel
    } = await Util.basicSetup(deployer, creator, seeder1, trustFactory, tier));

    startBlock = await ethers.provider.getBlockNumber();

    // Fill auxiliars with lowerCase to make IDs
    trustAddress = trust.address.toLowerCase();
    claimEscrowAddress = claimEscrow.address.toLowerCase();
    claimableTokenAddress = claimableReserveToken.address.toLowerCase();
    depositor1 = signer1.address.toLowerCase();
    depositor2 = signer2.address.toLowerCase();
  });

  it("should query RedeemableERC20ClaimEscrow correctly after construction", async function () {
    const query = `
      {
        claimEscrow (id: "${claimEscrow.address.toLowerCase()}") {
          address
          pendingDeposits {
            id
          }
          deposits {
            id
          }
          undeposits {
            id
          }
          withdraws {
            id
          }
          pendingDepositorTokens {
            id
          }
          supplyTokenDeposits {
            id
          }
          depositors {
            id
          }
          withdrawers {
            id
          }
        }
      }
    `;

    // const response = (await subgraph({
    //   query: query,
    // })) as FetchResult;
    // const data = response.data.claimEscrow;

    // expect(data.address).to.equals(claimEscrow.address.toLowerCase());

    // // Ofc, it is a initi state
    // expect(data.pendingDeposits).to.be.empty;
    // expect(data.deposits).to.be.empty;
    // expect(data.undeposits).to.be.empty;
    // expect(data.withdraws).to.be.empty;
    // expect(data.pendingDepositorTokens).to.be.empty;
    // expect(data.supplyTokenDeposits).to.be.empty;
    // expect(data.depositors).to.be.empty;
    // expect(data.withdrawers).to.be.empty;
  });

  it("should update the RedeemableERC20ClaimEscrow entity after a PendingDeposit", async function () {
    // Make a swap with the Util function
    const spend = ethers.BigNumber.from("200" + Util.sixZeros);
    await Util.swapReserveForTokens(crp, bPool, reserve, redeemableERC20, signer1, spend);

    // Deposit some claimable tokens
    const depositAmount = ethers.BigNumber.from("100" + zeroDecimals);
    await claimableReserveToken.transfer(signer1.address, depositAmount);
    await claimableReserveToken.connect(signer1).approve(claimEscrow.address, depositAmount);

    // Depositing
    transaction = await claimEscrow.connect(signer1).depositPending(
      trust.address,
      claimableReserveToken.address,
      depositAmount
    );

    const { amount: deposited0 } = await Util.getEventArgs(
      transaction,
      "PendingDeposit",
      claimEscrow
    );

    // await Util.delay(Util.wait);
    // await waitForSubgraphToBeSynced(2000);


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
    // const response = (await subgraph({
    //   query: query,
    // })) as FetchResult;
    // const data = response.data.claimEscrow;

    // expect(data.pendingDeposits).to.deep.include({ id: pendingDepositId });
    // expect(data.pendingDepositorTokens).to.deep.include({ id: pendingDepositorTokenId });
    // expect(data.depositors).to.deep.include({ id: escrowDepositorId });
  });

  it("should query the RedeemableEscrowPendingDeposit after a PendingDeposit");

  it("should query the RedeemableEscrowDepositor after a PendingDeposit");

  it("should query the RedeemableEscrowPendingDepositorToken after a PendingDeposit");

  it("should update the RedeemableERC20ClaimEscrow entity after a Deposit", async function () {
    // Make a swaps to raise all necessary funds
    const spend = ethers.BigNumber.from("200" + Util.sixZeros);
    while ((await reserve.balanceOf(bPool.address)).lt(successLevel)) {
      await Util.swapReserveForTokens(crp, bPool, reserve, redeemableERC20, signer1, spend);
    }

    // cover the dust amount
    const dustAtSuccessLevel = Util.determineReserveDust(successLevel).add(2); // rounding error
    await Util.swapReserveForTokens(crp, bPool, reserve, redeemableERC20, signer1, dustAtSuccessLevel);

    // create empty blocks to end of raise duration
    const beginEmptyBlocksBlock = await ethers.provider.getBlockNumber();
    const emptyBlocks =
      startBlock + minimumTradingDuration - beginEmptyBlocksBlock + 1;

    await Util.createEmptyBlock(emptyBlocks);

    await trust.endDutchAuction();

    const depositTx = await claimEscrow.sweepPending(
      trust.address,
      claimableReserveToken.address,
      signer1.address
    );
    const { supply } = await Util.getEventArgs(depositTx, "Deposit", claimEscrow);

    const txWithdraw0 = await claimEscrow
      .connect(signer1)
      .withdraw(trust.address, claimableReserveToken.address, supply);

    const { amount: registeredWithdrawnAmountSigner1 } =
      await Util.getEventArgs(txWithdraw0, "Withdraw", claimEscrow);
  });
  it("should update the RedeemableERC20ClaimEscrow entity after a Withdraw");
  it("should update the RedeemableERC20ClaimEscrow entity after a Undeposit"); // This need a new trust that fail to Undeposit
});
