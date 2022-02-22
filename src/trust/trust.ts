/* eslint-disable prefer-const */
/* eslint-disable prettier/prettier */
import {
    Construction,
    CreatorFundsRelease,
    EndDutchAuction,
    Initialize,
    Notice,
    PhaseScheduled,
    StartDutchAuction,
} from '../../generated/TrustFactory/Trust'

import { Contract, CRP, DistributionProgress, DutchAuction, Notice as NoticeScheme, Pool, RedeemableERC20, ERC20 as ERC20Schema, SeedERC20, Trust, TrustFactory } from "../../generated/schema"
import { Address, dataSource, DataSourceContext, log, BigInt } from '@graphprotocol/graph-ts'
import { ERC20 } from "../../generated/TrustFactory/ERC20"
import { Trust as TrustContract } from "../../generated/templates/TrustTemplate/Trust"
import { PoolTemplate, RedeemableERC20Template, SeedERC20Template } from '../../generated/templates'
import { HUNDRED_BD, ZERO_BI, BONE, ZERO_BD, ONE_BI, DistributionStatus } from "../utils"

export function handleConstruction(event: Construction): void {
    let context = dataSource.context()
    let trustFactory = TrustFactory.load(context.getBytes("factory").toHex())


    trustFactory.balancerFactory = event.params.balancerFactory
    trustFactory.crpFactory = event.params.crpFactory
    trustFactory.redeemableERC20Factory = event.params.redeemableERC20Factory
    trustFactory.seedERC20Factory = event.params.seedERC20Factory
    trustFactory.bPoolFeeEscrow = event.params.bPoolFeeEscrow

    trustFactory.save()
}

export function handleCreatorFundsRelease(event: CreatorFundsRelease): void {
    
}

export function handleEndDutchAuction(event: EndDutchAuction): void {
    let dutchAuction = DutchAuction.load(event.address.toHex())
    dutchAuction.enderAddress = event.params.sender
    dutchAuction.finalBalance = event.params.finalBalance
    dutchAuction.seederPay = event.params.seederPay
    dutchAuction.creatorPay = event.params.creatorPay
    dutchAuction.tokenPay = event.params.tokenPay
    dutchAuction.poolDust = event.params.poolDust

    dutchAuction.save()

    let distributionProgress = DistributionProgress.load(event.address.toHex())
    if(event.params.finalBalance.toString() >= distributionProgress.finalBalance.toString()) {
        distributionProgress.distributionStatus = DistributionStatus.Success
    } else {
        distributionProgress.distributionStatus = DistributionStatus.Fail
        
    }
    
    distributionProgress.save()
}

export function handleInitialize(event: Initialize): void {
    let trustAddress = event.address
    let trust = Trust.load(trustAddress.toHex())
    let trustContract = TrustContract.bind(trustAddress)

    // contracts creation
    let contracts = new Contract(trustAddress.toHex())
    contracts.crp = createConfigurableRightPool(event)
    contracts.reserveERC20 = createReserveERC20(event)
    contracts.seeder = createSeedERC20(event)
    contracts.redeemableERC20 = createRedeemableERC20(event)
    contracts.save()
 
    // DistributionProgess creation
    let distributionProgress = new DistributionProgress(trustAddress.toHex())
    distributionProgress.distributionStatus = DistributionStatus.Pending
    distributionProgress.successPoolBalance = event.params.successBalance
    distributionProgress.reserveInit = event.params.config.reserveInit
    distributionProgress.initialValuation = event.params.config.initialValuation
    distributionProgress.finalValuation = event.params.config.finalValuation
    distributionProgress.minimumTradingDuration = event.params.config.minimumTradingDuration
    distributionProgress.minimumCreatorRaise = event.params.config.minimumCreatorRaise
    distributionProgress.redeemInit = event.params.config.redeemInit
    distributionProgress.minimumRaise = event.params.config.minimumCreatorRaise.plus(event.params.config.redeemInit).plus(event.params.config.seederFee)
    distributionProgress.finalWeight = valuationWeight(event.params.config.reserveInit, event.params.config.finalValuation)
    distributionProgress.save()

    trust.contracts = contracts.id
    trust.distributionProgress = distributionProgress.id
    trust.save()
}

export function handleNotice(event: Notice): void {
    let trustAddress = event.address
    let trust = Trust.load(trustAddress.toHex())

    let notice = new NoticeScheme(event.transaction.hash.toHex())
    notice.trust = trust.id
    notice.data = event.params.data
    notice.sender = event.params.sender
    notice.deployBlock= event.block.number
    notice.deployTimestamp= event.block.timestamp

    let notices = trust.notices
    notices.push(notice.id)
    trust.notices = notices

    trust.save()
    notice.save()
}

export function handlePhaseScheduled(event: PhaseScheduled): void {
    
}

export function handleStartDutchAuction(event: StartDutchAuction): void {
    let trustAddress = event.address
    let trust = Trust.load(trustAddress.toHex())

    let dutchAuction = new DutchAuction(event.address.toHex())
    dutchAuction.starterAddress = event.params.sender
    dutchAuction.pool = event.params.pool
    dutchAuction.finalAuctionBlock = event.params.finalAuctionBlock
    dutchAuction.save()

    trust.dutchAuction = dutchAuction.id
    trust.save()

    let distributionProgress = DistributionProgress.load(trustAddress.toHex())
    distributionProgress.distributionStatus = DistributionStatus.Trading
    distributionProgress.distributionStartBlock = event.block.number
    distributionProgress.distributionEndBlock = event.params.finalAuctionBlock
    distributionProgress.save()

    let contracts = Contract.load(trustAddress.toHex())
    contracts.pool = createPool(event)
    contracts.save()

    updatePoolBalance(contracts as Contract)
}

function createConfigurableRightPool(event: Initialize): string {
    let crp = CRP.load(event.params.crp.toHex())
    if(crp == null)
        crp = new CRP(event.params.crp.toHex())
    else
        return crp.id
    crp.deployBlock= event.block.number
    crp.deployTimestamp= event.block.timestamp
    crp.save()
    return crp.id
}

function createReserveERC20(event: Initialize): string {
    let reserveERC20 = ERC20Schema.load(event.params.config.reserve.toHex())
    let reserveERC20Contract = ERC20.bind(event.params.config.reserve)

    if(reserveERC20 == null)
        reserveERC20 = new ERC20Schema(event.params.config.reserve.toHex())
    else
        return reserveERC20.id
    reserveERC20.deployBlock= event.block.number
    reserveERC20.deployTimestamp= event.block.timestamp

    let name = reserveERC20Contract.try_name()
    let symbol = reserveERC20Contract.try_symbol()
    let decimals = reserveERC20Contract.try_decimals()
    let totalSupply = reserveERC20Contract.try_totalSupply()
    if(!(name.reverted || symbol.reverted || decimals.reverted || totalSupply.reverted)){
        reserveERC20.name = name.value
        reserveERC20.symbol = symbol.value
        reserveERC20.decimals = decimals.value
        reserveERC20.totalSupply = totalSupply.value
    }

    reserveERC20.save()
    return reserveERC20.id
}

function createRedeemableERC20(event: Initialize): string {
    let redeemableERC20 = RedeemableERC20.load(event.params.redeemableERC20.toHex())
    let redeemableERC20Contract = ERC20.bind(event.params.redeemableERC20)

    if(redeemableERC20 == null)
        redeemableERC20 = new RedeemableERC20(event.params.redeemableERC20.toHex())
    else
        return redeemableERC20.id
    redeemableERC20.deployBlock= event.block.number
    redeemableERC20.deployTimestamp= event.block.timestamp

    let name = redeemableERC20Contract.try_name()
    let symbol = redeemableERC20Contract.try_symbol()
    let decimals = redeemableERC20Contract.try_decimals()
    let totalSupply = redeemableERC20Contract.try_totalSupply()
    if(!(name.reverted || symbol.reverted || decimals.reverted || totalSupply.reverted)){
        redeemableERC20.name = name.value
        redeemableERC20.symbol = symbol.value
        redeemableERC20.decimals = decimals.value
        redeemableERC20.totalSupply = totalSupply.value
    }

    redeemableERC20.deployer = event.transaction.from
    redeemableERC20.redeems = []
    redeemableERC20.treasuryAssets = []
    redeemableERC20.holders = []
    redeemableERC20.grantedReceivers = []
    redeemableERC20.grantedSenders = []

    redeemableERC20.save()
    let context = new DataSourceContext()
    context.setString("trust", event.address.toHex())
    RedeemableERC20Template.createWithContext(event.params.redeemableERC20, context)
    return redeemableERC20.id
}

function createSeedERC20(event: Initialize): string {
    let seedERC20 = SeedERC20.load(event.params.seeder.toHex())
    let trust = Trust.load(event.address.toHex())
    let trustFactory = TrustFactory.load(trust.factory.toHex())

    let seedERC20Contract = ERC20.bind(event.params.seeder)
    if(seedERC20 == null)
        seedERC20 = new SeedERC20(event.params.seeder.toHex())
    else
        return seedERC20.id
    seedERC20.deployBlock = event.block.number
    seedERC20.deployTimestamp = event.block.timestamp
    seedERC20.reserve = event.params.config.reserve
    seedERC20.factory = trustFactory.seedERC20Factory
    seedERC20.deployer = event.transaction.from
    seedERC20.seederFee = event.params.config.seederFee
    seedERC20.seederUnits = ONE_BI
    seedERC20.seedFeePerUnit = ONE_BI


    let name = seedERC20Contract.try_name()
    let symbol = seedERC20Contract.try_symbol()
    let decimals = seedERC20Contract.try_decimals()
    let totalSupply = seedERC20Contract.try_totalSupply()
    if(!(name.reverted || symbol.reverted || decimals.reverted || totalSupply.reverted)){
        seedERC20.name = name.value
        seedERC20.symbol = symbol.value
        seedERC20.decimals = decimals.value
        seedERC20.totalSupply = totalSupply.value
        seedERC20.seederUnits = totalSupply.value
        seedERC20.seederUnitsAvail = totalSupply.value
        seedERC20.seedFeePerUnit = event.params.config.seederFee.div(totalSupply.value)
    }

    seedERC20.seeds = []
    seedERC20.unseeds = []
    seedERC20.holders = []
    seedERC20.redeemSeed = []
    
    seedERC20.seededAmount = ZERO_BI
    seedERC20.percentSeeded = ZERO_BD
    seedERC20.save()

    let context = new DataSourceContext()
    context.setString("trust", event.address.toHex())
    SeedERC20Template.createWithContext(event.params.seeder, context)
    log.info("Seed Template create Block : {}", [event.block.number.toString()])
    return seedERC20.id
}

function createPool(event: StartDutchAuction): string {
    let contracts = Contract.load(event.address.toHex())

    let pool = Pool.load(event.params.pool.toHex())
    if(pool == null){
        pool = new Pool(event.params.pool.toHex())
        pool.deployBlock = event.block.number
        pool.deployTimestamp = event.block.timestamp
        pool.trust = event.address.toHex()
        pool.numberOfSwaps = ZERO_BI
        pool.reserve = contracts.reserveERC20
        pool.redeemable = contracts.redeemableERC20
        pool.swaps = []
    }else{
        return pool.id
    }
    pool.save()

    let context = new DataSourceContext()
    context.setString("trust", event.address.toHex())
    PoolTemplate.createWithContext(event.params.pool, context)
    return pool.id
}

function updatePoolBalance(contracts: Contract): void {
    let reserveTokenContract = ERC20.bind(Address.fromString(contracts.reserveERC20))
    let redeemableTokenContract = ERC20.bind(Address.fromString(contracts.redeemableERC20))

    let distributionProgress = DistributionProgress.load(contracts.id)

    let poolReserveBalance = reserveTokenContract.try_balanceOf(Address.fromString(contracts.pool))
    let poolRedeemableBalance = redeemableTokenContract.try_balanceOf(Address.fromString(contracts.pool))

    if(!(poolRedeemableBalance.reverted)){
        distributionProgress.poolRedeemableBalance = poolRedeemableBalance.value
        distributionProgress.percentAvailable = poolRedeemableBalance.value.toBigDecimal().div(redeemableTokenContract.totalSupply().toBigDecimal())
    }

    if(!(poolReserveBalance.reverted)){
        distributionProgress.poolReserveBalance = poolReserveBalance.value
        if (distributionProgress.minimumRaise == ZERO_BI) {
            distributionProgress.percentRaised = HUNDRED_BD
        } else {
            distributionProgress.percentRaised = distributionProgress.amountRaised.toBigDecimal().div(distributionProgress.minimumRaise.toBigDecimal())
        }
        if(distributionProgress.poolReserveBalance != null && distributionProgress.reserveInit != null){
            distributionProgress.amountRaised = distributionProgress.poolReserveBalance.minus(distributionProgress.reserveInit)
        }
    }else{
        log.info("Poola balance Failed. reserve {}, redeemable {}", [])
    }
    distributionProgress.finalWeight = valuationWeight(distributionProgress.reserveInit, distributionProgress.finalValuation)

    distributionProgress.save()

}

function valuationWeight(reserveBalance_: BigInt, valuation_: BigInt): BigInt{
    // let weight_ = (valuation_IBalancerConstants.BONE) /
    //     reserveBalance_;
    let weight = valuation_.times(BONE).div(reserveBalance_)
    
    return weight
}