import {
  NewChild,
  Implementation,
} from "../../generated/CombineTierFactory/CombineTierFactory";
import { CombineTier, CombineTierFactory } from "../../generated/schema";
import { CombineTierTemplate } from "../../generated/templates";

export function handleNewChild(event: NewChild): void {
  let combineTierFactory = CombineTierFactory.load(event.address.toHex());

  let combineTier = new CombineTier(event.params.child.toHex());

  combineTier.address = event.params.child;
  combineTier.deployBlock = event.block.number;
  combineTier.deployTimestamp = event.block.timestamp;
  combineTier.deployer = event.transaction.from;
  combineTier.factory = event.address.toHex();
  combineTier.notices = [];

  if (combineTierFactory) {
    let children = combineTierFactory.children;
    if (children) children.push(combineTier.id);
    combineTierFactory.children = children;

    combineTierFactory.save();
  }

  combineTier.save();

  CombineTierTemplate.create(event.params.child);
}

export function handleImplementation(event: Implementation): void {
  let combineFactory = new CombineTierFactory(event.address.toHex());
  combineFactory.implementation = event.params.implementation;
  combineFactory.address = event.address;
  combineFactory.children = [];
  combineFactory.save();
}
