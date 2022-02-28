import { Implementation, NewChild} from "../../generated/GatedNFTFactory/GatedNFTFactory"
import { GatedNFT, GatedNFTFactory } from "../../generated/schema"
import { GatedNFT as GatedNFTContract} from "../../generated/GatedNFTFactory/GatedNFT"
import { GatedNFTTemplate} from "../../generated/templates"
export function handleImplementation(event: Implementation): void { 
    let gatedNFTFactory = new GatedNFTFactory(event.address.toHex())
    gatedNFTFactory.address = event.address
    gatedNFTFactory.implementation = event.params.implementation
    gatedNFTFactory.children = []
    gatedNFTFactory.save()
}

export function handleNewChild(event: NewChild): void {
    let gatedNFT = new GatedNFT(event.params.child.toHex())
    let gatedNFTContract = GatedNFTContract.bind(event.params.child)
    let gatedNFTFactory = GatedNFTFactory.load(event.address.toHex())

    gatedNFT.address = event.params.child
    gatedNFT.owner = gatedNFTContract.owner()
    gatedNFT.royaltyRecipientHistory = []
    gatedNFT.ownershipHistory = []
    gatedNFT.notices = []
    gatedNFT.deployBlock = event.block.number
    gatedNFT.deployTimestamp = event.block.timestamp

    gatedNFT.save()

    let children = gatedNFTFactory.children
    children.push(gatedNFT.id)
    gatedNFTFactory.children = children
    gatedNFTFactory.save()

    GatedNFTTemplate.create(event.params.child)
}