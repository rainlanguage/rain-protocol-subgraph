import { VerifyTier } from "../../generated/schema";
import { Initialize, TierChange } from "../../generated/templates/VerifyTierTemplate/VerifyTier";

export function handleInitialize(event: Initialize): void {
    let verifyTier = VerifyTier.load(event.address.toHex())
    verifyTier.deployer = event.params.verify
    verifyTier.save()
}

export function handleTierChange(event: TierChange): void {
}