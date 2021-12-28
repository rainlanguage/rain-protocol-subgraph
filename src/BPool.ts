import { dataSource, BigInt, Address, BigDecimal, log} from "@graphprotocol/graph-ts"

import { Trust as TrustContract} from "../generated/RainProtocol1/Trust"
import { DistributionProgress, Pool, SeedERC20, Swap, Trust, TrustParticipant } from "../generated/schema"
import { LOG_SWAP } from "../generated/templates/BalancerPoolTemplate/BPool"
import { ERC20 } from "../generated/templates/BalancerPoolTemplate/ERC20"
import { RedeemableERC20 as RERC20} from "../generated/RainProtocol1/RedeemableERC20"
import { RedeemableERC20Pool } from "../generated/RainProtocol1/RedeemableERC20Pool"

let ZERO_BI = BigInt.fromI32(0)
let ONE_BI = BigInt.fromI32(1)
let ZERO_BD = BigDecimal.fromString("0.0")
let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
let HUNDRED_BD = BigDecimal.fromString("100.0")

export function handleSwaps(event: LOG_SWAP):void {
    let poolAddress = dataSource.address()
    let pool = Pool.load(poolAddress.toHex())
    pool.numberOfSwaps = pool.numberOfSwaps.plus(ONE_BI)
    let trustAddress = pool.trust
    let swap = new Swap(event.transaction.hash.toHex())
    swap.pool = pool.id
    swap.caller = event.params.caller
    swap.tokenIn = event.params.tokenIn
    swap.tokenOut = event.params.tokenOut
    swap.tokenAmountIn = event.params.tokenAmountIn
    swap.tokenAmountOut = event.params.tokenAmountOut
    swap.block = event.block.number
    swap.timestamp = event.block.timestamp
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

    let trustContract = TrustContract.bind(Address.fromString(trustAddress))
    let _distributionProgress = trustContract.getDistributionProgress()
    let _contracts = trustContract.getContracts()

    let distributionProgress = new DistributionProgress(trustAddress)
    distributionProgress.distributionStatus = _distributionProgress.distributionStatus
    distributionProgress.distributionEndBlock = _distributionProgress.distributionEndBlock
    distributionProgress.distributionStartBlock = _distributionProgress.distributionStartBlock
    distributionProgress.minimumCreatorRaise = _distributionProgress.minimumCreatorRaise
    distributionProgress.poolReserveBalance = _distributionProgress.poolReserveBalance
    distributionProgress.poolTokenBalance = _distributionProgress.poolTokenBalance
    distributionProgress.successPoolBalance = trustContract.successBalance()
    distributionProgress.finalBalance = trustContract.finalBalance()
    distributionProgress.reserveInit = _distributionProgress.reserveInit
    distributionProgress.redeemInit = _distributionProgress.redeemInit
    distributionProgress.minimumRaise = distributionProgress.minimumCreatorRaise.plus(distributionProgress.redeemInit).plus(trustContract.seederFee())
    if(_distributionProgress.distributionStatus < 4){
        distributionProgress.amountRaised = distributionProgress.poolReserveBalance.minus(distributionProgress.reserveInit)
        distributionProgress.percentRaised = (distributionProgress.amountRaised).toBigDecimal().div((distributionProgress.minimumRaise).toBigDecimal()).times(HUNDRED_BD)
        distributionProgress.finalBalance = ZERO_BI
    }
    if(_contracts.redeemableERC20Pool.toHex() != ZERO_ADDRESS){
        let redeemableERC20Pool = RedeemableERC20Pool.bind(_contracts.redeemableERC20Pool)
        distributionProgress.minimumTradingDuration = redeemableERC20Pool.minimumTradingDuration()
        distributionProgress.finalWeight = redeemableERC20Pool.finalWeight()
        distributionProgress.finalValuation = redeemableERC20Pool.finalValuation()
    }
    if(_contracts.redeemableERC20.toHex() != ZERO_ADDRESS){
        let redeemableERC20 = RERC20.bind(_contracts.redeemableERC20)
        distributionProgress.percentAvailable = (distributionProgress.poolTokenBalance).toBigDecimal().div(redeemableERC20.totalSupply().toBigDecimal()).times(HUNDRED_BD)
    }
    if(distributionProgress.distributionStatus < 2){
        distributionProgress.distributionEndBlock = ZERO_BI
        distributionProgress.distributionStartBlock = ZERO_BI
        distributionProgress.percentAvailable = ZERO_BD
        distributionProgress.percentRaised = ZERO_BD
        distributionProgress.poolReserveBalance = ZERO_BI
        distributionProgress.poolTokenBalance = ZERO_BI
        distributionProgress.amountRaised = ZERO_BI
      }
    
    distributionProgress.save()

    let seedERC20Contract = ERC20.bind(_contracts.seeder)
    let redeemableERC20Contract = ERC20.bind(_contracts.redeemableERC20)
    let seedERC20 = SeedERC20.load(_contracts.seeder.toHex())
    let trustParticipant = TrustParticipant.load(event.params.caller.toHex() + "-" + trustAddress)
    if(trustParticipant == null){
        trustParticipant = new TrustParticipant(event.params.caller.toHex() + "-" + trustAddress)
        trustParticipant.redeems = []
        trustParticipant.swaps = []
        trustParticipant.seeds = []
        trustParticipant.unSeeds = []
        trustParticipant.redeemSeeds = []
        trustParticipant.trust = trustAddress
        trustParticipant.user = event.params.caller

        let trust = Trust.load(trustAddress)
        let trustParticipants = trust.trustParticipants
        trustParticipants.push(trustParticipant.id)
        trust.trustParticipants = trustParticipants
        trust.save()
    }
    trustParticipant.seedBalance = seedERC20Contract.balanceOf(event.params.caller)
    trustParticipant.seedFeeClaimable = trustParticipant.seedBalance.times(seedERC20.seedFeePerUnit)
    trustParticipant.tokenBalance = redeemableERC20Contract.balanceOf(event.params.caller)

    let tswaps = trustParticipant.swaps
    tswaps.push(swap.id)
    trustParticipant.swaps = tswaps

    trustParticipant.save()
}