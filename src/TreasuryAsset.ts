import { Address, dataSource, log } from "@graphprotocol/graph-ts";
import { TreasuryAsset } from "../generated/schema";
import { ERC20, Transfer } from "../generated/templates/TreasuryAssetTemplate/ERC20";

export function handleTransfer(event: Transfer): void {
    let treasuryAssetAddress = dataSource.address()
    let context = dataSource.context()
    let redeemableERC20Address = context.getString("redeemableERC20")
    let treasuryAssetContract = ERC20.bind(treasuryAssetAddress)
    let treasuryAsset = TreasuryAsset.load(redeemableERC20Address + "-" + treasuryAssetAddress.toHex())
    treasuryAsset.balance = treasuryAssetContract.balanceOf(Address.fromString(redeemableERC20Address))
    treasuryAsset.save()
}