import { Address, BigDecimal, BigInt, dataSource, log } from "@graphprotocol/graph-ts";
import { RedeemableERC20, TreasuryAsset } from "../generated/schema";
import { ERC20, Transfer } from "../generated/templates/TreasuryAssetTemplate/ERC20";

export function handleTransfer(event: Transfer): void {
    let context = dataSource.context()
    let redeemableERC20Address = context.getString("redeemableERC20")
    if(event.params.from.equals(Address.fromString(redeemableERC20Address)) || event.params.to.equals(Address.fromString(redeemableERC20Address))){
        log.info("In Transfere", [])
        let treasuryAssetAddress = dataSource.address()
        let redeemabaleERC20 = RedeemableERC20.load(redeemableERC20Address)
        let treasuryAssetContract = ERC20.bind(treasuryAssetAddress)
        let treasuryAsset = TreasuryAsset.load(redeemableERC20Address + "-" + treasuryAssetAddress.toHex())
        treasuryAsset.balance = treasuryAssetContract.balanceOf(Address.fromString(redeemableERC20Address))
        if(redeemabaleERC20.totalSupply.gt(BigInt.fromI32(0))){
            treasuryAsset.sharePerRedeemable = treasuryAsset.balance.toBigDecimal().div(redeemabaleERC20.totalSupply.toBigDecimal())
        }
        treasuryAsset.save()
    }
}