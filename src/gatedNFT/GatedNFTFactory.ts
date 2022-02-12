import { Implementation, NewChild} from "../../generated/GatedNFTFactory/GatedNFTFactory"
import { GatedNFT, GatedNFTFactory } from "../../generated/schema"
import { GatedNFT as GatedNFTContract} from "../../generated/GatedNFTFactory/GatedNFT"

export function handleImplementation(event: Implementation): void { 
    let gatedNFTFactory = new GatedNFTFactory(event.address.toHex())
    gatedNFTFactory.address = event.address
    gatedNFTFactory.implementation = event.params.implementation
    gatedNFTFactory.children = []
    gatedNFTFactory.save()
}

export function handleNewChild(event: NewChild): void {
    let gatedNFT = new GatedNFT(event.params.child.toHex())
    let gatedNFTContract = GatedNFTContract.bind(event.address)
    
    gatedNFT.address = event.params.child
    gatedNFT.name = gatedNFTContract.name()
    gatedNFT.symbol = gatedNFTContract.symbol()
    gatedNFT.owner = gatedNFTContract.owner()
    gatedNFT.royaltyRecipientHistory = []
    gatedNFT.ownershipHistory = []

    gatedNFT.save()
}