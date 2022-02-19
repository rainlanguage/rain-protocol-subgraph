/* eslint-disable prettier/prettier */
import { NewChild, Implementation } from '../../generated/VerifyFactory/VerifyFactory'
import { VerifyFactory, Verify } from '../../generated/schema'
import { VerifyTemplate } from "../../generated/templates"

export function handleNewChild(event: NewChild): void {
    let verifyFactory = VerifyFactory.load(event.address.toHex())
    
    let verify = new Verify(event.params.child.toHex())
    verify.address = event.params.child
    verify.deployBlock = event.block.number
    verify.deployTimestamp = event.block.timestamp
    verify.deployer = event.transaction.from
    verify.factory = verifyFactory.id
    verify.verifyAddresses = []
    verify.save()

    let children = verifyFactory.children
    children.push(verify.id)
    verifyFactory.children = children
    verifyFactory.save()

    VerifyTemplate.create(event.params.child)
}

export function handleImplementation(event: Implementation): void {
    let verifyFactory = new VerifyFactory(event.address.toHex())
    verifyFactory.address = event.address
    verifyFactory.implementation = event.params.implementation
    verifyFactory.children = []
    verifyFactory.save()
}

