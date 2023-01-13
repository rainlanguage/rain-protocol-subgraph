import { expect } from "chai";
import { ethers } from "hardhat";
import * as Util from "./utils/utils";
import {
  waitForSubgraphToBeSynced,
  ZERO_BN,
  divBNOrFixed,
} from "./utils/utils";
import * as path from "path";

import {
  // Subgraph
  subgraph,
  // Signers
  deployer,
  signer1,
  signer2,
  signer3,
  // Contracts factories
  stakeFactory,
} from "./initialization.test";

// Typechain Factories
import { ReserveToken18__factory } from "../typechain/factories/ReserveToken18__factory";

// Types
import type { FetchResult } from "apollo-fetch";
import type { ReserveToken18 } from "../typechain/ReserveToken18";
import type {
  Stake,
  StakeConfigStruct,
  TransferEvent,
} from "../typechain/Stake";

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, ContractTransaction } from "ethers";

const { BigNumber, FixedNumber } = ethers;

async function deployStake(
  deployerAccount: SignerWithAddress,
  config?: StakeConfigStruct
): Promise<{
  _stake: Stake;
  _reserveToken: ReserveToken18;
  _stakeConfig: StakeConfigStruct;
}> {
  let _stakeConfig: StakeConfigStruct = config;
  let _reserveToken: ReserveToken18;

  if (!config) {
    _reserveToken = await new ReserveToken18__factory(deployerAccount).deploy();
    await _reserveToken.initialize();

    _stakeConfig = {
      name: "Stake Token",
      symbol: "STKN",
      asset: _reserveToken.address,
    };
  }
  const _stake = await Util.stakeDeploy(
    stakeFactory,
    deployerAccount,
    _stakeConfig
  );

  return { _stake, _reserveToken, _stakeConfig };
}

async function getTransferEvent(
  tx_: ContractTransaction,
  stake_: Contract
): Promise<TransferEvent["args"]> {
  return (await Util.getEventArgs(
    tx_,
    "Transfer",
    stake_
  )) as TransferEvent["args"];
}

describe("Stake queries - Test", function () {
  describe("StakeFactory entity", async () => {
    it("should query all the basic fields correctly", async () => {
      // Get the Stake implementation
      const implementation = await Util.getImplementation(stakeFactory);

      const query = `
        {
          stakeFactory (id: "${stakeFactory.address.toLowerCase()}") {
            address
            implementation
            children
            childrenCount
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.stakeFactory;

      expect(data.address).to.equals(stakeFactory.address.toLowerCase());
      expect(data.implementation).to.equals(implementation.toLowerCase());
      expect(data.children).to.be.empty;
      expect(data.childrenCount).to.equals("0");
    });

    it("should update the StakeFactory entity correctly after creating childen", async () => {
      // Deploying two sales to be query
      const { _stake: stake1 } = await deployStake(deployer);
      const { _stake: stake2 } = await deployStake(deployer);

      await waitForSubgraphToBeSynced();

      const query = `
      {
        stakeFactory (id: "${stakeFactory.address.toLowerCase()}") {
          children {
            id
          }
          childrenCount
        }
      }
    `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.stakeFactory;

      expect(data.childrenCount).to.equals("2");

      expect(data.children).to.deep.include({
        id: stake1.address.toLowerCase(),
      });
      expect(data.children).to.deep.include({
        id: stake2.address.toLowerCase(),
      });
    });
  });

  describe("StakeERC20 queries", () => {
    it("should query a StakeERC20 after creating with initial values", async () => {
      const {
        _stake: stakeContract,
        _reserveToken: token,
        _stakeConfig: deployedConfig,
      } = await deployStake(deployer);

      await waitForSubgraphToBeSynced();

      const [deployBlock, deployTime] = await Util.getTxTimeblock(
        stakeContract.deployTransaction
      );

      const query = `
      {
        stakeERC20(id: "${stakeContract.address.toLowerCase()}") {
          address
          deployer
          factory {
            id
          }
          token {
            id
          }
          deployBlock
          deployTimestamp
          name
          symbol
          decimals
          totalSupply
          tokenPoolSize
          tokenToStakeTokenRatio
          stakeTokenToTokenRatio
          deposits {
            id
          }
          withdraws {
            id
          }
          holders {
            id
          }
        }
      }
    `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.stakeERC20;

      expect(data.address).to.be.equals(stakeContract.address.toLowerCase());
      expect(data.deployer).to.be.equals(deployer.address.toLowerCase());
      expect(data.factory.id).to.be.equals(stakeFactory.address.toLowerCase());
      expect(data.token.id).to.be.equals(token.address.toLowerCase());

      expect(data.deployBlock).to.be.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.be.equals(deployTime.toString());

      expect(data.name).to.be.equals(deployedConfig.name);
      expect(data.symbol).to.be.equals(deployedConfig.symbol);
      expect(data.decimals).to.be.equals(await stakeContract.decimals());
      expect(data.totalSupply).to.be.equals(await stakeContract.totalSupply());

      expect(data.tokenPoolSize).to.be.equals("0");
      expect(data.tokenToStakeTokenRatio).to.be.equals("0");
      expect(data.stakeTokenToTokenRatio).to.be.equals("0");

      expect(data.deposits).to.be.empty;
      expect(data.withdraws).to.be.empty;
      expect(data.holders).to.be.empty;
    });

    it("should update and query a StakeERC20 after deposits", async () => {
      const { _stake: stakeContract, _reserveToken: token } = await deployStake(
        deployer
      );

      const tokenPoolSize0_ = await token.balanceOf(stakeContract.address);
      const totalSupply0_ = await stakeContract.totalSupply();
      const amountToDeposit = BigNumber.from("1000" + Util.sixZeros);

      // Checking init values
      expect(tokenPoolSize0_).to.be.equals(totalSupply0_);
      expect(tokenPoolSize0_).to.be.equals("0");

      // signer1 deposits reserve tokens
      await token.transfer(signer1.address, amountToDeposit.mul(2));
      await token
        .connect(signer1)
        .approve(stakeContract.address, amountToDeposit.mul(2));

      // First deposit
      const depositTx1 = await stakeContract
        .connect(signer1)
        .deposit(amountToDeposit, signer1.address);

      // Second deposit
      const depositTx2 = await stakeContract
        .connect(signer1)
        .deposit(amountToDeposit, signer1.address);

      const tokenPoolSizeExpected = await token.balanceOf(
        stakeContract.address
      );

      await waitForSubgraphToBeSynced();

      const stakeHolder = `${stakeContract.address.toLowerCase()}-${signer1.address.toLowerCase()}`;

      await waitForSubgraphToBeSynced();

      const query = `
        {
          stakeERC20(id: "${stakeContract.address.toLowerCase()}") {
            totalSupply
            tokenPoolSize
            tokenToStakeTokenRatio
            stakeTokenToTokenRatio
            deposits {
              id
            }
            withdraws {
              id
            }
            holders {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.stakeERC20;

      expect(data.totalSupply).to.be.equals(await stakeContract.totalSupply());
      expect(data.tokenPoolSize).to.be.equals(tokenPoolSizeExpected);

      expect(
        FixedNumber.from(data.tokenToStakeTokenRatio).toString()
      ).to.be.equals(
        divBNOrFixed(data.totalSupply, tokenPoolSizeExpected).toString()
      );
      expect(
        FixedNumber.from(data.stakeTokenToTokenRatio).toString()
      ).to.be.equals(
        divBNOrFixed(tokenPoolSizeExpected, data.totalSupply).toString()
      );

      expect(data.withdraws).to.be.empty;
      expect(data.holders).to.deep.include({
        id: stakeHolder,
      });
      expect(data.deposits).to.deep.include({
        id: depositTx1.hash,
      });
      expect(data.deposits).to.deep.include({
        id: depositTx2.hash,
      });
    });

    it("should update and query a StakeERC20 after withdraw", async () => {
      const { _stake: stakeContract, _reserveToken: token } = await deployStake(
        deployer
      );

      // Give Alice some reserve tokens and deposit them
      await token.transfer(
        signer1.address,
        BigNumber.from("1000" + Util.sixZeros)
      );
      const tokenBalanceSigner1 = await token.balanceOf(signer1.address);
      await token
        .connect(signer1)
        .approve(stakeContract.address, tokenBalanceSigner1);
      await stakeContract
        .connect(signer1)
        .deposit(tokenBalanceSigner1, signer1.address);

      // Give Bob some reserve tokens and deposit them
      await token.transfer(
        signer2.address,
        BigNumber.from("1000" + Util.sixZeros)
      );
      const tokenBalanceSigner2 = await token.balanceOf(signer2.address);
      await token
        .connect(signer2)
        .approve(stakeContract.address, tokenBalanceSigner2);
      await stakeContract
        .connect(signer2)
        .deposit(tokenBalanceSigner2, signer2.address);

      // Signer1 and Signer2 each own 50% of stToken supply
      const amountToWithdraw = await stakeContract.maxWithdraw(signer1.address);

      const withdrawTx = await stakeContract
        .connect(signer1)
        .withdraw(amountToWithdraw, signer1.address, signer1.address);

      const tokenPoolSizeExpected = await token.balanceOf(
        stakeContract.address
      );

      await waitForSubgraphToBeSynced();

      const query = `
        {
          stakeERC20(id: "${stakeContract.address.toLowerCase()}") {
            totalSupply
            tokenPoolSize
            tokenToStakeTokenRatio
            stakeTokenToTokenRatio
            withdraws {
              id
            }
            holders {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.stakeERC20;

      expect(data.totalSupply).to.be.equals(await stakeContract.totalSupply());
      expect(data.tokenPoolSize).to.be.equals(tokenPoolSizeExpected);

      expect(
        FixedNumber.from(data.tokenToStakeTokenRatio).toString()
      ).to.be.equals(
        divBNOrFixed(data.totalSupply, tokenPoolSizeExpected).toString()
      );
      expect(
        FixedNumber.from(data.stakeTokenToTokenRatio).toString()
      ).to.be.equals(
        divBNOrFixed(tokenPoolSizeExpected, data.totalSupply).toString()
      );

      expect(data.withdraws).to.deep.include({
        id: withdrawTx.hash,
      });
    });

    it("should update StakeERC20 after User/Anon send reserve token to Stake directly", async () => {
      const { _stake: stake, _reserveToken: token } = await deployStake(
        deployer
      );

      // ================== PART 0 =================================

      const tokenPoolSize0_ = await token.balanceOf(stake.address);
      const totalSupply0_ = await stake.totalSupply();
      const amountToDeposit_0 = BigNumber.from("1000" + Util.sixZeros);

      // Checking init values
      expect(tokenPoolSize0_).to.be.equals(totalSupply0_);
      expect(tokenPoolSize0_).to.be.equals("0");

      // signer1 deposits reserve tokens
      await token.transfer(signer1.address, amountToDeposit_0.mul(2));
      await token
        .connect(signer1)
        .approve(stake.address, amountToDeposit_0.mul(2));

      // First deposit
      await stake.connect(signer1).deposit(amountToDeposit_0, signer1.address);

      // Second deposit
      await stake.connect(signer1).deposit(amountToDeposit_0, signer1.address);

      await waitForSubgraphToBeSynced();

      const query = `
        {
          stakeERC20(id: "${stake.address.toLowerCase()}") {
            totalSupply
            tokenPoolSize
            tokenToStakeTokenRatio
            stakeTokenToTokenRatio
          }
        }
      `;

      const response_0 = (await subgraph({
        query,
      })) as FetchResult;

      const data_0 = response_0.data.stakeERC20;

      const tokenPoolSize_0 = await token.balanceOf(stake.address);
      const totalSupply_0 = await stake.totalSupply();

      expect(data_0.tokenPoolSize).to.be.equals(tokenPoolSize_0);
      expect(data_0.totalSupply).to.be.equals(totalSupply_0);

      expect(
        FixedNumber.from(data_0.tokenToStakeTokenRatio).toString()
      ).to.be.equals(divBNOrFixed(totalSupply_0, tokenPoolSize_0).toString());

      expect(
        FixedNumber.from(data_0.stakeTokenToTokenRatio).toString()
      ).to.be.equals(divBNOrFixed(tokenPoolSize_0, totalSupply_0).toString());

      // ================== PART 1 =================================

      // Some user send the Reserve Token directly to the Stake Contract
      const amountToDeposit_1 = BigNumber.from("2000" + Util.sixZeros);
      await token.transfer(stake.address, amountToDeposit_1);

      await waitForSubgraphToBeSynced();

      const response_1 = (await subgraph({
        query,
      })) as FetchResult;

      const data_1 = response_1.data.stakeERC20;

      const tokenPoolSize_1 = await token.balanceOf(stake.address);
      const totalSupply_1 = await stake.totalSupply();

      expect(data_1.tokenPoolSize).to.be.equals(tokenPoolSize_1);
      expect(data_1.totalSupply).to.be.equals(totalSupply_1);

      expect(
        FixedNumber.from(data_1.tokenToStakeTokenRatio).toString()
      ).to.be.equals(divBNOrFixed(totalSupply_1, tokenPoolSize_1).toString());

      expect(
        FixedNumber.from(data_1.stakeTokenToTokenRatio).toString()
      ).to.be.equals(divBNOrFixed(tokenPoolSize_1, totalSupply_1).toString());
    });
  });

  describe("StakeHolder queries", () => {
    it("should query a StakeHolder after deposits", async () => {
      const { _stake: stakeContract, _reserveToken: token } = await deployStake(
        deployer
      );

      const tokenPoolSize0_ = await token.balanceOf(stakeContract.address);
      const totalSupply0_ = await stakeContract.totalSupply();
      const amountToDeposit = BigNumber.from("1000" + Util.sixZeros);

      // Checking init values
      expect(tokenPoolSize0_).to.be.equals(totalSupply0_);
      expect(tokenPoolSize0_).to.be.equals("0");

      // signer1 deposits reserve tokens
      await token.transfer(signer1.address, amountToDeposit.mul(2));
      await token
        .connect(signer1)
        .approve(stakeContract.address, amountToDeposit.mul(2));

      // First deposit
      const depositTx1 = await stakeContract
        .connect(signer1)
        .deposit(amountToDeposit, signer1.address);

      // Second deposit
      const depositTx2 = await stakeContract
        .connect(signer1)
        .deposit(amountToDeposit, signer1.address);

      await waitForSubgraphToBeSynced();

      const stakeHolder = `${stakeContract.address.toLowerCase()}-${signer1.address.toLowerCase()}`;

      const totalStakedExpected = amountToDeposit.mul(2);
      const totalDepositedExpected = amountToDeposit.mul(2);

      const query = `
        {
          stakeHolder(id: "${stakeHolder}") {
            address
            token {
              id
            }
            stakeToken {
              id
            }
            balance
            totalStake
            totalDeposited
            totalEntitlement
            deposits {
              id
            }
            withdraws {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.stakeHolder;

      expect(data.address).to.be.equals(signer1.address.toLowerCase());
      expect(data.token.id).to.be.equals(token.address.toLowerCase());
      expect(data.stakeToken.id).to.be.equals(
        stakeContract.address.toLowerCase()
      );

      expect(data.balance).to.be.equals(
        await stakeContract.balanceOf(signer1.address)
      );

      expect(data.totalStake).to.be.equals(totalStakedExpected);
      expect(data.totalDeposited).to.be.equals(totalDepositedExpected);

      // (balance * StakeToken.tokenPoolSize) / StakeToken.totalSupply
      expect(FixedNumber.from(data.totalEntitlement).toString()).to.be.equals(
        divBNOrFixed(
          (await stakeContract.balanceOf(signer1.address)).mul(
            await token.balanceOf(stakeContract.address)
          ),
          await stakeContract.totalSupply()
        ).toString()
      );

      expect(data.withdraws).to.be.empty;

      expect(data.deposits).to.deep.include({
        id: depositTx1.hash,
      });
      expect(data.deposits).to.deep.include({
        id: depositTx2.hash,
      });
    });

    it("should update and query a StakeHolder after withdraw", async () => {
      const { _stake: stakeContract, _reserveToken: token } = await deployStake(
        deployer
      );

      const amountToTransfer = BigNumber.from("1000" + Util.sixZeros);

      // Give signer1 some reserve tokens and deposit them
      await token.transfer(signer1.address, amountToTransfer);
      const tokenBalanceSigner1 = await token.balanceOf(signer1.address);
      await token
        .connect(signer1)
        .approve(stakeContract.address, tokenBalanceSigner1);
      await stakeContract
        .connect(signer1)
        .deposit(tokenBalanceSigner1, signer1.address);

      // Give signer2 some reserve tokens and deposit them
      await token.transfer(signer2.address, amountToTransfer);
      const tokenBalanceSigner2 = await token.balanceOf(signer2.address);
      await token
        .connect(signer2)
        .approve(stakeContract.address, tokenBalanceSigner2);
      await stakeContract
        .connect(signer2)
        .deposit(tokenBalanceSigner2, signer2.address);

      // Signer1 and Signer2 each own 50% of stToken supply. Withdraw 50% of signer1 available
      const amountToWithdraw = (
        await stakeContract.maxWithdraw(signer1.address)
      ).div(2);

      const withdrawTx = await stakeContract
        .connect(signer1)
        .withdraw(amountToWithdraw, signer1.address, signer1.address);

      await waitForSubgraphToBeSynced();

      const stakeHolder = `${stakeContract.address.toLowerCase()}-${signer1.address.toLowerCase()}`;

      const totalStakeSigner1 = tokenBalanceSigner1.sub(amountToWithdraw);
      const totalDepositedSigner1 = tokenBalanceSigner1;

      const query = `
        {
          stakeHolder(id: "${stakeHolder}") {
            balance
            totalStake
            totalDeposited
            totalEntitlement
            deposits {
              id
            }
            withdraws {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.stakeHolder;

      expect(data.balance).to.be.equals(
        await stakeContract.balanceOf(signer1.address)
      );

      expect(data.totalStake).to.be.equals(totalStakeSigner1);
      expect(data.totalDeposited).to.be.equals(totalDepositedSigner1);

      // (balance * StakeToken.tokenPoolSize) / StakeToken.totalSupply
      expect(FixedNumber.from(data.totalEntitlement).toString()).to.be.equals(
        divBNOrFixed(
          (await stakeContract.balanceOf(signer1.address)).mul(
            await token.balanceOf(stakeContract.address)
          ),
          await stakeContract.totalSupply()
        ).toString()
      );

      expect(data.withdraws).to.deep.include({
        id: withdrawTx.hash,
      });
    });

    it("should update and query a StakeHolder info after multiples withdraws", async () => {
      const { _stake: stakeContract, _reserveToken: token } = await deployStake(
        deployer
      );

      const amountToTransfer = BigNumber.from("5");

      // Give signer1 some reserve tokens and deposit them
      await token.transfer(signer1.address, amountToTransfer);
      const tokenBalanceSigner1 = await token.balanceOf(signer1.address);
      await token
        .connect(signer1)
        .approve(stakeContract.address, tokenBalanceSigner1);
      await stakeContract
        .connect(signer1)
        .deposit(tokenBalanceSigner1, signer1.address);

      // Give signer2 some reserve tokens and deposit them
      await token.transfer(signer2.address, amountToTransfer);
      const tokenBalanceSigner2 = await token.balanceOf(signer2.address);
      await token
        .connect(signer2)
        .approve(stakeContract.address, tokenBalanceSigner2);
      await stakeContract
        .connect(signer2)
        .deposit(tokenBalanceSigner2, signer2.address);

      // Signer1 and Signer2 each own 50% of stToken supply. Withdraw 50% of signer1 available
      const maxWithdrawSigner1 = await stakeContract.maxWithdraw(
        signer1.address
      );
      const amountToWithdraw1 = maxWithdrawSigner1.div(2);
      const amountToWithdraw2 = maxWithdrawSigner1.sub(amountToWithdraw1);

      const stakeHolder = `${stakeContract.address.toLowerCase()}-${signer1.address.toLowerCase()}`;
      let totalStakeSigner1 = tokenBalanceSigner1;

      const query = `
        {
          stakeHolder(id: "${stakeHolder}") {
            balance
            totalStake
            totalEntitlement
            withdraws {
              id
            }
          }
        }
      `;

      const withdrawTx1 = await stakeContract
        .connect(signer1)
        .withdraw(amountToWithdraw1, signer1.address, signer1.address);

      totalStakeSigner1 = totalStakeSigner1.sub(amountToWithdraw1);

      // Wait after first withdraw
      await waitForSubgraphToBeSynced();

      const response1_ = (await subgraph({
        query,
      })) as FetchResult;

      const data1_ = response1_.data.stakeHolder;

      expect(data1_.totalStake).to.be.equals(totalStakeSigner1);
      expect(data1_.balance).to.be.equals(
        await stakeContract.balanceOf(signer1.address)
      );

      // (balance * StakeToken.tokenPoolSize) / StakeToken.totalSupply
      expect(FixedNumber.from(data1_.totalEntitlement).toString()).to.be.equals(
        divBNOrFixed(
          (await stakeContract.balanceOf(signer1.address)).mul(
            await token.balanceOf(stakeContract.address)
          ),
          await stakeContract.totalSupply()
        ).toString()
      );

      expect(data1_.withdraws).to.deep.include({
        id: withdrawTx1.hash,
      });
      ///

      const withdrawTx2 = await stakeContract
        .connect(signer1)
        .withdraw(amountToWithdraw2, signer1.address, signer1.address);

      totalStakeSigner1 = totalStakeSigner1.sub(amountToWithdraw2);

      // Wait after second withdraw
      await waitForSubgraphToBeSynced();

      const response2_ = (await subgraph({
        query,
      })) as FetchResult;

      const data2_ = response2_.data.stakeHolder;

      expect(data2_.balance).to.be.equals(
        await stakeContract.balanceOf(signer1.address)
      );

      expect(data2_.totalStake).to.be.equals(totalStakeSigner1);

      // (balance * StakeToken.tokenPoolSize) / StakeToken.totalSupply
      expect(FixedNumber.from(data2_.totalEntitlement).toString()).to.be.equals(
        divBNOrFixed(
          (await stakeContract.balanceOf(signer1.address)).mul(
            await token.balanceOf(stakeContract.address)
          ),
          await stakeContract.totalSupply()
        ).toString()
      );

      expect(data2_.withdraws).to.deep.include({
        id: withdrawTx1.hash,
      });
      expect(data2_.withdraws).to.deep.include({
        id: withdrawTx2.hash,
      });
    });

    it("should update all the StakeHolders after multiples deposits and withdraws", async () => {
      const { _stake: stake, _reserveToken: token } = await deployStake(
        deployer
      );

      // Save variable to more readables queries
      const stakeAddress = stake.address.toLowerCase();
      const signer1Address = signer1.address.toLowerCase();
      const signer2Address = signer2.address.toLowerCase();
      const signer3Address = signer3.address.toLowerCase();

      // ================== PART 0 =================================

      // 2.000.000
      const amountToTransfer_0 = BigNumber.from("2" + Util.sixZeros);

      // Give signer1, signer2 and signer3 some reserve tokens
      await token.transfer(signer1.address, amountToTransfer_0.mul(2));
      await token.transfer(signer2.address, amountToTransfer_0);
      await token.transfer(signer3.address, amountToTransfer_0.div(3));

      // Getting the balance of each user
      const tokenBalanceSigner1_0 = await token.balanceOf(signer1.address);
      const tokenBalanceSigner2_0 = await token.balanceOf(signer2.address);
      const tokenBalanceSigner3_0 = await token.balanceOf(signer3.address);

      // Approve token to be use by the StakeContract
      await token
        .connect(signer1)
        .approve(stake.address, tokenBalanceSigner1_0);
      await token
        .connect(signer2)
        .approve(stake.address, tokenBalanceSigner2_0);
      await token
        .connect(signer3)
        .approve(stake.address, tokenBalanceSigner3_0);

      // Deposit all tokens to stake contract (each user)
      const txDepositSigner1_0 = await stake
        .connect(signer1)
        .deposit(tokenBalanceSigner1_0, signer1.address);
      const txDepositSigner2_0 = await stake
        .connect(signer2)
        .deposit(tokenBalanceSigner2_0, signer2.address);
      const txDepositSigner3_0 = await stake
        .connect(signer3)
        .deposit(tokenBalanceSigner3_0, signer3.address);

      // Then StakeHolder IDs
      const stakeHolder1 = `${stakeAddress}-${signer1Address}`;
      const stakeHolder2 = `${stakeAddress}-${signer2Address}`;
      const stakeHolder3 = `${stakeAddress}-${signer3Address}`;

      const query = `
        {
          holder1: stakeHolder(id: "${stakeHolder1}") {
            balance
            totalStake
            totalEntitlement
            deposits {
              id
            }
            withdraws {
              id
            }
          }
          holder2: stakeHolder(id: "${stakeHolder2}") {
            balance
            totalStake
            totalEntitlement
            deposits {
              id
            }
            withdraws {
              id
            }
          }
          holder3: stakeHolder(id: "${stakeHolder3}") {
            balance
            totalStake
            totalEntitlement
            deposits {
              id
            }
            withdraws {
              id
            }
          }
        }
      `;

      await waitForSubgraphToBeSynced();

      const response_0 = (await subgraph({
        query,
      })) as FetchResult;

      const {
        holder1: dataHolder1_0,
        holder2: dataHolder2_0,
        holder3: dataHolder3_0,
      } = response_0.data;

      // Generating expected result - 0
      // Getting values (amount deposit) from deposit
      const { value: valueDespositSigner1_0 } = await getTransferEvent(
        txDepositSigner1_0,
        stake
      );
      const { value: valueDespositSigner2_0 } = await getTransferEvent(
        txDepositSigner2_0,
        stake
      );
      const { value: valueDespositSigner3_0 } = await getTransferEvent(
        txDepositSigner3_0,
        stake
      );

      // TotalStake_0: Accumulate total deposits started + deposit
      let accumulatedTotalStakeSigner1 = ZERO_BN.add(valueDespositSigner1_0);
      let accumulatedTotalStakeSigner2 = ZERO_BN.add(valueDespositSigner2_0);
      let accumulatedTotalStakeSigner3 = ZERO_BN.add(valueDespositSigner3_0);

      // Balances_0
      const stakeBalanceSigner1_0 = await stake.balanceOf(signer1.address);
      const stakeBalanceSigner2_0 = await stake.balanceOf(signer2.address);
      const stakeBalanceSigner3_0 = await stake.balanceOf(signer3.address);

      const stakeTokenPoolSize_0 = await token.balanceOf(stake.address);
      const stakeTotalSupply_0 = await stake.totalSupply();

      // TotalEntitlement_0: (balance * StakeToken.tokenPoolSize) / StakeToken.totalSupply
      const totalEntitlementSigner1_0 = divBNOrFixed(
        stakeBalanceSigner1_0.mul(stakeTokenPoolSize_0),
        stakeTotalSupply_0
      );
      const totalEntitlementSigner2_0 = divBNOrFixed(
        stakeBalanceSigner2_0.mul(stakeTokenPoolSize_0),
        stakeTotalSupply_0
      );
      const totalEntitlementSigner3_0 = divBNOrFixed(
        stakeBalanceSigner3_0.mul(stakeTokenPoolSize_0),
        stakeTotalSupply_0
      );

      // Cecking values by each type of value
      expect(dataHolder1_0.balance).to.be.equal(stakeBalanceSigner1_0);
      expect(dataHolder2_0.balance).to.be.equal(stakeBalanceSigner2_0);
      expect(dataHolder3_0.balance).to.be.equal(stakeBalanceSigner3_0);

      expect(dataHolder1_0.totalStake).to.equal(accumulatedTotalStakeSigner1);
      expect(dataHolder2_0.totalStake).to.equal(accumulatedTotalStakeSigner2);
      expect(dataHolder3_0.totalStake).to.equal(accumulatedTotalStakeSigner3);

      expect(dataHolder1_0.withdraws).to.be.empty;
      expect(dataHolder2_0.withdraws).to.be.empty;
      expect(dataHolder3_0.withdraws).to.be.empty;

      expect(dataHolder1_0.deposits).to.deep.include({
        id: txDepositSigner1_0.hash,
      });
      expect(dataHolder2_0.deposits).to.deep.include({
        id: txDepositSigner2_0.hash,
      });
      expect(dataHolder3_0.deposits).to.deep.include({
        id: txDepositSigner3_0.hash,
      });

      expect(FixedNumber.from(dataHolder1_0.totalEntitlement).toString()).equal(
        totalEntitlementSigner1_0.toString()
      );
      expect(FixedNumber.from(dataHolder2_0.totalEntitlement).toString()).equal(
        totalEntitlementSigner2_0.toString()
      );
      expect(FixedNumber.from(dataHolder3_0.totalEntitlement).toString()).equal(
        totalEntitlementSigner3_0.toString()
      );

      // ================== PART 1 =================================
      // New deposits
      // 6.000.000
      const amountToTransfer_1 = BigNumber.from("6" + Util.sixZeros);

      // Give signer1, signer2 and signer3 some reserve tokens
      await token.transfer(signer1.address, amountToTransfer_1.div(2));
      await token.transfer(signer2.address, amountToTransfer_1);
      await token.transfer(signer3.address, amountToTransfer_1.mul(2));

      // Getting the balance of each user
      const tokenBalanceSigner1_1 = await token.balanceOf(signer1.address);
      const tokenBalanceSigner2_1 = await token.balanceOf(signer2.address);
      const tokenBalanceSigner3_1 = await token.balanceOf(signer3.address);

      // Approve token to be use by the StakeContract
      await token
        .connect(signer1)
        .approve(stake.address, tokenBalanceSigner1_1);
      await token
        .connect(signer2)
        .approve(stake.address, tokenBalanceSigner2_1);
      await token
        .connect(signer3)
        .approve(stake.address, tokenBalanceSigner3_1);

      // Deposit all tokens to stake contract (each user)
      const txDepositSigner1_1 = await stake
        .connect(signer1)
        .deposit(tokenBalanceSigner1_1, signer1.address);
      const txDepositSigner2_1 = await stake
        .connect(signer2)
        .deposit(tokenBalanceSigner2_1, signer2.address);
      const txDepositSigner3_1 = await stake
        .connect(signer3)
        .deposit(tokenBalanceSigner3_1, signer3.address);

      await waitForSubgraphToBeSynced();

      const response_1 = (await subgraph({
        query,
      })) as FetchResult;

      const {
        holder1: dataHolder1_1,
        holder2: dataHolder2_1,
        holder3: dataHolder3_1,
      } = response_1.data;

      // Generating expected result - 1
      // Getting values (amount deposit) from deposit
      const { value: valueDespositSigner1_1 } = await getTransferEvent(
        txDepositSigner1_1,
        stake
      );
      const { value: valueDespositSigner2_1 } = await getTransferEvent(
        txDepositSigner2_1,
        stake
      );
      const { value: valueDespositSigner3_1 } = await getTransferEvent(
        txDepositSigner3_1,
        stake
      );

      // Updating the totalStake for each signer
      accumulatedTotalStakeSigner1 = accumulatedTotalStakeSigner1.add(
        valueDespositSigner1_1
      );
      accumulatedTotalStakeSigner2 = accumulatedTotalStakeSigner2.add(
        valueDespositSigner2_1
      );
      accumulatedTotalStakeSigner3 = accumulatedTotalStakeSigner3.add(
        valueDespositSigner3_1
      );

      // Balances_1
      const stakeBalanceSigner1_1 = await stake.balanceOf(signer1.address);
      const stakeBalanceSigner2_1 = await stake.balanceOf(signer2.address);
      const stakeBalanceSigner3_1 = await stake.balanceOf(signer3.address);

      const stakeTokenPoolSize_1 = await token.balanceOf(stake.address);
      const stakeTotalSupply_1 = await stake.totalSupply();

      // TotalEntitlement_1: (balance * StakeToken.tokenPoolSize) / StakeToken.totalSupply
      const totalEntitlementSigner1_1 = divBNOrFixed(
        stakeBalanceSigner1_1.mul(stakeTokenPoolSize_1),
        stakeTotalSupply_1
      );
      const totalEntitlementSigner2_1 = divBNOrFixed(
        stakeBalanceSigner2_1.mul(stakeTokenPoolSize_1),
        stakeTotalSupply_1
      );
      const totalEntitlementSigner3_1 = divBNOrFixed(
        stakeBalanceSigner3_1.mul(stakeTokenPoolSize_1),
        stakeTotalSupply_1
      );

      // Cecking values by each type of value
      expect(dataHolder1_1.balance).to.be.equal(stakeBalanceSigner1_1);
      expect(dataHolder2_1.balance).to.be.equal(stakeBalanceSigner2_1);
      expect(dataHolder3_1.balance).to.be.equal(stakeBalanceSigner3_1);

      expect(dataHolder1_1.totalStake).to.equal(accumulatedTotalStakeSigner1);
      expect(dataHolder2_1.totalStake).to.equal(accumulatedTotalStakeSigner2);
      expect(dataHolder3_1.totalStake).to.equal(accumulatedTotalStakeSigner3);

      expect(dataHolder1_1.withdraws).to.be.empty;
      expect(dataHolder2_1.withdraws).to.be.empty;
      expect(dataHolder3_1.withdraws).to.be.empty;

      expect(dataHolder1_1.deposits).to.deep.include({
        id: txDepositSigner1_1.hash,
      });
      expect(dataHolder2_1.deposits).to.deep.include({
        id: txDepositSigner2_1.hash,
      });
      expect(dataHolder3_1.deposits).to.deep.include({
        id: txDepositSigner3_1.hash,
      });

      expect(FixedNumber.from(dataHolder1_1.totalEntitlement).toString()).equal(
        totalEntitlementSigner1_1.toString()
      );
      expect(FixedNumber.from(dataHolder2_1.totalEntitlement).toString()).equal(
        totalEntitlementSigner2_1.toString()
      );
      expect(FixedNumber.from(dataHolder3_1.totalEntitlement).toString()).equal(
        totalEntitlementSigner3_1.toString()
      );

      // ================== PART 2 =================================

      // Signer2 withdraws a quarter of its maximum Withdrawal
      const maxWithdrawSigner2_2 = await stake.maxWithdraw(signer2.address);
      const amountToWithdrawSigner2_2 = maxWithdrawSigner2_2.div(4);
      const txWithdrawSigner2_2 = await stake
        .connect(signer2)
        .withdraw(amountToWithdrawSigner2_2, signer2.address, signer2.address);

      // Signer3 withdraws half of his maximum Withdrawal
      const maxWithdrawSigner3_2 = await stake.maxWithdraw(signer3.address);
      const amountToWithdrawSigner3_2 = maxWithdrawSigner3_2.div(2);
      const txWithdrawSigner3_2 = await stake
        .connect(signer3)
        .withdraw(amountToWithdrawSigner3_2, signer3.address, signer3.address);

      await waitForSubgraphToBeSynced();

      const response_2 = (await subgraph({
        query,
      })) as FetchResult;

      const {
        holder1: dataHolder1_2,
        holder2: dataHolder2_2,
        holder3: dataHolder3_2,
      } = response_2.data;

      //////////////////////////////

      // Generating expected result - 2
      // Getting value (amount withdraw) from withdraw
      const { value: valueWithdrawSigner2_2 } = await getTransferEvent(
        txWithdrawSigner2_2,
        stake
      );
      const { value: valueWithdrawSigner3_2 } = await getTransferEvent(
        txWithdrawSigner3_2,
        stake
      );

      // Updating the totalStake
      accumulatedTotalStakeSigner2 = accumulatedTotalStakeSigner2.sub(
        valueWithdrawSigner2_2
      );
      accumulatedTotalStakeSigner3 = accumulatedTotalStakeSigner3.sub(
        valueWithdrawSigner3_2
      );

      // Balances_2
      const stakeBalanceSigner1_2 = await stake.balanceOf(signer1.address);
      const stakeBalanceSigner2_2 = await stake.balanceOf(signer2.address);
      const stakeBalanceSigner3_2 = await stake.balanceOf(signer3.address);

      const stakeTokenPoolSize_2 = await token.balanceOf(stake.address);
      const stakeTotalSupply_2 = await stake.totalSupply();

      // TotalEntitlement_2: (balance * StakeToken.tokenPoolSize) / StakeToken.totalSupply
      const totalEntitlementSigner1_2 = divBNOrFixed(
        stakeBalanceSigner1_2.mul(stakeTokenPoolSize_2),
        stakeTotalSupply_2
      );
      const totalEntitlementSigner2_2 = divBNOrFixed(
        stakeBalanceSigner2_2.mul(stakeTokenPoolSize_2),
        stakeTotalSupply_2
      );
      const totalEntitlementSigner3_2 = divBNOrFixed(
        stakeBalanceSigner3_2.mul(stakeTokenPoolSize_2),
        stakeTotalSupply_2
      );

      // Cecking values by each type of value
      expect(dataHolder1_2.balance).to.be.equal(stakeBalanceSigner1_2);
      // expect(dataHolder2_2.balance).to.be.equal(stakeBalanceSigner2_2);
      expect(dataHolder3_2.balance).to.be.equal(stakeBalanceSigner3_2);

      expect(dataHolder1_2.totalStake).to.equal(accumulatedTotalStakeSigner1);
      expect(dataHolder2_2.totalStake).to.equal(accumulatedTotalStakeSigner2);
      expect(dataHolder3_2.totalStake).to.equal(accumulatedTotalStakeSigner3);

      // Only Holder3/Signer3 should have withdraws at this point
      expect(dataHolder1_2.withdraws).to.be.empty;
      expect(dataHolder2_2.withdraws).to.deep.include({
        id: txWithdrawSigner2_2.hash,
      });
      expect(dataHolder3_2.withdraws).to.deep.include({
        id: txWithdrawSigner3_2.hash,
      });

      expect(FixedNumber.from(dataHolder1_2.totalEntitlement).toString()).equal(
        totalEntitlementSigner1_2.toString()
      );
      expect(FixedNumber.from(dataHolder2_2.totalEntitlement).toString()).equal(
        totalEntitlementSigner2_2.toString()
      );
      expect(FixedNumber.from(dataHolder3_2.totalEntitlement).toString()).equal(
        totalEntitlementSigner3_2.toString()
      );
    });

    it("should update StakeHolder after multiples deposits and withdraws - Replicating XORD", async () => {
      type StakeDepositData = {
        stakeTokenMinted: string;
        tokenPoolSize: string;
        value: string;
        depositedAmount: string;
        timestamp: string;
        __typename: "StakeDeposit";
      };

      type StakeWithdrawData = {
        stakeTokenBurned: string;
        tokenPoolSize: string;
        value: string;
        returnedAmount: string;
        timestamp: string;
        __typename: "StakeWithdraw";
      };

      const txsSorted = JSON.parse(
        Util.fetchFile(path.resolve(__dirname, "./mocks/dataTxSorted_1.json"))
      ) as (StakeDepositData | StakeWithdrawData)[];

      const { _stake: stake, _reserveToken: token } = await deployStake(
        deployer
      );

      // Giving all the tokens to signer1 and pre-approving to the stake
      await token.transfer(signer1.address, await token.totalSupply());
      await token
        .connect(signer1)
        .approve(stake.address, await token.balanceOf(signer1.address));

      // SG info constants
      const stakeHolder = `${stake.address.toLowerCase()}-${signer1.address.toLowerCase()}`;
      const query = `
        {
          stakeHolder(id: "${stakeHolder}") {
            address
            balance
            totalStake
            totalDeposited
            totalEntitlement
            deposits {
              id
            }
            withdraws {
              id
            }
          }
        }
      `;

      // SG info variables
      let totalDeposits = 0;
      let totalWithdraws = 0;
      let totalStaked = ZERO_BN;
      let totalDeposited = ZERO_BN;

      for (let i = 0; i < txsSorted.length; i++) {
        const txData = txsSorted[i];

        if (txData.__typename == "StakeDeposit") {
          // Deposit tx
          const depositTx = await stake
            .connect(signer1)
            .deposit(txData.value, signer1.address);

          // Updating SG info variables
          totalDeposits += 1;
          totalStaked = totalStaked.add(txData.value);
          totalDeposited = totalDeposited.add(txData.value);

          // Wait for sync
          await waitForSubgraphToBeSynced();

          const response = (await subgraph({
            query,
          })) as FetchResult;

          const data = response.data.stakeHolder;

          const holderBalance = await stake.balanceOf(signer1.address);
          const tokenPoolSize = await token.balanceOf(stake.address);
          const stakeTotalSupply = await stake.totalSupply();

          expect(data.balance).equal(holderBalance);
          expect(data.totalStake).equal(totalStaked);
          expect(data.deposits).to.deep.include({
            id: depositTx.hash,
          });

          // Making sure that any tx is removed
          expect(data.deposits).to.have.lengthOf(totalDeposits);
          expect(data.withdraws).to.have.lengthOf(totalWithdraws);

          // (balance * StakeToken.tokenPoolSize) / StakeToken.totalSupply
          expect(FixedNumber.from(data.totalEntitlement).toString()).equal(
            divBNOrFixed(
              holderBalance.mul(tokenPoolSize),
              stakeTotalSupply
            ).toString()
          );
        } else {
          // Withdraw tx;
          const withdrawTx = await stake
            .connect(signer1)
            .withdraw(txData.value, signer1.address, signer1.address);

          // Updating SG info variables
          totalWithdraws += 1;
          totalStaked = totalStaked.sub(txData.value);

          // Wait for sync
          await waitForSubgraphToBeSynced();

          const response = (await subgraph({
            query,
          })) as FetchResult;

          const data = response.data.stakeHolder;

          const holderBalance = await stake.balanceOf(signer1.address);
          const tokenPoolSize = await token.balanceOf(stake.address);
          const stakeTotalSupply = await stake.totalSupply();

          // if (i == 7 || i == 8) {
          //   //
          //   console.log(JSON.stringify(response, null, 2));
          //   console.log("holderBalance: ", holderBalance);
          //   console.log("tokenPoolSize: ", tokenPoolSize);
          //   console.log("stakeTotalSupply: ", stakeTotalSupply);
          // }

          expect(data.balance).equal(holderBalance);
          expect(data.totalStake).equal(totalStaked);
          expect(data.withdraws).to.deep.include({
            id: withdrawTx.hash,
          });

          // Making sure that any tx is removed
          expect(data.deposits).to.have.lengthOf(totalDeposits);
          expect(data.withdraws).to.have.lengthOf(totalWithdraws);

          // (balance * StakeToken.tokenPoolSize) / StakeToken.totalSupply
          expect(FixedNumber.from(data.totalEntitlement).toString()).equal(
            divBNOrFixed(
              holderBalance.mul(tokenPoolSize),
              stakeTotalSupply
            ).toString()
          );
        }
      }
    });

    it("should update StakeHolder after User/Anon send reserve token to Stake directly", async () => {
      const { _stake: stake, _reserveToken: token } = await deployStake(
        deployer
      );

      // ================== PART 0 =================================
      const tokenPoolSize0_ = await token.balanceOf(stake.address);
      const totalSupply0_ = await stake.totalSupply();
      const amountToDeposit_0 = BigNumber.from("1000" + Util.sixZeros);

      // Checking init values
      expect(tokenPoolSize0_).to.be.equals(totalSupply0_);
      expect(tokenPoolSize0_).to.be.equals("0");

      // signer1 deposits reserve tokens
      await token.transfer(signer1.address, amountToDeposit_0.mul(2));
      await token
        .connect(signer1)
        .approve(stake.address, amountToDeposit_0.mul(2));

      // First deposit
      await stake.connect(signer1).deposit(amountToDeposit_0, signer1.address);

      // Second deposit
      await stake.connect(signer1).deposit(amountToDeposit_0, signer1.address);

      await waitForSubgraphToBeSynced();

      const query = `
        {
          stakeERC20(id: "${stake.address.toLowerCase()}") {
            totalSupply
            tokenPoolSize
            tokenToStakeTokenRatio
            stakeTokenToTokenRatio
          }
        }
      `;

      const response_0 = (await subgraph({
        query,
      })) as FetchResult;

      const data_0 = response_0.data.stakeERC20;

      const tokenPoolSize_0 = await token.balanceOf(stake.address);
      const totalSupply_0 = await stake.totalSupply();

      expect(data_0.tokenPoolSize).to.be.equals(tokenPoolSize_0);
      expect(data_0.totalSupply).to.be.equals(totalSupply_0);

      expect(
        FixedNumber.from(data_0.tokenToStakeTokenRatio).toString()
      ).to.be.equals(divBNOrFixed(totalSupply_0, tokenPoolSize_0).toString());

      expect(
        FixedNumber.from(data_0.stakeTokenToTokenRatio).toString()
      ).to.be.equals(divBNOrFixed(tokenPoolSize_0, totalSupply_0).toString());

      // ================== PART 1 =================================

      // Some user send the Reserve Token directly to the Stake Contract
      const amountToDeposit_1 = BigNumber.from("2000" + Util.sixZeros);
      await token.transfer(stake.address, amountToDeposit_1);

      await waitForSubgraphToBeSynced();

      const response_1 = (await subgraph({
        query,
      })) as FetchResult;

      const data_1 = response_1.data.stakeERC20;

      const tokenPoolSize_1 = await token.balanceOf(stake.address);
      const totalSupply_1 = await stake.totalSupply();

      expect(data_1.tokenPoolSize).to.be.equals(tokenPoolSize_1);
      expect(data_1.totalSupply).to.be.equals(totalSupply_1);

      expect(
        FixedNumber.from(data_1.tokenToStakeTokenRatio).toString()
      ).to.be.equals(divBNOrFixed(totalSupply_1, tokenPoolSize_1).toString());

      expect(
        FixedNumber.from(data_1.stakeTokenToTokenRatio).toString()
      ).to.be.equals(divBNOrFixed(tokenPoolSize_1, totalSupply_1).toString());
    });
  });
});
