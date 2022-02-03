import { ERC20Pull, Holder, RedeemableERC20, TreasuryAsset, TreasuryAssetCaller, Redeem} from "../generated/schema"
import { Initialize, Receiver, Sender, Transfer, ERC20PullInitialize, Redeem as RedeemEvent , TreasuryAsset as TreasuryAssetEvent} from "../generated/templates/RedeemableERC20Template/RedeemableERC20"
import { ZERO_ADDRESS, ZERO_BI } from "./utils"
import { RedeemableERC20 as RedeemabaleERC20Contract } from "../generated/TrustFactory/RedeemableERC20"
import { ERC20 } from "../generated/TrustFactory/ERC20"
import { dataSource, log } from "@graphprotocol/graph-ts"

export function handleInitialize(event: Initialize): void {
    let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex())

    redeemabaleERC20.sender = event.params.sender
    redeemabaleERC20.admin = event.params.admin
    // redeemabaleERC20.minimumTier = event.params.minimumTier

    redeemabaleERC20.save()
}

export function handleSender(event: Sender): void {
    let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex())
    let grantedSenders = redeemabaleERC20.grantedSenders
    grantedSenders.push(event.params.grantedSender)
    redeemabaleERC20.grantedSenders = grantedSenders
    redeemabaleERC20.save()
}

export function handleReceiver(event: Receiver): void {
    let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex())
    let grantedReceivers = redeemabaleERC20.grantedReceivers
    grantedReceivers.push(event.params.grantedReceiver)
    redeemabaleERC20.grantedSenders = grantedReceivers
    redeemabaleERC20.save()
}

export function handleTransfer(event: Transfer): void {
    let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex())
    let redeemabaleERC20Contract = RedeemabaleERC20Contract.bind(event.address)
    
    let holders = redeemabaleERC20.holders
    if(event.params.from.toHex() != ZERO_ADDRESS){
        let sender = Holder.load(event.address.toHex() + " - " + event.params.from.toHex())
        if(sender == null){
            sender = new Holder(event.address.toHex() + " - " + event.params.from.toHex())
            sender.balance = redeemabaleERC20Contract.balanceOf(event.params.from)
        }
        sender.balance = sender.balance.minus(event.params.value)
    }

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
        redeemabaleERC20.holders = holders
        redeemabaleERC20.save()
    }  
}

export function handleERC20PullInitialize(event: ERC20PullInitialize): void {
    let erc20pull = new ERC20Pull(event.transaction.hash.toHex())
    erc20pull.sender = event.params.sender
    erc20pull.tokenSender = event.params.tokenSender
    erc20pull.token = event.params.token
    erc20pull.save()
    
    let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex())
    redeemabaleERC20.erc20Pull = erc20pull.id
    redeemabaleERC20.save()
}

export function handleRedeem(event: RedeemEvent): void {
    let redeemableERC20 = RedeemableERC20.load(event.address.toHex())
    let totalRedeems = redeemableERC20.redeems.length
    let redeem = new Redeem(event.transaction.hash.toHex() + "-" + totalRedeems.toString())
    let treasuryAsset = TreasuryAsset.load(event.address.toHex() + " - " + event.params.treasuryAsset.toHex())
    let values = event.params.redeemAmounts
    let context = dataSource.context()

    redeem.redeemableERC20 = redeemableERC20.id
    redeem.caller = event.params.sender
    redeem.treasuryAsset = treasuryAsset.id
    redeem.treasuryAssetAmount = values[0]
    redeem.redeemAmount = values[1]
    redeem.deployBlock = event.block.number
    redeem.deployTimestamp = event.block.timestamp
    redeem.trust = context.getString("trust")
    redeem.save()

    let taredeems = treasuryAsset.redeems
    taredeems.push(redeem.id)
    treasuryAsset.redeems = taredeems

    treasuryAsset.save()

    let redeems = redeemableERC20.redeems
    redeems.push(redeem.id)
    redeemableERC20.redeems = redeems

    redeemableERC20.save()
}

export function handleTreasuryAsset(event: TreasuryAssetEvent): void {
    let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex())
    let context = dataSource.context()
    let treasuryAsset = TreasuryAsset.load(event.address.toHex() + " - " + event.params.asset.toHex())
    if(treasuryAsset == null){
        let treasuryAssetContract = ERC20.bind(event.params.asset)

        treasuryAsset = new TreasuryAsset(event.address.toHex() + " - " + event.params.asset.toHex())
        
        treasuryAsset.deployBlock = event.block.number
        treasuryAsset.deployTimestamp = event.block.timestamp
        treasuryAsset.name = treasuryAssetContract.name()
        treasuryAsset.symbol = treasuryAssetContract.symbol()
        treasuryAsset.decimals = treasuryAssetContract.decimals()
        treasuryAsset.totalSupply = treasuryAssetContract.totalSupply()
        treasuryAsset.balance = treasuryAssetContract.balanceOf(event.address)
        treasuryAsset.redeemableERC20 = redeemabaleERC20.id
        treasuryAsset.address = event.params.asset
        treasuryAsset.trust = context.getString("trust")
        treasuryAsset.callers = []
        treasuryAsset.redeems = [] 
    }

    let caller = new TreasuryAssetCaller(event.transaction.hash.toHex())
    caller.caller = event.params.sender
    caller.deployBlock = event.block.number
    caller.deployTimestamp = event.block.timestamp
    caller.trustAddress = context.getString("trust")
    caller.redeemableERC20Address = event.address
    caller.treasuryAsset = treasuryAsset.id
    caller.save()

    let callers = treasuryAsset.callers
    callers.push(caller.id)
    treasuryAsset.callers = callers

    treasuryAsset.save()
}

// export function handleRedeem(event: Event):void {
//     let redeemableERC20Address = dataSource.address()
//     let redeemableERC20 = RedeemableERC20.load(redeemableERC20Address.toHex())
//     let redeemabaleERC20Contract = ERC20.bind(redeemableERC20Address)

//     let context = dataSource.context()
//     let trustAddress = context.getString("trustAddress")
//     let _contracts = Contract.load(trustAddress)
//     let treasuryAsset = TreasuryAsset.load(redeemableERC20Address.toHex() + "-" +  event.params.treasuryAsset.toHex())
//     let treasuryAssetContract = ERC20.bind(Address.fromString(treasuryAsset.address.toHexString()))
//     let values = event.params.redeemAmounts
//     let totalRedeems = redeemableERC20.redeems.length

//     redeemableERC20.totalSupply = redeemabaleERC20Contract.totalSupply()


//     let redeem = new Redeem(event.transaction.hash.toHex() + "-" + totalRedeems.toString())
//     redeem.redeemableERC20 = redeemableERC20.id
//     redeem.caller = event.params.redeemer
//     redeem.treasuryAsset = treasuryAsset.id
//     redeem.treasuryAssetAmount = values[0]
//     redeem.redeemAmount = values[1]
//     redeem.block = event.block.number
//     redeem.timestamp = event.block.timestamp
//     redeem.trust = _contracts.id
//     redeem.save()

//     let taRedeems = treasuryAsset.redeems
//     taRedeems.push(redeem.id)
//     treasuryAsset.redeems = taRedeems

//     let balance = treasuryAssetContract.try_balanceOf(redeemableERC20Address)
//     if(balance.reverted){
//         log.debug("Reverted balance for {}", [treasuryAsset.id])
//         treasuryAsset.balance = null
//     }else{
//         treasuryAsset.balance = balance.value
//     }

//     if(redeemableERC20.totalSupply.gt(BigInt.fromI32(0)) && !!treasuryAsset.balance){
//         treasuryAsset.redemptionRatio = treasuryAsset.balance.times(BigInt.fromString('10').pow(18)).div(redeemableERC20.totalSupply)
//     }else{
//         treasuryAsset.redemptionRatio = BigInt.fromString("0.0")
//     }
//     treasuryAsset.save()

//     let redeems = redeemableERC20.redeems
//     redeems.push(redeem.id)
//     redeemableERC20.redeems = redeems
    

    
//     let seedERC20Contract = ERC20.bind(Address.fromString(_contracts.seeder))
//     let redeemableERC20Contract = RERC20.bind(Address.fromString(_contracts.redeemableERC20))
//     let seedERC20 = SeedERC20.load(_contracts.seeder)
//     let trustParticipant = TrustParticipant.load(event.params.redeemer.toHex() + "-" + trustAddress)
//     if(trustParticipant == null){
//         trustParticipant = new TrustParticipant(event.params.redeemer.toHex() + "-" + trustAddress)
//         trustParticipant.redeems = []
//         trustParticipant.swaps = []
//         trustParticipant.seeds = []
//         trustParticipant.unSeeds = []
//         trustParticipant.redeemSeeds = []
//         trustParticipant.trust = trustAddress
//         trustParticipant.user = event.params.redeemer

//         let trust = Trust.load(trustAddress)
//         let trustParticipants = trust.trustParticipants
//         trustParticipants.push(trustParticipant.id)
//         trust.trustParticipants = trustParticipants
//         trust.save()
//     }
//     trustParticipant.seedBalance = seedERC20Contract.balanceOf(event.params.redeemer)
//     trustParticipant.seedFeeClaimable = trustParticipant.seedBalance.times(seedERC20.seedFeePerUnit)
//     trustParticipant.tokenBalance = redeemableERC20Contract.balanceOf(event.params.redeemer)

//     let tredeems = trustParticipant.redeems
//     tredeems.push(redeem.id)
//     trustParticipant.redeems = tredeems

//     redeemableERC20.minimumTier = redeemableERC20Contract.minimumTier()
//     redeemableERC20.save()
//     trustParticipant.save()
// }

// export function handleTransfer(event: Transfer): void {
//     let redeemabaleERC20Address = dataSource.address()
//     let redeemabaleERC20 = RedeemableERC20.load(redeemabaleERC20Address.toHex())
//     let redeemabaleERC20Contract = ERC20.bind(redeemabaleERC20Address)
//     let holders = redeemabaleERC20.holders
//     let context = dataSource.context()
//     let trustAddress = context.getString("trustAddress")
//     let trustContract = TrustContract.bind(Address.fromString(trustAddress))
//     let _contracts = trustContract.getContracts()

//     if(event.params.from.toHex() != ZERO_ADDRESS && notIn(_contracts, event.params.from)){       
//         let sender = Holder.load(event.params.from.toHex() + "-" + redeemabaleERC20Address.toHex())
//         if(sender == null){
//             sender = new Holder(event.params.from.toHex() + "-" + redeemabaleERC20Address.toHex())
//             sender.address = event.params.from
//         }
//         sender.balance = redeemabaleERC20Contract.balanceOf(event.params.from)
//         sender.save()

//         if(!redeemabaleERC20.holders.includes(sender.id)){
//             holders.push(sender.id)
//         }
//     }
//     if(event.params.to.toHex() != ZERO_ADDRESS && notIn(_contracts, event.params.to)){
//         let receiver = Holder.load(event.params.to.toHex() + "-" + redeemabaleERC20Address.toHex())
//         if(receiver == null){
//             receiver = new Holder(event.params.to.toHex() + "-" + redeemabaleERC20Address.toHex())
//             receiver.address = event.params.to
//         }
//         receiver.balance = redeemabaleERC20Contract.balanceOf(event.params.to)
//         receiver.save()

//         if(!redeemabaleERC20.holders.includes(receiver.id)){
//             holders.push(receiver.id)
//         }
//     }

//     redeemabaleERC20.holders = holders
//     redeemabaleERC20.totalSupply = redeemabaleERC20Contract.totalSupply()
//     redeemabaleERC20.save()
// } 

// function notIn(contacts: Trust__getContractsResultValue0Struct, key: Address): boolean {
//     if(contacts.seeder == key)
//         return false
//     if(contacts.redeemableERC20 == key)
//         return false
//     if(contacts.redeemableERC20Pool == key)
//         return false
//     if(contacts.reserveERC20 == key)
//         return false
//     if(contacts.crp == key)
//         return false
//     if(contacts.pool == key)
//         return false
//     return true
// }

// export function handleTreasuryAsset(event: TreasuryAssetEvent): void {
//     let redeemabaleERC20Address = dataSource.address()
//     let redeemabaleERC20 = RedeemableERC20.load(redeemabaleERC20Address.toHex())
//     let context = dataSource.context()
//     let trustAddress = context.getString("trustAddress")
//     let trust = Trust.load(trustAddress)

//     let treasuryAssetContract = ERC20.bind(event.params.asset)

//     let treasuryAsset = new TreasuryAsset(redeemabaleERC20Address.toHex() + "-" + event.params.asset.toHex())
//     treasuryAsset.callers = []
//     treasuryAsset.redeems = []
//     treasuryAsset.address = event.params.asset
//     treasuryAsset.block = event.block.number
//     treasuryAsset.timestamp = event.block.timestamp
//     treasuryAsset.redeemableERC20 = redeemabaleERC20.id

//     let treasuryAssetBalance = treasuryAssetContract.try_balanceOf(redeemabaleERC20Address)

//     if (treasuryAssetBalance.reverted) {
//         log.debug("Reverted balance for {}", [treasuryAsset.id])
//         treasuryAsset.balance = null
//     } else {
//         treasuryAsset.balance = treasuryAssetBalance.value
//     }

//     if(redeemabaleERC20.totalSupply.gt(BigInt.fromI32(0)) && !!treasuryAsset.balance){
//         treasuryAsset.redemptionRatio = treasuryAsset.balance.times(BigInt.fromString('10').pow(18)).div(redeemabaleERC20.totalSupply)
//     }else{
//         treasuryAsset.redemptionRatio = BigInt.fromString("0.0")
//     }
//     treasuryAsset.trust = trust.id

    // let caller = new TreasuryAssetCaller(event.transaction.hash.toHex())
    // caller.caller = event.params.emitter
    // caller.block = event.block.number
    // caller.timestamp = event.block.timestamp
    // caller.trustAddress = Address.fromString(trustAddress)
    // caller.redeemableERC20Address = redeemabaleERC20Address
    // caller.treasuryAsset = treasuryAsset.id
    // caller.save()

//     let callers = treasuryAsset.callers
//     callers.push(caller.id)
//     treasuryAsset.callers = callers

//     let name = treasuryAssetContract.try_name()
//     if(name.reverted){
//         log.debug("Reverted name for {}", [treasuryAsset.id])
//         treasuryAsset.name = null
//     }else{
//         treasuryAsset.name = name.value
//     }

//     let symbol = treasuryAssetContract.try_symbol()
//     if(symbol.reverted){
//         log.debug("Reverted symbol for {}", [treasuryAsset.id])
//         treasuryAsset.symbol = null
//     }else{
//         treasuryAsset.symbol = symbol.value
//     }
    
//     let decimals = treasuryAssetContract.try_decimals()
//     if(decimals.reverted){
//         log.debug("Reverted decimals for {}", [treasuryAsset.id])
//         treasuryAsset.decimals = null
//     }else{
//         treasuryAsset.decimals = decimals.value
//     }

//     let totalSupply = treasuryAssetContract.try_totalSupply()
//     if(totalSupply.reverted){
//         log.debug("Reverted totalSupply for {}", [treasuryAsset.id])
//         treasuryAsset.totalSupply = null
//     }else{
//         treasuryAsset.totalSupply = totalSupply.value
//     }
//     log.info("Assets : {} -- Redeemable : {}", [ event.params.asset.toHex() , redeemabaleERC20Address.toHex()])
//     let balance = treasuryAssetContract.try_balanceOf(redeemabaleERC20Address)
//     if(balance.reverted){
//         log.debug("Reverted balance for {}", [treasuryAsset.id])
//         treasuryAsset.balance = null
//     }else{
//         treasuryAsset.balance = balance.value
//     }
    
//     treasuryAsset.save()
//     // let treasuryAssetContext = new DataSourceContext()
//     // treasuryAssetContext.setString("redeemableERC20", redeemabaleERC20Address.toHex())
//     // TreasuryAssetTemplate.createWithContext(event.params.asset, treasuryAssetContext)

//     if(!redeemabaleERC20.treasuryAssets.includes(treasuryAsset.id)){
//         let treasuryAssets = redeemabaleERC20.treasuryAssets
//         treasuryAssets.push(treasuryAsset.id)
//         redeemabaleERC20.treasuryAssets = treasuryAssets
//         redeemabaleERC20.save()
//     }
// }