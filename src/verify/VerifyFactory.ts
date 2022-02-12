/* eslint-disable prettier/prettier */
import { NewChild, Implementation } from '../../generated/VerifyFactory/VerifyFactory'
import {
    VerifyFactory,
    Verify
} from '../../generated/schema'
export function handleNewChild(event: NewChild): void {
    let verifyFactory = VerifyFactory.load(event.address.toHex())
    
    let verifyTier = new Verify(event.params.child.toHex())
    verifyTier.address = event.params.child
    verifyTier.deployBlock = event.block.number
    verifyTier.deployTimestamp = event.block.timestamp
    verifyTier.deployer = event.params.sender
    verifyTier.factory = verifyFactory.id
    verifyTier.save()

    let children = verifyFactory.children
    children.push(verifyTier.id)
    verifyFactory.children = children
    verifyFactory.save()
}

export function handleImplementation(event: Implementation): void {
    let verifyFactory = new VerifyFactory(event.address.toHex())
    verifyFactory.address = event.address
    verifyFactory.implementation = event.params.implementation
    verifyFactory.children = []
    verifyFactory.save()
}
