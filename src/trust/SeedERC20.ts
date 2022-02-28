
import { Address, dataSource, BigInt } from "@graphprotocol/graph-ts";
import { Seed, Unseed, SeedERC20, Holder, DistributionProgress, TrustParticipant, RedeemSeed, TreasuryAsset } from "../../generated/schema";
import { CooldownInitialize, Initialize, Redeem as RedeemEvent, Seed as SeedEvent, Transfer, Unseed as UnseedEvent } from "../../generated/templates/SeedERC20Template/SeedERC20";
import { getTrustParticipent, HUNDRED_BD, notAContract, ZERO_BI } from "../utils";
import { SeedERC20 as SeedERC20Contract } from "../../generated/templates/SeedERC20Template/SeedERC20"
import { Trust } from "../../generated/TrustFactory/Trust"

export function  handleCooldownInitialize(event: CooldownInitialize): void {
    let seedERC20 = SeedERC20.load(event.address.toHex())
    seedERC20.seederCooldownDuration = event.params.cooldownDuration
    seedERC20.save()
}

export function handleSeed(event: SeedEvent): void {
    let seedERC20 = SeedERC20.load(event.address.toHex())
    let context = dataSource.context()
    let distributionProgess = DistributionProgress.load(context.getString("trust"))

    let seed = new Seed(event.transaction.hash.toHex())
    seed.deployBlock = event.block.number
    seed.deployTimestamp = event.block.timestamp
    seed.seedERC20 = seedERC20.id
    seed.caller = event.params.sender
    seed.tokensSeeded = event.params.tokensSeeded
    seed.reserveReceived = event.params.reserveReceived

    seed.save()

    let seeds = seedERC20.seeds
    seeds.push(seed.id)
    seedERC20.seeds = seeds
    
    seedERC20.seededAmount = seedERC20.seededAmount.plus(event.params.reserveReceived)
  
    seedERC20.seederUnitsAvail = seedERC20.seederUnitsAvail.minus(event.params.tokensSeeded)

    if(distributionProgess.redeemInit != ZERO_BI)
        seedERC20.percentSeeded = seedERC20.seededAmount.toBigDecimal().div(distributionProgess.redeemInit.toBigDecimal()).times(HUNDRED_BD)
    seedERC20.save()

    let trustParticipant = getTrustParticipent(event.params.sender, context.getString("trust"))

    let tbalance = SeedERC20Contract.bind(event.address).balanceOf(event.params.sender)
    trustParticipant.seedFeeClaimable = tbalance.times(seedERC20.seedFeePerUnit)
    let tseeds = trustParticipant.seeds
    tseeds.push(seed.id)
    trustParticipant.seeds = tseeds
    trustParticipant.save()

    let trust = Trust.bind(Address.fromString(context.getString("trust")))
    distributionProgess.distributionStatus = trust.getDistributionStatus()
    distributionProgess.save()
}

export function handleUnseed(event: UnseedEvent): void {
    let seedERC20 = SeedERC20.load(event.address.toHex())

    let context = dataSource.context()
    let distributionProgess = DistributionProgress.load(context.getString("trust"))

    let unseed = new Unseed(event.transaction.hash.toHex())
    unseed.deployBlock = event.block.number
    unseed.deployTimestamp = event.block.timestamp
    unseed.seedERC20 = seedERC20.id
    unseed.caller = event.params.sender
    unseed.tokensSeeded = event.params.tokensUnseeded
    unseed.reserveReturned = event.params.reserveReturned

    unseed.save()

    let unseeds = seedERC20.unseeds
    unseeds.push(unseed.id)
    seedERC20.unseeds = unseeds

    seedERC20.seededAmount = seedERC20.seededAmount.minus(event.params.reserveReturned)
  
    if(distributionProgess.redeemInit != ZERO_BI)
        seedERC20.percentSeeded = seedERC20.seededAmount.toBigDecimal().div(distributionProgess.redeemInit.toBigDecimal()).times(HUNDRED_BD)
    seedERC20.save()

    seedERC20.seederUnitsAvail = seedERC20.seederUnitsAvail.plus(event.params.tokensUnseeded)
    seedERC20.save()

    let trustParticipant = getTrustParticipent(event.params.sender, context.getString("trust"))

    let tbalance = SeedERC20Contract.bind(event.address).balanceOf(event.params.sender)
    trustParticipant.seedFeeClaimable = tbalance.times(seedERC20.seedFeePerUnit)
    let tunseeds = trustParticipant.unSeeds
    tunseeds.push(unseed.id)
    trustParticipant.unSeeds = tunseeds
    trustParticipant.save()
}

export function handleInitialize(event: Initialize): void {
    let seedERC20 = SeedERC20.load(event.address.toHex())
    seedERC20.factory = event.params.sender
    seedERC20.recipient = event.params.recipient
    seedERC20.reserve = event.params.reserve
    seedERC20.seedPrice = event.params.seedPrice
    seedERC20.save()
}

export function handleRedeem(event: RedeemEvent): void {
    let context = dataSource.context()
    let seedERC20 = SeedERC20.load(event.address.toHex())
    let redeemSeeds = seedERC20.redeemSeeds

    let redeem = new RedeemSeed(event.transaction.hash.toHex() + " - " + BigInt.fromI32(redeemSeeds.length).toString())
    redeem.caller = event.params.sender
    redeem.redeemAmount = event.params.redeemAmount
    redeem.treasuryAssetAmount = event.params.assetAmount
    redeem.deployBlock = event.block.number
    redeem.deployTimestamp = event.block.timestamp
    redeem.seedERC20 = event.address.toHex()

    redeem.save()

    redeemSeeds.push(redeem.id)
    seedERC20.redeemSeeds = redeemSeeds

    seedERC20.save()

    let trustParticipant = getTrustParticipent(event.params.sender, context.getString("trust"))
    let tRedeemSeeds = trustParticipant.redeemSeeds
    tRedeemSeeds.push(redeem.id)
    trustParticipant.redeemSeeds = tRedeemSeeds

    trustParticipant.save()
}

export function handleTransfer(event: Transfer): void {
    if (event.params.value != ZERO_BI) {
        let seedERC20 = SeedERC20.load(event.address.toHex())
        let seedERC20Contract = SeedERC20Contract.bind(event.address)
        let context = dataSource.context()
        
        let holders = seedERC20.holders
        if(notAContract(event.params.from.toHex(), context.getString("trust"))){
            let sender = Holder.load(event.address.toHex() + " - " + event.params.from.toHex())
            if(sender == null){
                sender = new Holder(event.address.toHex() + " - " + event.params.from.toHex())
                sender.balance = seedERC20Contract.balanceOf(event.params.from)
            }
            sender.balance = sender.balance.minus(event.params.value)
            sender.save()

            let trustParticipant = TrustParticipant.load(event.params.from.toHex() + " - " +context.getString("trust"))
            if(trustParticipant != null){
                trustParticipant.seedBalance = seedERC20Contract.balanceOf(event.params.from)
                trustParticipant.seedFeeClaimable = trustParticipant.seedBalance.times(seedERC20.seedFeePerUnit)
                trustParticipant.save()
            }
        }

        if(notAContract(event.params.to.toHex(), context.getString("trust"))){
            let receiver = Holder.load(event.address.toHex() + " - " + event.params.to.toHex())
            if(receiver == null){
                receiver = new Holder(event.address.toHex() + " - " + event.params.to.toHex())
                receiver.balance = ZERO_BI
            }
            receiver.balance = receiver.balance.plus(event.params.value)
            receiver.address = event.params.to
            receiver.save()
    
            if(!holders.includes(receiver.id)){
                holders.push(receiver.id)
                seedERC20.holders = holders
                seedERC20.save()
            }
            let trustParticipant = TrustParticipant.load(event.params.to.toHex() + " - " +context.getString("trust"))
            if(trustParticipant != null){
                trustParticipant.seedBalance = seedERC20Contract.balanceOf(event.params.from)
                trustParticipant.seedFeeClaimable = trustParticipant.seedBalance.times(seedERC20.seedFeePerUnit)
                trustParticipant.save()
            }
        }
    }
}