import {
  Implementation,
  NewChild,
} from "../../generated/ERC20TransferTierFactory/ERC20TransferTierFactory";
import {
  ERC20TransferTierFactory,
  ERC20TransferTier,
} from "../../generated/schema";
import { ERC20TransferTier as ERC20TransferTierContract } from "../../generated/ERC20TransferTierFactory/ERC20TransferTier";
import { ERC20TransferTierTemplate } from "../../generated/templates";

export function handleImplementation(event: Implementation): void {
  let erc20TransferTierFactory = new ERC20TransferTierFactory(
    event.address.toHex()
  );
  erc20TransferTierFactory.address = event.address;
  1;
  erc20TransferTierFactory.implementation = event.params.implementation;
  erc20TransferTierFactory.children = [];
  erc20TransferTierFactory.save();
}

export function handleNewChild(event: NewChild): void {
  let erc20TransferTierFactory = ERC20TransferTierFactory.load(
    event.address.toHex()
  );

  let erc20TransferTierContract = ERC20TransferTierContract.bind(
    event.params.child
  );
  let erc20TransferTier = new ERC20TransferTier(event.params.child.toHex());

  erc20TransferTier.address = event.params.child;
  erc20TransferTier.deployBlock = event.block.number;
  erc20TransferTier.deployTimestamp = event.block.timestamp;
  erc20TransferTier.deployer = event.transaction.from;
  erc20TransferTier.factory = event.address.toHex();
  erc20TransferTier.tierValues = erc20TransferTierContract.tierValues();
  erc20TransferTier.notices = [];

  erc20TransferTier.tierChanges = [];
  erc20TransferTier.tierLevels = [];

  if (erc20TransferTierFactory) {
    let children = erc20TransferTierFactory.children;
    if (children) children.push(erc20TransferTier.id);
    erc20TransferTierFactory.children = children;

    erc20TransferTierFactory.save();
  }

  erc20TransferTier.save();

  ERC20TransferTierTemplate.create(event.params.child);
}
