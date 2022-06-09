import {
  StakeDeposit,
  StakeERC20,
  StakeHolder,
  StakeWithdraw,
} from "../../generated/schema";
import {
  Initialize,
  Approval,
  Transfer,
  Stake,
} from "../../generated/templates/StakeERC20Template/Stake";
import { getERC20, ZERO_ADDRESS, ZERO_BI } from "../utils";

export function handleInitialize(event: Initialize): void {
  let stakeContract = Stake.bind(event.address);
  let stakeERC20 = StakeERC20.load(event.address.toHex());
  if (stakeERC20) {
    stakeERC20.name = event.params.config.name;
    stakeERC20.symbol = event.params.config.symbol;
    stakeERC20.decimals = stakeContract.decimals();
    stakeERC20.totalSupply = stakeContract.totalSupply();
    stakeERC20.initialRatio = event.params.config.initialRatio;

    let token = getERC20(event.params.config.token, event.block);
    if (token) stakeERC20.token = token.id;

    stakeERC20.save();
  }
}

export function handleApproval(event: Approval): void {}

export function handleTransfer(event: Transfer): void {
  let stakeERC20 = StakeERC20.load(event.address.toHex());
  if (stakeERC20) {
    if (event.params.from.toHex() == stakeERC20.id) {
      stakeERC20.tokenPoolSize = stakeERC20.tokenPoolSize.plus(
        event.params.value
      );

      stakeERC20.tokenToStakeTokenRatio = stakeERC20.totalSupply.div(
        stakeERC20.tokenPoolSize
      );

      stakeERC20.stateTokenToTokenRatio = stakeERC20.tokenPoolSize.div(
        stakeERC20.totalSupply
      );

      stakeERC20.save();
    }
    if (event.params.from.toHex() == ZERO_ADDRESS) {
      // Deposit
      let stakeDeposit = new StakeDeposit(event.transaction.hash.toHex());
      stakeDeposit.depositor = event.params.to;
      stakeDeposit.stakeToken = event.address.toHex();
      stakeDeposit.token = stakeERC20.token;
      stakeDeposit.stakeTokenMinted = event.params.value;
      stakeDeposit.save();

      let deposits = stakeERC20.deposits;
      if (deposits) deposits.push(stakeDeposit.id);
      stakeERC20.deposits = deposits;
      stakeERC20.save();
    }

    if (event.params.to.toHex() == ZERO_ADDRESS) {
      // Deposit
      let stakeWithdraw = new StakeWithdraw(event.transaction.hash.toHex());
      stakeWithdraw.withdrawer = event.params.from;
      stakeWithdraw.stakeToken = event.address.toHex();
      stakeWithdraw.token = stakeERC20.token;
      stakeWithdraw.stakeTokenMinted = event.params.value;
      stakeWithdraw.save();

      let withdraws = stakeERC20.withdraws;
      if (withdraws) withdraws.push(stakeWithdraw.id);
      stakeERC20.withdraws = withdraws;
      stakeERC20.save();
    }

    if (event.params.to.toHex() != ZERO_ADDRESS) {
      let stakeHolder = StakeHolder.load(
        event.address.toHex() + "-" + event.params.to.toHex()
      );
      if (!stakeHolder) {
        stakeHolder = new StakeHolder(
          event.address.toHex() + "-" + event.params.to.toHex()
        );
        stakeHolder.address = event.params.to;
        stakeHolder.token = stakeERC20.id;
        stakeHolder.balance = ZERO_BI;

        let holders = stakeERC20.holders;
        if (holders) holders.push(stakeHolder.id);
        stakeERC20.holders = holders;
        stakeERC20.save();
      }
      stakeHolder.balance = stakeHolder.balance.plus(event.params.value);
      stakeHolder.totalEntitlement = stakeHolder.balance
        .times(stakeERC20.tokenPoolSize)
        .div(stakeERC20.totalSupply);
      stakeHolder.save();
    }
  }
}
