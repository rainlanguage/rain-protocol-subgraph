import { dataSource, BigInt, Address, log} from "@graphprotocol/graph-ts"
import { Trust as TrustContract, Trust__getContractsResultValue0Struct } from "../generated/RainProtocol/Trust"
import { Contract, Holder, Redeem, RedeemableERC20, SeedERC20, Trust, TrustParticipant} from "../generated/schema"
import { Redeem as Event , Transfer} from "../generated/templates/RedeemableERC20Template/RedeemableERC20"
import { ERC20 } from "../generated/templates/ReserveERC20/ERC20"

let ONE_BI = BigInt.fromI32(1)
let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

export function handleRedeem(event: Event):void {
    let redeemableERC20Address = dataSource.address()
    let redeemableERC20 = RedeemableERC20.load(redeemableERC20Address.toHex())
    let values = event.params.redeemAmounts
    let redeem = new Redeem(event.transaction.hash.toHex())
    redeem.redeemable = redeemableERC20.id
    redeem.caller = event.params.redeemer
    redeem.tokenAmount = values[0]
    redeem.redeemAmount = values[1]
    redeem.block = event.block.number
    redeem.save()

    let redeems = redeemableERC20.redeems
    redeems.push(redeem.id)
    redeemableERC20.redeems = redeems
    redeemableERC20.save()

    let context = dataSource.context()
    let trustAddress = context.getString("trustAddress")
    let _contracts = Contract.load(trustAddress)
    let seedERC20Contract = ERC20.bind(Address.fromString(_contracts.seeder))
    let redeemableERC20Contract = ERC20.bind(Address.fromString(_contracts.redeemableERC20))
    let seedERC20 = SeedERC20.load(_contracts.seeder)
    let trustParticipant = TrustParticipant.load(event.params.redeemer.toHex() + "-" + trustAddress)
    if(trustParticipant == null){
        trustParticipant = new TrustParticipant(event.params.redeemer.toHex() + "-" + trustAddress)
        trustParticipant.redeems = []
        trustParticipant.swaps = []
        trustParticipant.seeds = []
        trustParticipant.unSeeds = []
        trustParticipant.redeemSeeds = []
        trustParticipant.trust = trustAddress
        trustParticipant.user = event.params.redeemer

        let trust = Trust.load(trustAddress)
        let trustParticipants = trust.trustParticipants
        trustParticipants.push(trustParticipant.id)
        trust.trustParticipants = trustParticipants
        trust.save()
    }
    trustParticipant.seedBalance = seedERC20Contract.balanceOf(event.params.redeemer)
    trustParticipant.seedFeeClaimable = trustParticipant.seedBalance.times(seedERC20.seedFeePerUnit)
    trustParticipant.tokenBalance = redeemableERC20Contract.balanceOf(event.params.redeemer)

    let tredeems = trustParticipant.redeems
    tredeems.push(redeem.id)
    trustParticipant.redeems = tredeems

    trustParticipant.save()
}

export function handleTransfer(event: Transfer): void {
    let redeemabaleERC20Address = dataSource.address()
    let redeemabaleERC20 = RedeemableERC20.load(redeemabaleERC20Address.toHex())
    let redeemabaleERC20Contract = ERC20.bind(redeemabaleERC20Address)
    let holders = redeemabaleERC20.holders
    let context = dataSource.context()
    let trustAddress = context.getString("trustAddress")
    let trustContract = TrustContract.bind(Address.fromString(trustAddress))
    let _contracts = trustContract.getContracts()

    if(event.params.from.toHex() != ZERO_ADDRESS && notIn(_contracts, event.params.from)){       
        let sender = Holder.load(event.params.from.toHex() + "-" + redeemabaleERC20Address.toHex())
        if(sender == null){
            sender = new Holder(event.params.from.toHex() + "-" + redeemabaleERC20Address.toHex())
            sender.address = event.params.from
        }
        sender.balance = redeemabaleERC20Contract.balanceOf(event.params.from)
        sender.save()

        if(!redeemabaleERC20.holders.includes(sender.id)){
            holders.push(sender.id)
        }
    }
    if(event.params.to.toHex() != ZERO_ADDRESS && notIn(_contracts, event.params.to)){
        let receiver = Holder.load(event.params.to.toHex() + "-" + redeemabaleERC20Address.toHex())
        if(receiver == null){
            receiver = new Holder(event.params.to.toHex() + "-" + redeemabaleERC20Address.toHex())
            receiver.address = event.params.to
        }
        receiver.balance = redeemabaleERC20Contract.balanceOf(event.params.to)
        receiver.save()

        if(!redeemabaleERC20.holders.includes(receiver.id)){
            holders.push(receiver.id)
        }
    }

    redeemabaleERC20.holders = holders
    redeemabaleERC20.save()
} 

function notIn(contacts: Trust__getContractsResultValue0Struct, key: Address): boolean {
    if(contacts.seeder == key)
        return true
    if(contacts.redeemableERC20 == key)
        return true
    if(contacts.redeemableERC20Pool == key)
        return true
    if(contacts.reserveERC20 == key)
        return true
    if(contacts.crp == key)
        return true
    if(contacts.pool == key)
        return true
    return true
}