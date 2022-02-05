/* eslint-disable prefer-const */
/* eslint-disable prettier/prettier */
import {
    Construction,
    CreatorFundsRelease,
    EndDutchAuction,
    Initialize,
    Notice,
    PhaseScheduled,
    StartDutchAuction
} from '../../generated/TrustFactory/Trust'

import { Contract, CRP, DistributionProgress, DutchAuction, Notice as NoticeScheme, Pool, RedeemableERC20, ReserveERC20, SeedERC20, Trust, TrustFactory } from "../../generated/schema"
import { dataSource, DataSourceContext, log } from '@graphprotocol/graph-ts'
import { ERC20 } from "../../generated/TrustFactory/ERC20"
import { Trust as TrustContract } from "../../generated/TrustFactory/Trust"
import { PoolTemplate, RedeemableERC20Template, SeedERC20Template } from '../../generated/templates'
import { ZERO_BI } from "../utils"

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
    distributionProgress.distributionStatus = trustContract.getDistributionStatus()
    distributionProgress.successPoolBalance = event.params.successBalance
    distributionProgress.reserveInit = event.params.config.reserveInit
    distributionProgress.initialValuation = event.params.config.initialValuation
    distributionProgress.finalValuation = event.params.config.finalValuation
    distributionProgress.minimumTradingDuration = event.params.config.minimumTradingDuration
    distributionProgress.minimumCreatorRaise = event.params.config.minimumCreatorRaise
    distributionProgress.redeemInit = event.params.config.redeemInit

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

    let contracts = Contract.load(trustAddress.toHex())
    contracts.pool = createPool(event)
    contracts.save()
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
    let reserveERC20 = ReserveERC20.load(event.params.config.reserve.toHex())
    let reserveERC20Contract = ERC20.bind(event.params.config.reserve)

    if(reserveERC20 == null)
        reserveERC20 = new ReserveERC20(event.params.config.reserve.toHex())
    else
        return reserveERC20.id
    reserveERC20.deployBlock= event.block.number
    reserveERC20.deployTimestamp= event.block.timestamp
    reserveERC20.name = reserveERC20Contract.name()
    reserveERC20.symbol = reserveERC20Contract.symbol()
    reserveERC20.totalSupply = reserveERC20Contract.totalSupply()
    reserveERC20.decimals = reserveERC20Contract.decimals()
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
    redeemableERC20.name = redeemableERC20Contract.name()
    redeemableERC20.symbol = redeemableERC20Contract.symbol()
    redeemableERC20.totalSupply = redeemableERC20Contract.totalSupply()
    redeemableERC20.decimals = redeemableERC20Contract.decimals()

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
    let seedERC20Contract = ERC20.bind(event.params.seeder)
    if(seedERC20 == null)
        seedERC20 = new SeedERC20(event.params.seeder.toHex())
    else
        return seedERC20.id
    seedERC20.deployBlock = event.block.number
    seedERC20.deployTimestamp = event.block.timestamp
    seedERC20.name = seedERC20Contract.name()
    seedERC20.symbol = seedERC20Contract.symbol()
    seedERC20.totalSupply = seedERC20Contract.totalSupply()
    seedERC20.decimals = seedERC20Contract.decimals()
    seedERC20.seederFee = event.params.config.seederFee
    seedERC20.seeds = []
    seedERC20.unseeds = []
    seedERC20.holders = []
    seedERC20.redeemSeed = []
    seedERC20.save()

    let context = new DataSourceContext()
    context.setString("trust", event.address.toHex())
    SeedERC20Template.createWithContext(event.params.seeder, context)
    return seedERC20.id
}

function createPool(event: StartDutchAuction): string {
    let pool = Pool.load(event.params.pool.toHex())
    if(pool == null){
        pool = new Pool(event.params.pool.toHex())
        pool.deployBlock = event.block.number
        pool.deployTimestamp = event.block.timestamp
        pool.trust = event.address.toHex()
        pool.numberOfSwaps = ZERO_BI
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