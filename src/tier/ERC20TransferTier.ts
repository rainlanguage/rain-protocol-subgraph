import { ERC20, ERC20TransferTier, TierChange, TierLevel } from "../../generated/schema"
import { Initialize, InitializeValueTier, TierChange as TierChangeEvent} from "../../generated/templates/ERC20BalanceTierTemplate/ERC20BalanceTier"
import { ERC20 as ERC20Contract} from "../../generated/ERC20BalanceTierFactory/ERC20"
import { Address, BigInt} from "@graphprotocol/graph-ts"
import { ZERO_BI } from "../utils"

export function handleInitialize( event: Initialize): void {
    let erc20TransferTier = ERC20TransferTier.load(event.address.toHex())

    let erc20 = getERC20(event)
    erc20.save()
    erc20TransferTier.token = erc20.id

    erc20TransferTier.tierLevels = [
        getTierLevel(event.address.toHex(), BigInt.fromI32(1)),
        getTierLevel(event.address.toHex(), BigInt.fromI32(2)),
        getTierLevel(event.address.toHex(), BigInt.fromI32(3)),
        getTierLevel(event.address.toHex(), BigInt.fromI32(4)),
        getTierLevel(event.address.toHex(), BigInt.fromI32(5)),
        getTierLevel(event.address.toHex(), BigInt.fromI32(6)),
        getTierLevel(event.address.toHex(), BigInt.fromI32(7)),
        getTierLevel(event.address.toHex(), BigInt.fromI32(8)),
    ]

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

    let tierLevel = TierLevel.load(event.address.toHex() + " - " + event.params.startTier.toString())
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

        let name = erc20Contract.try_name()
        let symbol = erc20Contract.try_symbol()
        let decimals = erc20Contract.try_decimals()
        let totalSupply = erc20Contract.try_totalSupply()
        if(!(name.reverted || symbol.reverted || decimals.reverted || totalSupply.reverted)){
            erc20.name = name.value
            erc20.symbol = symbol.value
            erc20.decimals = decimals.value
            erc20.totalSupply = totalSupply.value
        }
    }
    return erc20 as ERC20
}

function getTierLevel(tier: string, level: BigInt): string {
    let tierLevel = new TierLevel(tier + " - " + level.toString())
    tierLevel.tierLevel = level
    tierLevel.tierContract = tier
    tierLevel.tierContractAddress = Address.fromString(tier)
    tierLevel.memberCount = ZERO_BI
    tierLevel.save()

    return(tierLevel.id)
}