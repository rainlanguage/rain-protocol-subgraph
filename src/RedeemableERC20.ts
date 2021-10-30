import { dataSource, BigInt} from "@graphprotocol/graph-ts"
import { Redeem, RedeemableERC20 } from "../generated/schema"
import { Redeem as Event } from "../generated/templates/RedeemableERC20Template/RedeemableERC20"

let ONE_BI = BigInt.fromI32(1)

export function handleRedeem(event: Event):void {
    let redeemableERC20Address = dataSource.address()
    let redeemableERC20 = RedeemableERC20.load(redeemableERC20Address.toHex())

    let redeem = new Redeem(event.transaction.hash.toHex())
    redeem.redeemable = redeemableERC20.id
    redeem.caller = event.params.redeemer
    redeem.tokenAmount = event.params.redeemAmounts.pop()
    redeem.redeemAmount = event.params.redeemAmounts.pop()
    redeem.block = event.block.number
    redeem.save()

    let redeems = redeemableERC20.redeems
    redeems.push(redeem.id)
    redeemableERC20.redeems = redeems
    redeemableERC20.save()
}