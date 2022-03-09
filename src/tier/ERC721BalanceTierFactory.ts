/* eslint-disable prefer-const */
import {
  NewChild,
  Implementation,
} from "../../generated/ERC20BalanceTierFactory/ERC20BalanceTierFactory";
import { ERC721BalanceTier as ERC721BalanceTierContarct } from "../../generated/templates/ERC721BalanceTierTemplate/ERC721BalanceTier";
import {
  ERC721BalanceTierFactory,
  ERC721BalanceTier,
} from "../../generated/schema";
import { ERC721BalanceTierTemplate } from "../../generated/templates";

export function handleNewChild(event: NewChild): void {
  let erc721BalanceTierFactory = ERC721BalanceTierFactory.load(
    event.address.toHex()
  );

  let erc721BalanceTier = new ERC721BalanceTier(event.params.child.toHex());
  let erc20BalanceTierContract = ERC721BalanceTierContarct.bind(
    event.params.child
  );

  erc721BalanceTier.address = event.params.child;
  erc721BalanceTier.deployBlock = event.block.number;
  erc721BalanceTier.deployTimestamp = event.block.timestamp;
  erc721BalanceTier.deployer = event.transaction.from;
  erc721BalanceTier.factory = event.address.toHex();
  erc721BalanceTier.tierValues = erc20BalanceTierContract.tierValues();
  erc721BalanceTier.notices = [];

  if (erc721BalanceTierFactory) {
    let children = erc721BalanceTierFactory.children;
    if (children) children.push(erc721BalanceTier.id);
    erc721BalanceTierFactory.children = children;

    erc721BalanceTierFactory.save();
  }

  erc721BalanceTier.save();

  ERC721BalanceTierTemplate.create(event.params.child);
}

export function handleImplementation(event: Implementation): void {
  let erc20BalanceTierFactory = new ERC721BalanceTierFactory(
    event.address.toHex()
  );
  erc20BalanceTierFactory.implementation = event.params.implementation;
  erc20BalanceTierFactory.address = event.address;
  erc20BalanceTierFactory.children = [];
  erc20BalanceTierFactory.save();
}
