import { CombineTier, Snapshot, State } from "../../generated/schema"
import { Snapshot as SnapshotEvent, TierChange } from "../../generated/templates/CombineTierTemplate/CombineTier"

export function handleTierChange( event: TierChange): void {
}

export function handleSnapshot( event: SnapshotEvent): void {
    let combineTier = CombineTier.load(event.address.toHex())
    
    let snapshot = new Snapshot(event.address.toHex())
    snapshot.sender = event.params.sender
    snapshot.pointer = event.params.pointer

    let state = new State(event.transaction.hash.toHex())
    state.arguments = event.params.state_.arguments
    state.stack = event.params.state_.stack
    state.stackIndex = event.params.state_.stackIndex
    state.constants = event.params.state_.constants
    state.sources = event.params.state_.sources
    state.save()

    snapshot.state = state.id
    snapshot.save()

    combineTier.state = state.id
    combineTier.save()
}