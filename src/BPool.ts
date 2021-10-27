import { dataSource, BigInt} from "@graphprotocol/graph-ts"
import { Pool, Swap } from "../generated/schema"
import { LOG_SWAP } from "../generated/templates/BalancerPool/BPool"
import { ERC20 } from "../generated/templates/ReserveERC20/ERC20"

let ONE_BI = BigInt.fromI32(1)

export function handleSwaps(event: LOG_SWAP):void {
    let poolAddress = dataSource.address()
    let pool = Pool.load(poolAddress.toHex())
    pool.numberOfSwaps = pool.numberOfSwaps.plus(ONE_BI)
    

    let swap = new Swap(event.transaction.hash.toHex())
    swap.poolId = pool.id
    swap.caller = event.params.caller
    swap.tokenIn = event.params.tokenIn
    swap.tokenOut = event.params.tokenOut
    swap.tokenAmountIn = event.params.tokenAmountIn
    swap.tokenAmountOut = event.params.tokenAmountOut
    swap.timestamp = event.block.timestamp
    swap.userAddress = event.params.caller
    let tokenIn = ERC20.bind(event.params.tokenIn)
    swap.tokenInSym = tokenIn.symbol()
    let tokenOut = ERC20.bind(event.params.tokenIn)
    swap.tokenOutSym = tokenOut.symbol()
    swap.save()

    let swaps = pool.swaps
    swaps.push(swap.id)
    pool.swaps = swaps
    pool.save()
}