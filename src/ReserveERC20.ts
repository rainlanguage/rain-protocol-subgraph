import { dataSource, ethereum } from "@graphprotocol/graph-ts";
import { ERC20 } from "../generated/templates/ReserveERC20/ERC20";
import { ReserveERC20 } from "../generated/schema"

export function handleBlock(block: ethereum.Block): void {
    let ReserveERC20Address = dataSource.address()
    let reserveERC20Contract = ERC20.bind(ReserveERC20Address)

    let reserveERC20 = ReserveERC20.load(ReserveERC20Address.toHex())
    
    reserveERC20.symbol = reserveERC20Contract.symbol()
    reserveERC20.name = reserveERC20Contract.name()
    reserveERC20.totalSupply = reserveERC20Contract.totalSupply()
    reserveERC20.decimals = reserveERC20Contract.decimals()
    reserveERC20.save()
}