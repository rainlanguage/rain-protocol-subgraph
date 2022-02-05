import { ERC20, ERC20BalanceTier } from "../../generated/schema"
import { Initialize, TierChange, InitializeValueTier} from "../../generated/templates/ERC20BalanceTierTemplate/ERC20BalanceTier"
import { ERC20 as ERC20Contract} from "../../generated/ERC20BalanceTierFactory/ERC20"

export function handleInitialize( event: Initialize): void {
    let erc20BalanceTier = ERC20BalanceTier.load(event.address.toHex())
    
    let erc20 = getERC20(event)
    erc20.save()
    erc20BalanceTier.token = erc20.id
    erc20BalanceTier.save()   
}
export function handleInitializeValueTier( event: InitializeValueTier): void {

}
export function handleTierChange( event: TierChange): void {

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