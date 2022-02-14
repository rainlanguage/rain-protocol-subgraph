import { ERC20Pull, Holder, RedeemableERC20, TreasuryAsset, TreasuryAssetCaller, Redeem} from "../../generated/schema"
import { Initialize, Receiver, Sender, Transfer, ERC20PullInitialize, Redeem as RedeemEvent , TreasuryAsset as TreasuryAssetEvent} from "../../generated/templates/RedeemableERC20Template/RedeemableERC20"
import { getTrustParticipent, ZERO_ADDRESS, ZERO_BI } from "../utils"
import { RedeemableERC20 as RedeemabaleERC20Contract } from "../../generated/TrustFactory/RedeemableERC20"
import { ERC20 } from "../../generated/TrustFactory/ERC20"
import { dataSource ,log } from "@graphprotocol/graph-ts"

export function handleInitialize(event: Initialize): void {
    let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex())

    redeemabaleERC20.sender = event.params.sender
    redeemabaleERC20.admin = event.params.admin
    redeemabaleERC20.minimumTier = event.params.minimumTier

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
            redeemabaleERC20.holders = holders
            redeemabaleERC20.save()
        }
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
    let context = dataSource.context()

    redeem.redeemableERC20 = redeemableERC20.id
    redeem.caller = event.params.sender
    redeem.treasuryAsset = treasuryAsset.id
    redeem.treasuryAssetAmount = event.params.assetAmount
    redeem.redeemAmount = event.params.redeemAmount
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

    let trustParticipant = getTrustParticipent(event.params.sender, redeem.trust)
    let tpRedeems = trustParticipant.redeems
    tpRedeems.push(redeem.id)
    trustParticipant.redeems = tpRedeems
    
    trustParticipant.save()
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
        
        let name = treasuryAssetContract.try_name()
        let symbol = treasuryAssetContract.try_symbol()
        let decimals = treasuryAssetContract.try_decimals()
        let totalSupply = treasuryAssetContract.try_totalSupply()
        let balance = treasuryAssetContract.try_balanceOf(event.address)
        if(!(name.reverted || symbol.reverted || decimals.reverted || totalSupply.reverted || balance.reverted)){
            treasuryAsset.name = name.value
            treasuryAsset.symbol = symbol.value
            treasuryAsset.decimals = decimals.value
            treasuryAsset.totalSupply = totalSupply.value
            treasuryAsset.balance = balance.value
        }

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

    redeemabaleERC20.treasuryAssets.push(treasuryAsset.id)
    redeemabaleERC20.save()

    let rERC20treasuryAssets = redeemabaleERC20.treasuryAssets
    rERC20treasuryAssets.push(treasuryAsset.id)
    redeemabaleERC20.treasuryAssets = rERC20treasuryAssets

    redeemabaleERC20.save()

    treasuryAsset.save()
}