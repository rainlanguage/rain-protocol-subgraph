import { CombineTier, State } from "../../generated/schema";
import {
  Snapshot as SnapshotEvent,
  TierChange,
} from "../../generated/templates/CombineTierTemplate/CombineTier";

export function handleTierChange(event: TierChange): void {
  //
}

export function handleSnapshot(event: SnapshotEvent): void {
  let combineTier = CombineTier.load(event.address.toHex());

  let state = new State(event.transaction.hash.toHex());
  state.arguments = event.params.state.arguments;
  state.stack = event.params.state.stack;
  state.stackIndex = event.params.state.stackIndex;
  state.constants = event.params.state.constants;
  state.sources = event.params.state.sources;
  state.save();

  if (combineTier) {
    combineTier.state = state.id;
    combineTier.save();
  }
}
