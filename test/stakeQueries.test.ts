import { expect } from "chai";
import { ethers } from "hardhat";
import * as Util from "./utils/utils";
import { waitForSubgraphToBeSynced } from "./utils/utils";

import {
  // Subgraph
  subgraph,
  // Signers
  deployer,
  signer1,
  // Contracts factories
  stakeFactory,
  signer2,
} from "./initialization.test";

// Typechain Factories
import { ReserveToken__factory } from "../typechain/factories/ReserveToken__factory";

// Types
import type { FetchResult } from "apollo-fetch";
import type { ReserveToken } from "../typechain/ReserveToken";
import type {
  Stake,
  StakeConfigStruct,
  TransferEvent,
} from "../typechain/Stake";

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { BigNumber, FixedNumber } = ethers;

async function deployStake(
  deployerAccount: SignerWithAddress,
  config?: StakeConfigStruct
): Promise<{
  _stake: Stake;
  _reserveToken: ReserveToken;
  _stakeConfig: StakeConfigStruct;
}> {
  let _stakeConfig: StakeConfigStruct = config;
  let _reserveToken: ReserveToken;

  if (!config) {
    _reserveToken = await new ReserveToken__factory(deployerAccount).deploy();
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

describe.only("Stake queries - Test", function () {
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
        Util.divBNOrFixed(data.totalSupply, tokenPoolSizeExpected).toString()
      );
      expect(
        FixedNumber.from(data.stakeTokenToTokenRatio).toString()
      ).to.be.equals(
        Util.divBNOrFixed(tokenPoolSizeExpected, data.totalSupply).toString()
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
        Util.divBNOrFixed(data.totalSupply, tokenPoolSizeExpected).toString()
      );
      expect(
        FixedNumber.from(data.stakeTokenToTokenRatio).toString()
      ).to.be.equals(
        Util.divBNOrFixed(tokenPoolSizeExpected, data.totalSupply).toString()
      );

      expect(data.withdraws).to.deep.include({
        id: withdrawTx.hash,
      });
    });
  });

  xdescribe("StakeHolder queries", () => {
    it("should query a StakeHolder after a deposit correctly", async () => {
      const { _stake, _reserveToken } = await deployStake(deployer);

      const tokenPoolSize0_ = await _reserveToken.balanceOf(_stake.address);
      const totalSupply0_ = await _stake.totalSupply();
      const amountToDeposit = BigNumber.from("1000" + Util.sixZeros);

      // Checking init values
      expect(tokenPoolSize0_).to.be.equals(totalSupply0_);
      expect(tokenPoolSize0_).to.be.equals("0");

      // signer1 deposits reserve tokens
      await _reserveToken.transfer(signer1.address, amountToDeposit);
      await _reserveToken
        .connect(signer1)
        .approve(_stake.address, amountToDeposit);
      const depositTx = await _stake
        .connect(signer1)
        .deposit(amountToDeposit, signer1.address);

      const { value } = (await Util.getEventArgs(
        depositTx,
        "Transfer",
        _stake
      )) as TransferEvent["args"];

      const signer1StakeBalance = await _stake.balanceOf(signer1.address);

      expect(signer1StakeBalance).to.be.equals(value);

      expect(await _reserveToken.balanceOf(_stake.address)).to.be.equals(
        await _stake.totalSupply()
      );

      await waitForSubgraphToBeSynced();

      const stakeHolder = `${_stake.address.toLowerCase()}-${signer1.address.toLowerCase()}`;

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
      expect(data.token.id).to.be.equals(_reserveToken.address.toLowerCase());
      expect(data.stakeToken.id).to.be.equals(_stake.address.toLowerCase());

      expect(data.balance).to.be.equals(signer1StakeBalance);
      expect(data.totalStake).to.be.equals(amountToDeposit);
      expect(data.totalDeposited).to.be.equals(amountToDeposit);

      expect(data.deposits).to.have.lengthOf(1);
      expect(data.withdraws).to.be.empty;
    });
  });
});
