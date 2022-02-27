/* eslint-disable prettier/prettier */
import { NewChild, Implementation } from '../../generated/TrustFactory/TrustFactory'
import {
    TrustFactory,
    Trust
} from '../../generated/schema'
import { TrustTemplate } from "../../generated/templates"
import { ZERO_BI, ONE_BI, SaleStatus } from '../utils'
import { log, Address, DataSourceContext } from '@graphprotocol/graph-ts'
export function handleNewChild(event: NewChild): void {
    let trustFactory = TrustFactory.load(event.address.toHex())

    let trust = new Trust(event.params.child.toHex())
    trust.factory = event.address
    trust.creator = event.params.sender
    trust.deployBlock = event.block.number
    trust.deployTimestamp = event.block.timestamp
    trust.saleStatus = SaleStatus.Pending
    trust.trustParticipants = []
    trust.notices = []
    trust.save()

    let trusts = trustFactory.trusts
    trusts.push(trust.id)
    trustFactory.trusts = trusts
    trustFactory.trustCount = trustFactory.trustCount.plus(ONE_BI)
    trustFactory.save()
 
    TrustTemplate.create(event.params.child)
    log.info("NewChild Block Number : {}", [event.block.number.toString()])
}

export function handleImplementation(event: Implementation): void {
    let trustFactory = TrustFactory.load(event.address.toHex())
    if(trustFactory ==  null){
        trustFactory = new TrustFactory(event.address.toHex())
        trustFactory.trustCount = ZERO_BI
        trustFactory.trusts = []
    }

    let context = new DataSourceContext()
    context.setBytes("factory", event.address)
    TrustTemplate.createWithContext(event.params.implementation, context)
    trustFactory.save()
    log.info("Factory is created.", [])
}