import { Address } from "@graphprotocol/graph-ts"
import { Verify, VerifyAddress, VerifyApprove, VerifyBan, VerifyRemove, VerifyRequestApprove, VerifyRequestBan, VerifyRequestRemove } from "../../generated/schema"
import { Approve, Ban, Remove, RequestApprove, RequestBan, RequestRemove, RoleAdminChanged, RoleGranted, RoleRevoked} from "../../generated/templates/VerifyTemplate/Verify"
import { RequestStatus, Role, Status } from "../utils"

export function handleApprove(event: Approve): void {
    let verifyApprove = new VerifyApprove(event.address.toHex() + " - " + event.transaction.hash.toHex())
    verifyApprove.block = event.block.number
    verifyApprove.transactionHash = event.transaction.hash
    verifyApprove.timestamp = event.block.timestamp
    verifyApprove.verifyContract = event.address
    verifyApprove.sender = event.params.sender
    verifyApprove.account = event.params.account
    verifyApprove.data = event.params.data
    verifyApprove.save()

    let verifyAddress = getverifyAddress(event.address.toHex(),event.params.account.toHex())
    verifyAddress.requestStatus = RequestStatus.NONE
    verifyAddress.status = Status.APPROVED
    let events  = verifyAddress.events
    events.push(verifyApprove.id)
    verifyAddress.events = events
    verifyAddress.save()

    let role = getverifyAddress(event.address.toHex(),event.params.sender.toHex())
    
    let roles = role.roles
    if(!roles.includes(Role.APPROVER))
        roles.push(Role.APPROVER)
    role.roles = roles

    let roleEvents  = role.events
    roleEvents.push(verifyApprove.id)
    role.events = roleEvents
    role.save()

    let verify = Verify.load(event.address.toHex())
    let approvers = verify.approvers
    if(!approvers.includes(role.id))
        approvers.push(role.id)
    verify.approvers = approvers
    
    let verifyAddresses = verify.verifyAddresses
    if(!verifyAddresses.includes(role.id))
        verifyAddresses.push(role.id)
    verify.verifyAddresses = verifyAddresses
    verify.save()

}

export function handleBan(event: Ban): void {
    let ban = new VerifyBan(event.address.toHex() + " - " + event.transaction.hash.toHex())
    ban.block = event.block.number
    ban.transactionHash = event.transaction.hash
    ban.timestamp = event.block.timestamp
    ban.verifyContract = event.address
    ban.sender = event.params.sender
    ban.account = event.params.account
    ban.data = event.params.data
    ban.save()

    let verifyAddress = getverifyAddress(event.address.toHex(),event.params.account.toHex())
    verifyAddress.requestStatus = RequestStatus.NONE
    verifyAddress.status = Status.BANNED
    let events  = verifyAddress.events
    events.push(ban.id)
    verifyAddress.events = events
    verifyAddress.save()

    let role = getverifyAddress(event.address.toHex(),event.params.sender.toHex())
    
    let roles = role.roles
    if(!roles.includes(Role.BANNER))
        roles.push(Role.BANNER)
    role.roles = roles    

    let roleEvents  = role.events
    roleEvents.push(ban.id)
    role.events = roleEvents
    role.save()

    let verify = Verify.load(event.address.toHex())
    let banners = verify.banners
    if(!banners.includes(role.id))
        banners.push(role.id)
    verify.banners = banners

    let verifyAddresses = verify.verifyAddresses
    if(!verifyAddresses.includes(role.id))
        verifyAddresses.push(role.id)
    verify.verifyAddresses = verifyAddresses
    verify.save()
}

export function handleRemove(event: Remove): void {
    let verifyRemove = new VerifyRemove(event.address.toHex() + " - " + event.transaction.hash.toHex())
    verifyRemove.block = event.block.number
    verifyRemove.transactionHash = event.transaction.hash
    verifyRemove.timestamp = event.block.timestamp
    verifyRemove.verifyContract = event.address
    verifyRemove.sender = event.params.sender
    verifyRemove.account = event.params.account
    verifyRemove.data = event.params.data
    verifyRemove.save()

    let verifyAddress = getverifyAddress(event.address.toHex(),event.params.account.toHex())
    verifyAddress.requestStatus = RequestStatus.NONE
    verifyAddress.status = Status.REMOVED
    let events  = verifyAddress.events
    events.push(verifyRemove.id)
    verifyAddress.events = events
    verifyAddress.save()

    let role = getverifyAddress(event.address.toHex(),event.params.sender.toHex())
    
    let roles = role.roles
    if(!roles.includes(Role.REMOVER))
    roles.push(Role.REMOVER)
    role.roles = roles

    let roleEvents  = role.events
    roleEvents.push(verifyRemove.id)
    role.events = roleEvents
    role.save()

    let verify = Verify.load(event.address.toHex())
    let removers = verify.removers
    if(!removers.includes(role.id))
        removers.push(role.id)
    verify.removers = removers

    let verifyAddresses = verify.verifyAddresses
    if(!verifyAddresses.includes(role.id))
        verifyAddresses.push(role.id)
    verify.verifyAddresses = verifyAddresses
    verify.save()
}

export function handleRequestApprove(event: RequestApprove): void {
    let verifyRequestApprove = new VerifyRequestApprove(event.address.toHex() + " - " + event.transaction.hash.toHex())
    verifyRequestApprove.block = event.block.number
    verifyRequestApprove.timestamp = event.block.timestamp
    verifyRequestApprove.transactionHash = event.transaction.hash
    verifyRequestApprove.verifyContract = event.address
    verifyRequestApprove.sender = event.params.sender
    verifyRequestApprove.account = event.params.sender
    verifyRequestApprove.data = event.params.data
    verifyRequestApprove.save()


    let verifyAddress = getverifyAddress(event.address.toHex(),event.params.sender.toHex())
    verifyAddress.requestStatus = RequestStatus.REQUEST_APPROVE
    
    let verify = Verify.load(event.address.toHex())
    let verifyAddresses = verify.verifyAddresses
    if(!verifyAddresses.includes(verifyAddress.id))
        verifyAddresses.push(verifyAddress.id)
    verify.verifyAddresses = verifyAddresses
    verify.save()
 
    let events  = verifyAddress.events
    events.push(verifyRequestApprove.id)
    verifyAddress.events = events
    
    verifyAddress.save()
}

export function handleRequestBan(event: RequestBan): void {
    let verifyRequestBan = new VerifyRequestBan(event.address.toHex() + " - " + event.transaction.hash.toHex())
    verifyRequestBan.block = event.block.number
    verifyRequestBan.timestamp = event.block.timestamp
    verifyRequestBan.transactionHash = event.transaction.hash
    verifyRequestBan.verifyContract = event.address
    verifyRequestBan.sender = event.params.sender
    verifyRequestBan.account = event.params.account
    verifyRequestBan.data = event.params.data
    verifyRequestBan.save()

    let verifyAddress = VerifyAddress.load(event.address.toHex() + " - " + event.params.account.toHex())
    verifyAddress.requestStatus = RequestStatus.REQUEST_BAN
    let events  = verifyAddress.events
    events.push(verifyRequestBan.id)
    verifyAddress.events = events
    verifyAddress.save()
}

export function handleRequestRemove(event: RequestRemove): void {
    let verifyRequestRemove = new VerifyRequestRemove(event.address.toHex() + " - " + event.transaction.hash.toHex())
    verifyRequestRemove.block = event.block.number
    verifyRequestRemove.timestamp = event.block.timestamp
    verifyRequestRemove.transactionHash = event.transaction.hash
    verifyRequestRemove.verifyContract = event.address
    verifyRequestRemove.sender = event.params.sender
    verifyRequestRemove.account = event.params.account
    verifyRequestRemove.data = event.params.data
    verifyRequestRemove.save()

    let verifyAddress = getverifyAddress(event.address.toHex(),event.params.account.toHex())
    verifyAddress.requestStatus = RequestStatus.REQUEST_REMOVE
    let events  = verifyAddress.events
    events.push(verifyRequestRemove.id)
    verifyAddress.events = events
    verifyAddress.save()
}

export function handleRoleAdminChanged(event: RoleAdminChanged): void {

}

export function handleRoleGranted(event: RoleGranted): void {

}

export function handleRoleRevoked(event: RoleRevoked): void {

}

function getverifyAddress(verifyContract: string, account: string): VerifyAddress {
    let verifyAddress = VerifyAddress.load(verifyContract + " - " + account)
    if(verifyAddress == null){
        verifyAddress = new VerifyAddress(verifyContract + " - " + account)
        verifyAddress.verifyContract = verifyContract
        verifyAddress.address = Address.fromString(account)
        verifyAddress.status = Status.NONE
        verifyAddress.requestStatus = RequestStatus.NONE
        verifyAddress.roles = []
        verifyAddress.events = []
    }
    return verifyAddress as VerifyAddress 
}