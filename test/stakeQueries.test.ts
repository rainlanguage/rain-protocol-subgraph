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
import { ReserveTokenTest__factory } from "../typechain/factories/ReserveTokenTest__factory";

// Types
import type { FetchResult } from "apollo-fetch";
import type { ReserveTokenTest } from "../typechain/ReserveTokenTest";
import type {
  Stake,
  StakeConfigStruct,
  TransferEvent,
} from "../typechain/Stake";

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function deployStake(
  deployerAccount: SignerWithAddress,
  config?: StakeConfigStruct
): Promise<{
  _stake: Stake;
  _reserveToken: ReserveTokenTest;
  _stakeConfig: StakeConfigStruct;
}> {
  let _stakeConfig: StakeConfigStruct = config;
  let _reserveToken: ReserveTokenTest;

  if (!config) {
    _reserveToken = await new ReserveTokenTest__factory(
      deployerAccount
    ).deploy();
    _stakeConfig = {
      name: "Stake Token",
      symbol: "STKN",
      token: _reserveToken.address,
      initialRatio: Util.ONE,
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

  describe.only("StakeERC20 queries", () => {
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
          initialRatio
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
      expect(data.initialRatio).to.be.equals(deployedConfig.initialRatio);
      expect(data.tokenToStakeTokenRatio).to.be.equals("0");
      expect(data.stakeTokenToTokenRatio).to.be.equals("0");

      expect(data.deposits).to.be.empty;
      expect(data.withdraws).to.be.empty;
      expect(data.holders).to.be.empty;
    });

    it("should update and query a StakeERC20 after deposits", async () => {
      const {
        _stake: stakeContract,
        _reserveToken: token,
        _stakeConfig,
      } = await deployStake(deployer);

      const tokenPoolSize0_ = await token.balanceOf(stakeContract.address);
      const totalSupply0_ = await stakeContract.totalSupply();
      const amountToDeposit = ethers.BigNumber.from("1000" + Util.sixZeros);

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
        .deposit(amountToDeposit);

      // Second deposit
      const depositTx2 = await stakeContract
        .connect(signer1)
        .deposit(amountToDeposit);

      // Values from events
      const { value: value1 } = (await Util.getEventArgs(
        depositTx1,
        "Transfer",
        stakeContract
      )) as TransferEvent["args"];

      const { value: value2 } = (await Util.getEventArgs(
        depositTx2,
        "Transfer",
        stakeContract
      )) as TransferEvent["args"];

      const signer1StakeBalance = await stakeContract.balanceOf(
        signer1.address
      );

      const tokenPoolSizeExpected = value1.add(value2);

      expect(signer1StakeBalance).to.be.equals(tokenPoolSizeExpected);

      expect(await token.balanceOf(stakeContract.address)).to.be.equals(
        await stakeContract.totalSupply()
      );

      await waitForSubgraphToBeSynced();

      const stakeHolder = `${stakeContract.address.toLowerCase()}-${signer1.address.toLowerCase()}`;

      await waitForSubgraphToBeSynced();

      const query = `
        {
          stakeERC20(id: "${stakeContract.address.toLowerCase()}") {
            totalSupply
            tokenPoolSize
            initialRatio
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
      expect(data.initialRatio).to.be.equals(
        _stakeConfig.initialRatio,
        "InitialRatio should not changed after deposits"
      );

      expect(data.tokenToStakeTokenRatio).to.be.equals(
        (await stakeContract.totalSupply()).div(tokenPoolSizeExpected)
      );
      expect(data.stakeTokenToTokenRatio).to.be.equals(
        tokenPoolSizeExpected.div(await stakeContract.totalSupply())
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

    it.only("should update and query a StakeERC20 after withdraw", async () => {
      //////////////
      const {
        _stake: stakeContract,
        _reserveToken: token,
        _stakeConfig,
      } = await deployStake(deployer);

      // Give Alice some reserve tokens and deposit them
      await token.transfer(
        signer1.address,
        ethers.BigNumber.from("1000" + Util.sixZeros)
      );
      const tokenBalanceSigner1 = await token.balanceOf(signer1.address);
      await token
        .connect(signer1)
        .approve(stakeContract.address, tokenBalanceSigner1);
      await stakeContract.connect(signer1).deposit(tokenBalanceSigner1);

      // Give Bob some reserve tokens and deposit them
      await token.transfer(
        signer2.address,
        ethers.BigNumber.from("1000" + Util.sixZeros)
      );
      const tokenBalanceSigner2 = await token.balanceOf(signer2.address);
      await token
        .connect(signer2)
        .approve(stakeContract.address, tokenBalanceSigner2);
      await stakeContract.connect(signer2).deposit(tokenBalanceSigner2);

      // Alice and Bob each own 50% of stToken supply
      const stTokenBalanceSigner1 = await stakeContract.balanceOf(
        signer1.address
      );

      const withdrawTx = await stakeContract
        .connect(signer1)
        .withdraw(stTokenBalanceSigner1.div(2));

      const newTokenBalanceSigner1 = await stakeContract.balanceOf(
        signer1.address
      );

      expect(newTokenBalanceSigner1.eq(stTokenBalanceSigner1.div(2)));

      const tokenPoolSizeExpected = tokenBalanceSigner1.add(
        newTokenBalanceSigner1
      );

      await waitForSubgraphToBeSynced();

      const query = `
        {
          stakeERC20(id: "${stakeContract.address.toLowerCase()}") {
            totalSupply
            tokenPoolSize
            initialRatio
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

      // console.log(JSON.stringify(response, null, 2));

      const data = response.data.stakeERC20;

      expect(data.totalSupply).to.be.equals(await stakeContract.totalSupply());
      expect(data.tokenPoolSize).to.be.equals(tokenPoolSizeExpected);
      expect(data.initialRatio).to.be.equals(
        _stakeConfig.initialRatio,
        "InitialRatio should not changed after withdraws"
      );

      expect(data.tokenToStakeTokenRatio).to.be.equals(
        (await stakeContract.totalSupply()).div(tokenPoolSizeExpected)
      );
      expect(data.stakeTokenToTokenRatio).to.be.equals(
        tokenPoolSizeExpected.div(await stakeContract.totalSupply())
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
      const amountToDeposit = ethers.BigNumber.from("1000" + Util.sixZeros);

      // Checking init values
      expect(tokenPoolSize0_).to.be.equals(totalSupply0_);
      expect(tokenPoolSize0_).to.be.equals("0");

      // signer1 deposits reserve tokens
      await _reserveToken.transfer(signer1.address, amountToDeposit);
      await _reserveToken
        .connect(signer1)
        .approve(_stake.address, amountToDeposit);
      const depositTx = await _stake.connect(signer1).deposit(amountToDeposit);

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
