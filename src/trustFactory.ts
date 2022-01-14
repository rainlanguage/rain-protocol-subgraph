import { NewChild } from '../generated/TrustFactory/TrustFactory'
import {
    TrustFactory
} from '../generated/schema'

import { ZERO_BI } from './utils'
export function handleNewChild(event: NewChild): void {
    let trustFactory = TrustFactory.load(event.address.toHex())
    if(trustFactory ==  null){
        trustFactory = new TrustFactory(event.address.toHex())
        trustFactory.trustCount = ZERO_BI
        trustFactory.trusts = []
    }

    trustFactory.save()
}