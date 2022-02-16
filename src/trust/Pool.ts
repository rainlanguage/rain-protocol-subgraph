import { dataSource } from "@graphprotocol/graph-ts"
import { Pool, Swap, Trust } from "../../generated/schema"
import { LOG_SWAP } from "../../generated/templates/PoolTemplate/Pool"
import { ERC20 } from "../../generated/TrustFactory/ERC20"
import { getTrustParticipent } from "../utils"

export function handleLOG_SWAP(event: LOG_SWAP): void {
    let pool = Pool.load(event.address.toHex())

    let swap = new Swap(event.transaction.hash.toHex())
    swap.deployBlock = event.block.number
    swap.deployTimestamp = event.block.timestamp
    swap.pool = pool.id
    swap.caller = event.params.caller
    swap.tokenIn = event.params.tokenIn
    swap.tokenOut = event.params.tokenOut
    swap.tokenAmountIn = event.params.tokenAmountIn
    swap.tokenAmountOut = event.params.tokenAmountOut
    swap.userAddress = event.params.caller
    let tokenIn = ERC20.bind(event.params.tokenIn)
    swap.tokenInSym = tokenIn.symbol()
    let tokenOut = ERC20.bind(event.params.tokenOut)
    swap.tokenOutSym = tokenOut.symbol()
    swap.save()

    let swaps = pool.swaps
    swaps.push(swap.id)
    pool.swaps = swaps

    pool.save()

    let context = dataSource.context()
    let trustParticipant = getTrustParticipent(event.params.caller, context.getString("trust"))
    
    let tswaps = trustParticipant.swaps
    tswaps.push(swap.id)
    trustParticipant.swaps = tswaps
    
    trustParticipant.save()
}