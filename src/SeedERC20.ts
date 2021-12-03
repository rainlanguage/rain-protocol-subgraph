import { dataSource, BigInt, Address, BigDecimal, log} from "@graphprotocol/graph-ts";
import { Redeem, Seed as SeedEvent, SeedERC20 as  SeedERC20Contract, Transfer, Unseed as UnseedEvent} from "../generated/templates/SeedERC20Template/SeedERC20";
import { DistributionProgress, Holder, SeedERC20, Seed, Unseed, TrustParticipant, Trust, Contract, RedeemSeed} from "../generated/schema"
import { Trust as TrustContract, Trust__getContractsResultValue0Struct } from "../generated/RainProtocol/Trust"
import { ERC20 } from "../generated/templates/BalancerPoolTemplate/ERC20"
import { RedeemableERC20Pool } from "../generated/RainProtocol/RedeemableERC20Pool";
import { RedeemableERC20 as RERC20} from "../generated/RainProtocol/RedeemableERC20"

let ZERO_BI = BigInt.fromI32(0)
let ZERO_BD = BigDecimal.fromString("0.0")
let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
let HUNDRED_BD = BigDecimal.fromString("100.0")

export function handleTransfer(event: Transfer): void {
    let seedERC20Address = dataSource.address()
    let seedERC20AddressContract = SeedERC20Contract.bind(seedERC20Address)
    let seedERC20 = SeedERC20.load(seedERC20Address.toHex())
    let context = dataSource.context()
    let trustAddress = context.getString("trustAddress")
    let trustContract = TrustContract.bind(Address.fromString(trustAddress))
    let _contracts = trustContract.getContracts()
    let _distributionProgress = trustContract.getDistributionProgress()
    let distributionProgress = DistributionProgress.load(trustAddress)
    let reserveERC20Contract = ERC20.bind(_contracts.reserveERC20)
    seedERC20.seederFee = trustContract.seederFee()
    seedERC20.seederUnits = trustContract.seederUnits()
    seedERC20.seedFeePerUnit = seedERC20.seederFee.div(BigInt.fromI32(seedERC20.seederUnits))
    seedERC20.seederCooldownDuration = trustContract.seederCooldownDuration()
    seedERC20.totalSupply = seedERC20AddressContract.totalSupply()
    seedERC20.seederUnitsAvail = seedERC20AddressContract.balanceOf(_contracts.seeder)
    if(seedERC20.seederUnitsAvail.equals(ZERO_BI)){
        seedERC20.seededAmount = _distributionProgress.reserveInit
    }
    seedERC20.seededAmount = reserveERC20Contract.balanceOf(_contracts.seeder)
    seedERC20.percentSeeded = seedERC20.seededAmount.toBigDecimal().times(HUNDRED_BD).div(_distributionProgress.reserveInit.toBigDecimal())
    seedERC20.factory = trustContract.seedERC20Factory()
    if(_distributionProgress.distributionStatus < 2){
        distributionProgress.distributionEndBlock = ZERO_BI
        distributionProgress.distributionStartBlock = ZERO_BI
        distributionProgress.percentAvailable = ZERO_BD
        distributionProgress.percentRaised = ZERO_BD
        distributionProgress.poolReserveBalance = ZERO_BI
        distributionProgress.poolTokenBalance = ZERO_BI
        distributionProgress.finalBalance = ZERO_BI
    }
    if(_distributionProgress.distributionStatus < 4){
        distributionProgress.finalBalance = ZERO_BI
    }

    let seedERC20COntract = ERC20.bind(seedERC20Address)
    let holders = seedERC20.holders

    if(event.params.from.toHex() != ZERO_ADDRESS && notIn(_contracts, event.params.from)){
        let sender = Holder.load(event.params.from.toHex() + "-" + seedERC20Address.toHex())
        if(sender == null){
            sender = new Holder(event.params.from.toHex() + "-" + seedERC20Address.toHex())
            sender.address = event.params.from
        }
        sender.balance = seedERC20COntract.balanceOf(event.params.from)
        sender.save()
        if(!seedERC20.holders.includes(sender.id)){
            holders.push(sender.id)
        }
    }
    if(event.params.to.toHex() != ZERO_ADDRESS && notIn(_contracts, event.params.to)){
        let receiver = Holder.load(event.params.to.toHex() + "-" + seedERC20Address.toHex())
        if(receiver == null){
            receiver = new Holder(event.params.to.toHex() + "-" + seedERC20Address.toHex())
            receiver.address = event.params.to
        }
        receiver.balance = seedERC20COntract.balanceOf(event.params.to)
        receiver.save()
        
        if(!seedERC20.holders.includes(receiver.id)){
            holders.push(receiver.id)
        }
    }

    seedERC20.holders = holders
    distributionProgress.save()
    seedERC20.save()
}

function notIn(contacts: Trust__getContractsResultValue0Struct, key: Address): boolean {
    if(contacts.seeder == key)
        return false
    if(contacts.redeemableERC20 == key)
        return false
    if(contacts.redeemableERC20Pool == key)
        return false
    if(contacts.reserveERC20 == key)
        return false
    if(contacts.crp == key)
        return false
    if(contacts.pool == key)
        return false
    return true
}

export function handleSeed(event: SeedEvent): void {
    let seedERC20Addres = dataSource.address()
    let values = event.params.seedAmounts
    let seedERC20 = SeedERC20.load(seedERC20Addres.toHex())
    let trustAddress = seedERC20.trust
    let seed = new Seed(event.transaction.hash.toHex())
    seed.seedERC20  = seedERC20.id
    seed.caller = event.params.seeder
    seed.seedAmount = values[1]
    seed.seedUnits = values[0]
    seed.block = event.block.number
    seed.timestamp = event.block.timestamp

    let seeds = seedERC20.seeds
    seeds.push(seed.id)
    seedERC20.seeds = seeds
    seedERC20.save()
    seed.save()

    let _contracts = Contract.load(trustAddress)


    let seedERC20Contract = ERC20.bind(seedERC20Addres)
    let redeemableERC20Contract = ERC20.bind(Address.fromString(_contracts.redeemableERC20))
    let trustParticipant = TrustParticipant.load(event.params.seeder.toHex() + "-" + trustAddress)
    if(trustParticipant == null){
        trustParticipant = new TrustParticipant(event.params.seeder.toHex() + "-" + trustAddress)
        trustParticipant.redeems = []
        trustParticipant.swaps = []
        trustParticipant.seeds = []
        trustParticipant.unSeeds = []
        trustParticipant.redeemSeeds = []
        trustParticipant.trust = trustAddress
        trustParticipant.user = event.params.seeder

        let trust = Trust.load(trustAddress)
        let trustParticipants = trust.trustParticipants
        trustParticipants.push(trustParticipant.id)
        trust.trustParticipants = trustParticipants
        trust.save()
    }
    trustParticipant.seedBalance = seedERC20Contract.balanceOf(event.params.seeder)
    trustParticipant.seedFeeClaimable = trustParticipant.seedBalance.times(seedERC20.seedFeePerUnit)
    trustParticipant.tokenBalance = redeemableERC20Contract.balanceOf(event.params.seeder)

    let tseeds = trustParticipant.seeds
    tseeds.push(seed.id)
    trustParticipant.seeds = tseeds

    trustParticipant.save()

    let trustContract = TrustContract.bind(Address.fromString(trustAddress))
    let _distributionProgress = trustContract.getDistributionProgress()

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
    distributionProgress.minimumRaise = distributionProgress.minimumCreatorRaise.plus(distributionProgress.redeemInit).plus(seedERC20.seederFee)
    if(distributionProgress.distributionStatus < 4){
        distributionProgress.amountRaised = distributionProgress.poolReserveBalance.minus(distributionProgress.reserveInit)
        distributionProgress.percentRaised = (distributionProgress.amountRaised).toBigDecimal().div((distributionProgress.minimumRaise).toBigDecimal()).times(HUNDRED_BD)
        distributionProgress.finalBalance = ZERO_BI
    }
    distributionProgress.minimumTradingDuration = ZERO_BI
    distributionProgress.finalWeight = ZERO_BI
    distributionProgress.finalValuation = ZERO_BI
    distributionProgress.percentAvailable = ZERO_BD
    if(_contracts.redeemableERC20Pool != ZERO_ADDRESS){
        let redeemableERC20Pool = RedeemableERC20Pool.bind(Address.fromString(_contracts.redeemableERC20Pool))
        distributionProgress.minimumTradingDuration = redeemableERC20Pool.minimumTradingDuration()
        distributionProgress.finalWeight = redeemableERC20Pool.finalWeight()
        distributionProgress.finalValuation = redeemableERC20Pool.finalValuation()
    }
    if(_contracts.redeemableERC20 != ZERO_ADDRESS){
        let redeemableERC20 = RERC20.bind(Address.fromString(_contracts.redeemableERC20))
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
}

export function handleUnseed(event: UnseedEvent): void {
    let seedERC20Addres = dataSource.address()
    let values = event.params.unseedAmounts
    let seedERC20 = SeedERC20.load(seedERC20Addres.toHex())
    let trustAddress = seedERC20.trust
    let unseed = new Unseed(event.transaction.hash.toHex())
    unseed.seedERC20  = seedERC20.id
    unseed.caller = event.params.unseeder
    unseed.seedAmount = values[1]
    unseed.seedUnits = values[0]
    unseed.block = event.block.number
    unseed.timestamp = event.block.timestamp

    let unseeds = seedERC20.unseeds
    unseeds.push(unseed.id)
    seedERC20.unseeds = unseeds
    seedERC20.save()
    unseed.save()

    let _contracts = Contract.load(trustAddress)


    let seedERC20Contract = ERC20.bind(seedERC20Addres)
    let redeemableERC20Contract = ERC20.bind(Address.fromString(_contracts.redeemableERC20))
    let trustParticipant = TrustParticipant.load(event.params.unseeder.toHex() + "-" + trustAddress)
    if(trustParticipant == null){
        trustParticipant = new TrustParticipant(event.params.unseeder.toHex() + "-" + trustAddress)
        trustParticipant.redeems = []
        trustParticipant.swaps = []
        trustParticipant.seeds = []
        trustParticipant.unSeeds = []
        trustParticipant.redeemSeeds = []
        trustParticipant.trust = trustAddress
        trustParticipant.user = event.params.unseeder

        let trust = Trust.load(trustAddress)
        let trustParticipants = trust.trustParticipants
        trustParticipants.push(trustParticipant.id)
        trust.trustParticipants = trustParticipants
        trust.save()
    }
    trustParticipant.seedBalance = seedERC20Contract.balanceOf(event.params.unseeder)
    trustParticipant.seedFeeClaimable = trustParticipant.seedBalance.times(seedERC20.seedFeePerUnit)
    trustParticipant.tokenBalance = redeemableERC20Contract.balanceOf(event.params.unseeder)

    let tunSeeds = trustParticipant.unSeeds
    tunSeeds.push(unseed.id)
    trustParticipant.unSeeds = tunSeeds

    trustParticipant.save()

    let trustContract = TrustContract.bind(Address.fromString(trustAddress))
    let _distributionProgress = trustContract.getDistributionProgress()

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
    distributionProgress.minimumRaise = distributionProgress.minimumCreatorRaise.plus(distributionProgress.redeemInit).plus(seedERC20.seederFee)
    if(distributionProgress.distributionStatus < 4){
        distributionProgress.amountRaised = distributionProgress.poolReserveBalance.minus(distributionProgress.reserveInit)
        distributionProgress.percentRaised = (distributionProgress.amountRaised).toBigDecimal().div((distributionProgress.minimumRaise).toBigDecimal()).times(HUNDRED_BD)
        distributionProgress.finalBalance = ZERO_BI
    }
    distributionProgress.minimumTradingDuration = ZERO_BI
    distributionProgress.finalWeight = ZERO_BI
    distributionProgress.finalValuation = ZERO_BI
    distributionProgress.percentAvailable = ZERO_BD
    if(_contracts.redeemableERC20Pool != ZERO_ADDRESS){
        let redeemableERC20Pool = RedeemableERC20Pool.bind(Address.fromString(_contracts.redeemableERC20Pool))
        distributionProgress.minimumTradingDuration = redeemableERC20Pool.minimumTradingDuration()
        distributionProgress.finalWeight = redeemableERC20Pool.finalWeight()
        distributionProgress.finalValuation = redeemableERC20Pool.finalValuation()
    }
    if(_contracts.redeemableERC20 != ZERO_ADDRESS){
        let redeemableERC20 = RERC20.bind(Address.fromString(_contracts.redeemableERC20))
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
}

export function handleRedeem(event: Redeem): void {
    let seedERC20Addres = dataSource.address()
    let seedERC20 = SeedERC20.load(seedERC20Addres.toHex())
    let values = event.params.redeemAmounts
    let redeemSeed = new RedeemSeed(event.transaction.hash.toHex())
    let trustAddress = seedERC20.trust

    redeemSeed.seedERC20 = seedERC20.id
    redeemSeed.caller = event.params.redeemer
    redeemSeed.redeemAmount = values[0]
    redeemSeed.reserveAmount = values[1]
    redeemSeed.block = event.block.number
    redeemSeed.timestamp = event.block.timestamp
    redeemSeed.save()

    let redeemSeeds = seedERC20.redeemSeeds
    redeemSeeds.push(redeemSeed.id)
    seedERC20.redeemSeeds = redeemSeeds
    seedERC20.save()

    let trustParticipant = TrustParticipant.load(event.params.redeemer.toHex() + "-" + trustAddress)
    let tredeemSeeds = trustParticipant.redeemSeeds
    tredeemSeeds.push(redeemSeed.id)
    trustParticipant.redeemSeeds = tredeemSeeds
    trustParticipant.save()
}