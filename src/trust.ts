/* eslint-disable prefer-const */
/* eslint-disable prettier/prettier */
import {
    Construction,
    CreatorFundsRelease,
    EndDutchAuction,
    Initialize,
    Notice,
    PhaseScheduled,
    StartDutchAuction
} from '../generated/TrustFactory/Trust'

import { Contract, Notice as NoticeScheme, Trust } from "../generated/schema"

export function handleConstruction(event: Construction): void {
    // let trustAddress = event.address
    // let trust = Trust.load(trustAddress.toHex())

    // let contract = new Contract(trustAddress.toHex())

    // trust.contracts = contract.id
    // trust.save()
}
export function handleCreatorFundsRelease(event: CreatorFundsRelease): void {

}
export function handleEndDutchAuction(event: EndDutchAuction): void {

}
export function handleInitialize(event: Initialize): void {

}
export function handleNotice(event: Notice): void {
    let trustAddress = event.address
    let trust = Trust.load(trustAddress.toHex())

    let notice = new NoticeScheme(event.transaction.hash.toHex())
    notice.trust = trust.id
    notice.data = event.params.data
    notice.sender = event.params.sender
    notice.block = event.block.number
    notice.timestamp = event.block.timestamp

    let notices = trust.notices
    notices.push(notice.id)
    trust.notices = notices

    trust.save()
    notice.save()
}
export function handlePhaseScheduled(event: PhaseScheduled): void {

}
export function handleStartDutchAuction(event: StartDutchAuction): void {

}