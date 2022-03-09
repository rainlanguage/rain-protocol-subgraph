import { Initialize, Claim, Transfer, Snapshot, EmissionsERC20 as EmissionsERC20Contract} from "../../generated/templates/EmissionsERC20Template/EmissionsERC20"
import {EmissionsERC20, EmissionsERC20Claim, State } from "../../generated/schema"
import { ZERO_ADDRESS } from "../utils"
export function handleInitialize(event: Initialize): void {
    let emissionsERC20 = EmissionsERC20.load(event.address.toHex())
    if (emissionsERC20){
        emissionsERC20.allowDelegatedClaims = event.params.allowDelegatedClaims
        emissionsERC20.save()
    }
}

export function handleClaim(event: Claim): void {
    let emissionsERC20Claim = new EmissionsERC20Claim(event.transaction.hash.toHex())
    emissionsERC20Claim.block = event.block.number
    emissionsERC20Claim.timestamp = event.block.timestamp
    emissionsERC20Claim.sender = event.params.sender
    emissionsERC20Claim.claimant = event.params.claimant
    emissionsERC20Claim.data = event.params.data
    emissionsERC20Claim.emissionsERC20 = event.address.toHex()
    emissionsERC20Claim.save()

    let emissionsERC20 = EmissionsERC20.load(event.address.toHex())
    if(emissionsERC20){
        let claims = emissionsERC20.claims
        if (claims) claims.push(emissionsERC20Claim.id)
        emissionsERC20.claims = claims
        emissionsERC20.save()
    }
}

export function handleSnapshot(event: Snapshot): void {
    let calculateClaimStateConfig = new State(event.transaction.hash.toHex())
    calculateClaimStateConfig.sources = event.params.state.sources
    calculateClaimStateConfig.constants = event.params.state.constants
    calculateClaimStateConfig.arguments = event.params.state.arguments
    calculateClaimStateConfig.stackIndex = event.params.state.stackIndex
    calculateClaimStateConfig.save()

    let emissionsERC20 = EmissionsERC20.load(event.address.toHex())
    if (emissionsERC20){
        emissionsERC20.calculateClaimStateConfig = calculateClaimStateConfig.id
        emissionsERC20.save()
    }

}

export function handleTransfer(event: Transfer): void {
    let emissionsERC20Claim = EmissionsERC20Claim.load(event.transaction.hash.toHex())
    if (emissionsERC20Claim){
        emissionsERC20Claim.amount = event.params.value
        emissionsERC20Claim.save()
    }

    if(event.params.from.toHex() == ZERO_ADDRESS){
        let emissionsERC20Contract = EmissionsERC20Contract.bind(event.address)
        let emissionsERC20 = EmissionsERC20.load(event.address.toHex())
        if(emissionsERC20){
            emissionsERC20.totalSupply = emissionsERC20Contract.totalSupply()
            emissionsERC20.save()
        }
    }
}