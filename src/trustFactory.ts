/* eslint-disable prettier/prettier */
import { NewChild, Implementation } from '../generated/TrustFactory/TrustFactory'
import {
    TrustFactory,
    Trust
} from '../generated/schema'
import { TrustTemplate } from "../generated/templates"
import { ZERO_BI, ONE_BI } from './utils'
import { log } from '@graphprotocol/graph-ts'
export function handleNewChild(event: NewChild): void {
    let trustFactory = TrustFactory.load(event.address.toHex())

    let trust = new Trust(event.params.child.toHex())
    trust.factory = event.address
    trust.creator = event.params.sender
    trust.block = event.block.number
    trust.timestamp = event.block.timestamp
    trust.trustParticipants = []
    trust.notices = []
    
    trust.save()

    let trusts = trustFactory.trusts
    trusts.push(trust.id)
    trustFactory.trusts = trusts
    trustFactory.trustCount = trustFactory.trustCount.plus(ONE_BI)
    trustFactory.save()
 
    TrustTemplate.create(event.params.child)
}

export function handleImplementation(event: Implementation): void {
    let trustFactory = TrustFactory.load(event.address.toHex())
    if(trustFactory ==  null){
        trustFactory = new TrustFactory(event.address.toHex())
        trustFactory.trustCount = ZERO_BI
        trustFactory.trusts = []
    }

    trustFactory.save()
    log.info("Factory is created.", [])
}