import { dataSource, BigInt, Address, log, DataSourceContext} from "@graphprotocol/graph-ts"
import { Trust as TrustContract, Trust__getContractsResultValue0Struct } from "../generated/RainProtocol/Trust"
import { Caller, Contract, Holder, Redeem, RedeemableERC20, SeedERC20, TreasuryAsset, Trust, TrustParticipant} from "../generated/schema"
import { Redeem as Event , Transfer, TreasuryAsset as TreasuryAssetEvent} from "../generated/templates/RedeemableERC20Template/RedeemableERC20"
import { ERC20 } from "../generated/templates/RedeemableERC20Template/ERC20"
import { RedeemableERC20 as RERC20} from "../generated/RainProtocol/RedeemableERC20"
import { TreasuryAssetTemplate } from "../generated/templates"

let ONE_BI = BigInt.fromI32(1)
let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

export function handleRedeem(event: Event):void {
    let redeemableERC20Address = dataSource.address()
    let context = dataSource.context()
    let trustAddress = context.getString("trustAddress")
    let _contracts = Contract.load(trustAddress)
    let redeemableERC20 = RedeemableERC20.load(redeemableERC20Address.toHex())
    let treasuryAsset = TreasuryAsset.load(redeemableERC20Address.toHex() + "-" +  event.params.treasuryAsset.toHex())
    let values = event.params.redeemAmounts
    let totalRedeems = redeemableERC20.redeems.length
    let redeem = new Redeem(event.transaction.hash.toHex() + "-" + totalRedeems.toString())
    redeem.redeemableERC20 = redeemableERC20.id
    redeem.caller = event.params.redeemer
    redeem.treasuryAsset = treasuryAsset.id
    redeem.treasuryAssetAmount = values[0]
    redeem.redeemAmount = values[1]
    redeem.block = event.block.number
    redeem.timestamp = event.block.timestamp
    redeem.trust = _contracts.id
    redeem.save()

    let caller = new Caller(event.transaction.hash.toHex())
    caller.caller = event.params.redeemer
    caller.block = event.block.number
    caller.timestamp = event.block.timestamp
    caller.save()

    let callers = treasuryAsset.callers
    callers.push(caller.id)
    treasuryAsset.callers = callers
    treasuryAsset.save()

    let redeems = redeemableERC20.redeems
    redeems.push(redeem.id)
    redeemableERC20.redeems = redeems
    

    
    let seedERC20Contract = ERC20.bind(Address.fromString(_contracts.seeder))
    let redeemableERC20Contract = RERC20.bind(Address.fromString(_contracts.redeemableERC20))
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

    redeemableERC20.minimumTier = redeemableERC20Contract.minimumTier()
    redeemableERC20.save()
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
    redeemabaleERC20.totalSupply = redeemabaleERC20Contract.totalSupply()
    redeemabaleERC20.save()
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

export function handleTreasuryAsset(event: TreasuryAssetEvent): void {
    let redeemabaleERC20Address = dataSource.address()
    let redeemabaleERC20 = RedeemableERC20.load(redeemabaleERC20Address.toHex())
    let context = dataSource.context()
    let trustAddress = context.getString("trustAddress")
    let trust = Trust.load(trustAddress)

    let treasuryAssetContract = ERC20.bind(event.params.asset)

    let treasuryAsset = new TreasuryAsset(redeemabaleERC20Address.toHex() + "-" + event.params.asset.toHex())
    treasuryAsset.callers = []
    treasuryAsset.address = event.params.asset
    treasuryAsset.block = event.block.number
    treasuryAsset.timestamp = event.block.timestamp
    treasuryAsset.redeemableERC20 = redeemabaleERC20.id
    treasuryAsset.trust = trust.id

    let caller = new Caller(event.transaction.hash.toHex())
    caller.caller = event.params.emitter
    caller.block = event.block.number
    caller.timestamp = event.block.timestamp
    caller.save()

    let callers = treasuryAsset.callers
    callers.push(caller.id)
    treasuryAsset.callers = callers

    let name = treasuryAssetContract.try_name()
    if(name.reverted){
        log.debug("Reverted name for {}", [treasuryAsset.id])
        treasuryAsset.name = null
    }else{
        treasuryAsset.name = name.value
    }

    let symbol = treasuryAssetContract.try_symbol()
    if(symbol.reverted){
        log.debug("Reverted symbol for {}", [treasuryAsset.id])
        treasuryAsset.symbol = null
    }else{
        treasuryAsset.symbol = symbol.value
    }
    
    let decimals = treasuryAssetContract.try_decimals()
    if(decimals.reverted){
        log.debug("Reverted decimals for {}", [treasuryAsset.id])
        treasuryAsset.decimals = null
    }else{
        treasuryAsset.decimals = decimals.value
    }

    let totalSupply = treasuryAssetContract.try_totalSupply()
    if(totalSupply.reverted){
        log.debug("Reverted totalSupply for {}", [treasuryAsset.id])
        treasuryAsset.totalSupply = null
    }else{
        treasuryAsset.totalSupply = totalSupply.value
    }
    log.info("Assets : {} -- Redeemable : {}", [ event.params.asset.toHex() , redeemabaleERC20Address.toHex()])
    let balance = treasuryAssetContract.try_balanceOf(redeemabaleERC20Address)
    if(balance.reverted){
        log.debug("Reverted balance for {}", [treasuryAsset.id])
        treasuryAsset.balance = null
    }else{
        treasuryAsset.balance = balance.value
    }
    
    treasuryAsset.save()
    let treasuryAssetContext = new DataSourceContext()
    treasuryAssetContext.setString("redeemableERC20", redeemabaleERC20Address.toHex())
    TreasuryAssetTemplate.createWithContext(event.params.asset, treasuryAssetContext)

    if(!redeemabaleERC20.treasuryAssets.includes(treasuryAsset.id)){
        let treasuryAssets = redeemabaleERC20.treasuryAssets
        treasuryAssets.push(treasuryAsset.id)
        redeemabaleERC20.treasuryAssets = treasuryAssets
        redeemabaleERC20.save()
    }
}