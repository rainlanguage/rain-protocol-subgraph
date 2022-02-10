import { NewChild, Implementation } from "../../generated/VerifyTierFactory/VerifyTierFactory"
import { VerifyTierFactory, VerifyTier } from "../../generated/schema"
import { VerifyTierTemplate } from "../../generated/templates"

export function handleNewChild(event: NewChild): void {
    let verifyTierFactory = VerifyTierFactory.load(event.address.toHex())

    let verifyTier = new VerifyTier(event.params.child.toHex())
    
    verifyTier.address = event.params.child
    verifyTier.deployBlock = event.block.number
    verifyTier.deployTimestamp = event.block.timestamp
    verifyTier.factory = event.address.toHex()

    let children = verifyTierFactory.children
    children.push(verifyTier.id)
    verifyTierFactory.children = children

    verifyTierFactory.save()

    verifyTier.save()

    VerifyTierTemplate.create(event.params.child)
}

export function handleImplementation(event: Implementation): void {
    let verifyTierFactory = new VerifyTierFactory(event.address.toHex())
    verifyTierFactory.implementation = event.params.implementation
    verifyTierFactory.address = event.address
    verifyTierFactory.children = []
    verifyTierFactory.save()
}
