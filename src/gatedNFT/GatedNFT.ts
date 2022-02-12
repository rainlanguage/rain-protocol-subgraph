import { CreatedGatedNFT, OwnershipTransferred as OwnershipTransferredEvent, UpdatedRoyaltyRecipient as UpdatedRoyaltyRecipientEvent} from "../../generated/templates/GatedNFTTemplate/GatedNFT"
import { GatedNFT, UpdatedRoyaltyRecipient, OwnershipTransferred} from "../../generated/schema"
import { HUNDRED_BD } from "../utils"

export function handleCreatedGatedNFT(event: CreatedGatedNFT): void {
    let gatedNFT = GatedNFT.load(event.address.toHex())
    gatedNFT.name = event.params.config.name
    gatedNFT.symbol = event.params.config.symbol
    gatedNFT.creator = event.params.creator
    gatedNFT.minimumStatus = event.params.minimumStatus
    gatedNFT.maxMintable = event.params.maxMintable
    gatedNFT.maxPerAddress = event.params.maxPerAddress
    gatedNFT.transferrable = event.params.transferrable
    gatedNFT.royaltyRecipient = event.params.royaltyRecipient
    gatedNFT.royaltyBPS = event.params.royaltyBPS
    gatedNFT.royaltyPercent = gatedNFT.royaltyBPS.toBigDecimal().div(HUNDRED_BD)
    gatedNFT.animationHash = event.params.config.animationHash
    gatedNFT.animationUrl = event.params.config.animationUrl
    gatedNFT.imageHash = event.params.config.imageHash
    gatedNFT.imageUrl = event.params.config.imageUrl
    gatedNFT.description = event.params.config.description
    gatedNFT.save()
}

export function handleOwnershipTransferred(event: OwnershipTransferredEvent): void {
    let gatedNFT = GatedNFT.load(event.address.toHex())
    let ownershipTransferred = new OwnershipTransferred(event.transaction.hash.toHex())

    gatedNFT.owner = event.params.newOwner

    ownershipTransferred.emitter = event.address
    ownershipTransferred.sender = event.transaction.from
    ownershipTransferred.oldOwner = event.params.previousOwner
    ownershipTransferred.newOwner = event.params.newOwner
    ownershipTransferred.block = event.block.number
    ownershipTransferred.timestamp = event.block.timestamp
    ownershipTransferred.save()

    let ownershipHistory = gatedNFT.ownershipHistory
    ownershipHistory.push(ownershipTransferred.id)
    gatedNFT.ownershipHistory = ownershipHistory
    gatedNFT.save()
}

export function handleUpdatedRoyaltyRecipient(event: UpdatedRoyaltyRecipientEvent): void {
    let gatedNFT = GatedNFT.load(event.address.toHex())
    let updatedRoyaltyRecipient = new UpdatedRoyaltyRecipient(event.transaction.hash.toHex())

    gatedNFT.royaltyRecipient = event.params.royaltyRecipient

    updatedRoyaltyRecipient.nftContract = gatedNFT.id
    updatedRoyaltyRecipient.origin = event.transaction.from
    updatedRoyaltyRecipient.newRoyaltyRecipient = event.params.royaltyRecipient
    updatedRoyaltyRecipient.block = event.block.number
    updatedRoyaltyRecipient.timestamp = event.block.timestamp

    updatedRoyaltyRecipient.save()

    let royaltyRecipientHistory = gatedNFT.royaltyRecipientHistory
    royaltyRecipientHistory.push(updatedRoyaltyRecipient.id)
    gatedNFT.royaltyRecipientHistory = royaltyRecipientHistory
    gatedNFT.save()
}