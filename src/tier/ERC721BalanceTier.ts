import { ERC721, ERC721BalanceTier } from "../../generated/schema";
import {
  Initialize,
  TierChange,
  InitializeValueTier,
} from "../../generated/templates/ERC721BalanceTierTemplate/ERC721BalanceTier";
import { ERC721 as ERC721Contract } from "../../generated/ERC721BalanceTierFactory/ERC721";

export function handleInitialize(event: Initialize): void {
  let erc721BalanceTier = ERC721BalanceTier.load(event.address.toHex());

  let erc721 = getERC721(event);
  erc721.save();
  if (erc721BalanceTier) {
    erc721BalanceTier.token = erc721.id;
    erc721BalanceTier.save();
  }
}
export function handleInitializeValueTier(event: InitializeValueTier): void {
  //
}

export function handleTierChange(event: TierChange): void {
  //
}

function getERC721(event: Initialize): ERC721 {
  let erc721 = ERC721.load(event.params.erc721.toHex());
  let erc20Contract = ERC721Contract.bind(event.params.erc721);
  if (erc721 == null) {
    erc721 = new ERC721(event.params.erc721.toHex());
    erc721.deployBlock = event.block.number;
    erc721.deployTimestamp = event.block.timestamp;
    let name = erc20Contract.try_name();
    let symbol = erc20Contract.try_symbol();
    let totalSupply = erc20Contract.try_totalSupply();
    if (!(name.reverted || symbol.reverted || totalSupply.reverted)) {
      erc721.name = name.value;
      erc721.symbol = symbol.value;
      erc721.totalSupply = totalSupply.value;
    }
  }
  return erc721 as ERC721;
}
