import { ERC20, ERC20BalanceTier } from "../../generated/schema";
import {
  Initialize,
  TierChange,
  InitializeValueTier,
} from "../../generated/templates/ERC20BalanceTierTemplate/ERC20BalanceTier";
import { ERC20 as ERC20Contract } from "../../generated/ERC20BalanceTierFactory/ERC20";

export function handleInitialize(event: Initialize): void {
  let erc20BalanceTier = ERC20BalanceTier.load(event.address.toHex());

  let erc20 = getERC20(event);
  erc20.save();
  if (erc20BalanceTier) {
    erc20BalanceTier.token = erc20.id;
    erc20BalanceTier.save();
  }
}
export function handleInitializeValueTier(event: InitializeValueTier): void {}

export function handleTierChange(event: TierChange): void {}

function getERC20(event: Initialize): ERC20 {
  let erc20 = ERC20.load(event.params.erc20.toHex());
  let erc20Contract = ERC20Contract.bind(event.params.erc20);
  if (erc20 == null) {
    erc20 = new ERC20(event.params.erc20.toHex());
    erc20.deployBlock = event.block.number;
    erc20.deployTimestamp = event.block.timestamp;
    let name = erc20Contract.try_name();
    let symbol = erc20Contract.try_symbol();
    let decimals = erc20Contract.try_decimals();
    let totalSupply = erc20Contract.try_totalSupply();
    if (
      !(
        name.reverted ||
        symbol.reverted ||
        decimals.reverted ||
        totalSupply.reverted
      )
    ) {
      erc20.name = name.value;
      erc20.symbol = symbol.value;
      erc20.decimals = decimals.value;
      erc20.totalSupply = totalSupply.value;
    }
  }
  return erc20 as ERC20;
}
