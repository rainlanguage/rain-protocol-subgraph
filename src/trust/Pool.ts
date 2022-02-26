import { Address, dataSource, log, BigInt} from "@graphprotocol/graph-ts"
import { Contract, DistributionProgress, Pool, Swap, Trust } from "../../generated/schema"
import { LOG_SWAP } from "../../generated/templates/PoolTemplate/Pool"
import { ERC20 } from "../../generated/TrustFactory/ERC20"
import { BONE, getTrustParticipent, HUNDRED_BD, ONE_BI, ZERO_BI } from "../utils"

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

    pool.numberOfSwaps = pool.numberOfSwaps.plus(ONE_BI)

    pool.save()



    let context = dataSource.context()
    let trustParticipant = getTrustParticipent(event.params.caller, context.getString("trust"))
    
    let tswaps = trustParticipant.swaps
    tswaps.push(swap.id)
    trustParticipant.swaps = tswaps
    
    trustParticipant.save()
    let contracts = Contract.load(context.getString("trust"))
    updatePoolBalance(contracts as Contract, pool as Pool)
}


function updatePoolBalance(contracts: Contract, pool: Pool): void {
    let reserveTokenContract = ERC20.bind(Address.fromString(contracts.reserveERC20))
    let redeemableTokenContract = ERC20.bind(Address.fromString(contracts.redeemableERC20))

    let distributionProgress = DistributionProgress.load(contracts.id)

    let poolReserveBalance = reserveTokenContract.try_balanceOf(Address.fromString(contracts.pool))
    let poolRedeemableBalance = redeemableTokenContract.try_balanceOf(Address.fromString(contracts.pool))

    if(!(poolRedeemableBalance.reverted)){
        distributionProgress.poolRedeemableBalance = poolRedeemableBalance.value
        pool.poolRedeemableBalance = poolRedeemableBalance.value
        distributionProgress.percentAvailable = poolRedeemableBalance.value.toBigDecimal().div(redeemableTokenContract.totalSupply().toBigDecimal()).times(HUNDRED_BD)
    }

    if(!(poolReserveBalance.reverted)){
        distributionProgress.poolReserveBalance = poolReserveBalance.value
        pool.poolReserveBalance = poolReserveBalance.value
        if(distributionProgress.poolReserveBalance != null && distributionProgress.reserveInit != null){
            distributionProgress.amountRaised = distributionProgress.poolReserveBalance.minus(distributionProgress.reserveInit)
        }
        if (distributionProgress.minimumRaise == ZERO_BI) {
            distributionProgress.percentRaised = HUNDRED_BD
        } else {
            distributionProgress.percentRaised = distributionProgress.amountRaised.toBigDecimal().div(distributionProgress.minimumRaise.toBigDecimal()).times(HUNDRED_BD)
        }
    }else{
        log.info("Poola balance Failed. reserve {}, redeemable {}", [])
    }
    distributionProgress.finalWeight = valuationWeight(distributionProgress.reserveInit, distributionProgress.finalValuation)

    distributionProgress.save()
    pool.save()
}

function valuationWeight(reserveBalance_: BigInt, valuation_: BigInt): BigInt{
    // let weight_ = (valuation_IBalancerConstants.BONE) /
    //     reserveBalance_;
    let weight = valuation_.times(BONE).div(reserveBalance_)
    
    return weight
}