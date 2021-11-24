import { dataSource } from "@graphprotocol/graph-ts"
import { Notice as EVENT} from "../generated/RainProtocol/Trust"
import { Notice, Trust } from "../generated/schema"

export function handleNotice(event: EVENT): void {
    let trustAddress = dataSource.address()
    let trust = Trust.load(trustAddress.toHex())

    let notice = new Notice(event.transaction.hash.toHex())
    notice.block = event.block.number
    notice.timestamp = event.block.timestamp
    notice.data = event.params.data
    notice.sender = event.params.sender
    notice.trust = trust.id
    notice.save()

    let notices = trust.notices
    notices.push(notice.id)
    trust.notices = notices
    trust.save()
}