
import { dataSource, log } from "@graphprotocol/graph-ts";
import { Seed, Unseed, SeedERC20, Holder } from "../../generated/schema";
import { Initialize, Seed as SeedEvent, Transfer, Unseed as UnseedEvent } from "../../generated/templates/SeedERC20Template/SeedERC20";
import { getTrustParticipent, ZERO_ADDRESS, ZERO_BI } from "../utils";
import { SeedERC20 as SeedERC20Contract } from "../../generated/TrustFactory/SeedERC20"
export function handleSeed(event: SeedEvent): void {
    let seedERC20 = SeedERC20.load(event.address.toHex())

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
    seedERC20.seederUnitsAvail = seedERC20.seederUnitsAvail.minus(event.params.tokensSeeded) // Here
    seedERC20.save()

    let context = dataSource.context()
    let trustParticipant = getTrustParticipent(event.params.sender, context.getString("trust"))
    let tseeds = trustParticipant.seeds
    tseeds.push(seed.id)
    trustParticipant.seeds = tseeds
    trustParticipant.save()
}

export function handleUnseed(event: UnseedEvent): void {
    let seedERC20 = SeedERC20.load(event.address.toHex())

    let unseed = new Unseed(event.transaction.hash.toHex())
    unseed.deployBlock = event.block.number
    unseed.deployTimestamp = event.block.timestamp
    unseed.seedERC20 = seedERC20.id
    unseed.caller = event.params.sender
    unseed.tokensSeeded = event.params.tokensUnseeded
    unseed.reserveReceived = event.params.reserveReturned

    unseed.save()

    let unseeds = seedERC20.unseeds
    unseeds.push(unseed.id)
    seedERC20.unseeds = unseeds
    seedERC20.seederUnitsAvail = seedERC20.seederUnitsAvail.plus(event.params.tokensUnseeded) // Here
    seedERC20.save()

    let context = dataSource.context()
    let trustParticipant = getTrustParticipent(event.params.sender, context.getString("trust"))
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

export function handleTransfer(event: Transfer): void {
    if (event.params.value != ZERO_BI) {
        let seedERC20 = SeedERC20.load(event.address.toHex())
        let seedERC20Contract = SeedERC20Contract.bind(event.address)
        
        let holders = seedERC20.holders
        if(event.params.from.toHex() != ZERO_ADDRESS){
            let sender = Holder.load(event.address.toHex() + " - " + event.params.from.toHex())
            if(sender == null){
                sender = new Holder(event.address.toHex() + " - " + event.params.from.toHex())
                sender.balance = seedERC20Contract.balanceOf(event.params.from)
            }
            sender.balance = sender.balance.minus(event.params.value)
        }
        if(event.params.to.toHex() != ZERO_ADDRESS){
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
        }
    }
}