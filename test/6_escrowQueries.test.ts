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
  redeemableERC20ClaimEscrow,
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
  });

  it("should query RedeemableERC20ClaimEscrow correctly after construction", async function () {
    const query = `
      {
        redeemableERC20ClaimEscrow (id: "${redeemableERC20ClaimEscrow.address.toLowerCase()}") {
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

    const response = (await subgraph({
      query: query,
    })) as FetchResult;

    const data = response.data.redeemableERC20ClaimEscrow;
    console.log("data : ", JSON.stringify(data))
    console.log("redeemableERC20ClaimEscrow : ", redeemableERC20ClaimEscrow.address.toLowerCase())

    // expect(data.address).to.equals(redeemableERC20ClaimEscrow.address.toLowerCase());

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

  it("should query update the redeemableERC20ClaimEscrow correctly after a depositPending", async function () {
    const spend = ethers.BigNumber.from("200" + Util.sixZeros);

    await Util.swapReserveForTokens(crp, bPool, reserve, redeemableERC20, signer1, spend);

    // deposit some claimable tokens
    const depositAmount0 = ethers.BigNumber.from("100" + zeroDecimals);
    await claimableReserveToken.transfer(signer1.address, depositAmount0);
    await claimableReserveToken.connect(signer1).approve(redeemableERC20ClaimEscrow.address, depositAmount0);

    // Depositing
    transaction = await redeemableERC20ClaimEscrow.connect(signer1).depositPending(
      trust.address,
      claimableReserveToken.address,
      depositAmount0
    );

    const { amount: deposited0 } = await Util.getEventArgs(
      transaction,
      "PendingDeposit",
      redeemableERC20ClaimEscrow
    );

    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(2000);

    const trustAddress = trust.address;
    const claim = redeemableERC20ClaimEscrow.address;
    const depositor = signer1.address;
    const token = claimableReserveToken.address;

    const pendingDepositId = transaction.hash.toLowerCase();
    const pendingDepositorTokenId = `${trustAddress.toLowerCase()} - ${claim.toLowerCase()} - ${depositor.toLowerCase()} - ${token.toLowerCase()}`;
    const escrowDepositorId = `${claim.toLowerCase()} - ${depositor.toLowerCase()}`;

    const query = `
      {
        redeemableERC20ClaimEscrow (id: "${redeemableERC20ClaimEscrow.address.toLowerCase()}") {
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
    // expect(data.pendingDepositorTokens).to.deep.include({ id: pendingDepositorTokenId });
    expect(data.depositors).to.deep.include({ id: escrowDepositorId });
  });

  it("should query the RedeemableEscrowPendingDeposit after a depositPending");

  it("should query the RedeemableEscrowDepositor after a depositPending");

  it("should query the RedeemableEscrowPendingDepositorToken after a depositPending");

});
