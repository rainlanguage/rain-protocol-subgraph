import { ERC20, ERC20TransferTier, TierChange, TierLevel } from "../../generated/schema"
import { Initialize, InitializeValueTier, TierChange as TierChangeEvent} from "../../generated/templates/ERC20BalanceTierTemplate/ERC20BalanceTier"
import { ERC20 as ERC20Contract} from "../../generated/ERC20BalanceTierFactory/ERC20"
import { BigInt} from "@graphprotocol/graph-ts"

export function handleInitialize( event: Initialize): void {
    let erc20TransferTier = ERC20TransferTier.load(event.address.toHex())

    let erc20 = getERC20(event)
    erc20.save()
    erc20TransferTier.token = erc20.id
    erc20TransferTier.save()   
}

export function handleInitializeValueTier( event: InitializeValueTier): void {
}

export function handleTierChange( event: TierChangeEvent): void {
    let erc20TransferTier = ERC20TransferTier.load(event.address.toHex())

    let tierChange = new TierChange(event.transaction.hash.toHex() + " - " + event.address.toHex())
    
    tierChange.transactionHash = event.transaction.hash
    tierChange.changeblock = event.block.number
    tierChange.changetimestamp = event.block.timestamp
    tierChange.tierContract = erc20TransferTier.id
    tierChange.sender = event.params.sender
    tierChange.account = event.params.account
    tierChange.startTier = event.params.startTier
    tierChange.endTier = event.params.endTier

    tierChange.save()

    let tierChanges = erc20TransferTier.tierChanges
    tierChanges.push(tierChange.id)
    erc20TransferTier.tierChanges = tierChanges

    let tierLevel = new TierLevel(event.transaction.hash.toHex() + " - " + event.address.toHex())
    tierLevel.tierContract = erc20TransferTier.id
    tierLevel.tierContractAddress = event.address
    tierLevel.memberCount = BigInt.fromI32(tierChanges.length)
    
    tierLevel.save()

    let tierLevels = erc20TransferTier.tierLevels
    tierLevels.push(tierLevel.id)
    erc20TransferTier.tierLevels = tierLevels

    erc20TransferTier.save()

}

function getERC20(event: Initialize): ERC20 {
    let erc20 = ERC20.load(event.params.erc20.toHex())
    let erc20Contract = ERC20Contract.bind(event.params.erc20)
    if(erc20 == null){
        erc20 = new ERC20(event.params.erc20.toHex())
        erc20.deployBlock = event.block.number
        erc20.deployTimestamp = event.block.timestamp
        erc20.name = erc20Contract.name()
        erc20.symbol = erc20Contract.symbol()
        erc20.decimals = erc20Contract.decimals()
        erc20.totalSupply = erc20Contract.totalSupply()
    }
    return erc20 as ERC20
}