import {
  Implementation,
  NewChild,
} from "../../generated/StakeFactory/StakeFactory";
import { StakeFactory, StakeERC20 } from "../../generated/schema";
import { ZERO_ADDRESS, ZERO_BI } from "../utils";
import { StakeERC20Template } from "../../generated/templates";
export function handleImplementation(event: Implementation): void {
  let stakeFactory = new StakeFactory(event.address.toHex());
  stakeFactory.implementation = event.params.implementation;
  stakeFactory.children = [];
  stakeFactory.address = event.address;
  stakeFactory.save();
}

export function handleNewChild(event: NewChild): void {
  let stakeFactory = StakeFactory.load(event.address.toHex());
  if (stakeFactory) {
    let stakeERC20 = new StakeERC20(event.params.child.toHex());
    stakeERC20.address = event.params.child;
    stakeERC20.deployer = event.params.sender;
    stakeERC20.deployBlock = event.block.number;
    stakeERC20.deployTimestamp = event.block.timestamp;
    stakeERC20.factory = stakeFactory.id;
    stakeERC20.token = ZERO_ADDRESS;
    stakeERC20.tokenPoolSize = ZERO_BI;
    stakeERC20.initialRatio = ZERO_BI;
    stakeERC20.tokenToStakeTokenRatio = ZERO_BI;
    stakeERC20.stateTokenToTokenRatio = ZERO_BI;
    stakeERC20.deposits = [];
    stakeERC20.withdraws = [];
    stakeERC20.holders = [];

    stakeERC20.save();

    let children = stakeFactory.children;
    if (children) children.push(stakeERC20.id);
    stakeFactory.children = children;
    stakeFactory.save();

    StakeERC20Template.create(event.params.child);
  }
}
