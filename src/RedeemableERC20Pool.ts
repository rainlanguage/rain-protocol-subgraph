import { log, dataSource, DataSourceContext, BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts"
import { PhaseShiftScheduled } from "../generated/RainProtocol/RedeemableERC20Pool"
import { Trust as TrustContract} from "../generated/RainProtocol/Trust"
import { Trust, Contract, DistributionProgress, ReserveERC20, CRP, RedeemableERC20Pool as RERC20P, Pool, RedeemableERC20, SeedERC20 } from "../generated/schema"
import { BalancerPoolTemplate, SeedERC20Template } from "../generated/templates"
import { RedeemableERC20 as RERC20} from "../generated/RainProtocol/RedeemableERC20"
import { SeedERC20 as SeedERC20Contract} from "../generated/RainProtocol/SeedERC20"
import { BPool } from "../generated/templates/BalancerPool/BPool"
import { RedeemableERC20Pool } from "../generated/RainProtocol/RedeemableERC20Pool"
import { ERC20 } from "../generated/templates/ReserveERC20/ERC20"

let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
let ZERO_BI = BigInt.fromI32(0)
let ONE_BI = BigInt.fromI32(1)
let ZERO_BD = BigDecimal.fromString("0.0")
let HUNDRED_BD = BigDecimal.fromString("100.0")

export function handlePhaseShiftScheduled(event: PhaseShiftScheduled) : void {
    log.info("Phase changed : {}", [event.params.newPhaseBlock_.toString()])
    let context = dataSource.context()
    let trustAddress = context.getString("trustAddress")
    let trustContract = TrustContract.bind(Address.fromString(trustAddress))
    
    
    let _contracts = trustContract.getContracts()
    let contracts = Contract.load(trustAddress)
    let reserveERC20Contract = ERC20.bind(_contracts.reserveERC20)
    let reserveERC20 = ReserveERC20.load(_contracts.reserveERC20.toHex())
    if(reserveERC20 == null){
        reserveERC20 = new ReserveERC20(_contracts.reserveERC20.toHex())
        reserveERC20.block = event.block.number
        reserveERC20.timestamp = event.block.timestamp
    }
    contracts.reserveERC20 = reserveERC20.id

    let redeemableERC20 = RedeemableERC20.load(_contracts.redeemableERC20.toHex())
    if(redeemableERC20 == null){
        redeemableERC20 = new RedeemableERC20(_contracts.redeemableERC20.toHex())
        redeemableERC20.block = event.block.number
        redeemableERC20.timestamp = event.block.timestamp
    }
    contracts.redeemableERC20 = redeemableERC20.id

    // creating seeder
    let seedERC20 = SeedERC20.load(_contracts.seeder.toHex())
    let seedErc20Contract = SeedERC20Contract.bind(_contracts.seeder)
    let distributionProgress = DistributionProgress.load(trustAddress)
    if(seedERC20 == null){
    seedERC20 = new SeedERC20(_contracts.seeder.toHex())
    seedERC20.seederFee = trustContract.seederFee()
    seedERC20.seederUnits = trustContract.seederUnits()
    seedERC20.seedFeePerUnit = seedERC20.seederFee.div(BigInt.fromI32(seedERC20.seederUnits))
    seedERC20.seederCooldownDuration = trustContract.seederCooldownDuration()
    seedERC20.seededAmount = ZERO_BI
    seedERC20.seederUnitsAvail = seedErc20Contract.balanceOf(_contracts.seeder)
    if(seedERC20.seederUnitsAvail.equals(ZERO_BI)){
        seedERC20.seededAmount = distributionProgress.reserveInit
    }
    seedERC20.name = seedErc20Contract.name()
    seedERC20.symbol = seedErc20Contract.symbol()
    seedERC20.decimals = seedErc20Contract.decimals()
    seedERC20.totalSupply = seedErc20Contract.totalSupply()
    seedERC20.seededAmount = reserveERC20Contract.balanceOf(_contracts.seeder)
    seedERC20.percentSeeded = seedERC20.seededAmount.toBigDecimal().times(HUNDRED_BD).div(distributionProgress.reserveInit.toBigDecimal())
    seedERC20.save()
    let context = new DataSourceContext()
    context.setString("trustAddress", trustAddress)
    SeedERC20Template.createWithContext(_contracts.seeder, context)
    contracts.seeder = seedERC20.id
    }
    //end

    let redeemableERC20Pool = RERC20P.load(_contracts.redeemableERC20Pool.toHex())
    if(redeemableERC20Pool == null){
        redeemableERC20Pool = new RERC20P(_contracts.redeemableERC20Pool.toHex())
        redeemableERC20Pool.block = event.block.number
        redeemableERC20Pool.timestamp = event.block.timestamp
    }
    contracts.redeemableERC20Pool = redeemableERC20Pool.id

    contracts.tier = _contracts.tier

    let crp = CRP.load(_contracts.crp.toHex())
    if(crp == null){
        crp = new CRP(_contracts.crp.toHex())
        crp.block = event.block.number
        crp.timestamp = event.block.timestamp
        crp.save()
    }
    contracts.crp = crp.id

    let _distributionProgress = trustContract.getDistributionProgress()
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
    distributionProgress.minimumRaise = distributionProgress.minimumCreatorRaise.plus(distributionProgress.redeemInit).plus(seedERC20.seederFee)
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

    // creating balancer Pool
    if(_contracts.pool.toHex() != ZERO_ADDRESS){
        let bpool = Pool.load(_contracts.pool.toHex())
        if(bpool == null){
        let poolContract = BPool.bind(_contracts.pool)
        bpool = new Pool(_contracts.pool.toHex())
        let trustId = Trust.load(trustAddress)
        bpool.trust = trustId.id
        let reserveERC20 = ReserveERC20.load(_contracts.reserveERC20.toHex())
        bpool.reserve = reserveERC20.id
        bpool.redeemable = redeemableERC20.id
        bpool.poolBalanceReserve = _distributionProgress.poolReserveBalance
        bpool.poolTokenBalance = _distributionProgress.poolTokenBalance
        bpool.numberOfSwaps = ZERO_BI
        bpool.swaps = []
        bpool.block = event.block.number
        bpool.timestamp = event.block.timestamp
        bpool.save()
        BalancerPoolTemplate.create(_contracts.pool)
        }
        contracts.pool = bpool.id
    }
    // end

    distributionProgress.save()
    contracts.save()
}