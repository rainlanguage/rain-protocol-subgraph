import {
  CreatedGatedNFT,
  OwnershipTransferred as OwnershipTransferredEvent,
  UpdatedRoyaltyRecipient as UpdatedRoyaltyRecipientEvent,
  Transfer as TransferEvent,
} from "../../generated/templates/GatedNFTTemplate/GatedNFT";
import {
  GatedNFT,
  UpdatedRoyaltyRecipient,
  OwnershipTransferred,
  GatedToken,
  GatedTokenOwner,
  HistoricalTransfer,
  ERC20BalanceTier,
  ERC20TransferTier,
  ERC721BalanceTier,
  CombineTier,
  VerifyTier,
  UnknownTier,
} from "../../generated/schema";
import { HUNDRED_BD, ZERO_ADDRESS, ZERO_BI } from "../utils";
import { Address } from "@graphprotocol/graph-ts";

export function handleCreatedGatedNFT(event: CreatedGatedNFT): void {
  let gatedNFT = GatedNFT.load(event.address.toHex());
  if (gatedNFT) {
    gatedNFT.name = event.params.config.name;
    gatedNFT.symbol = event.params.config.symbol;
    gatedNFT.creator = event.params.creator;
    gatedNFT.minimumStatus = event.params.minimumStatus;
    gatedNFT.tokensMinted = ZERO_BI;
    gatedNFT.maxMintable = event.params.maxMintable;
    gatedNFT.maxPerAddress = event.params.maxPerAddress;
    gatedNFT.transferrable = event.params.transferrable;
    gatedNFT.royaltyRecipient = event.params.royaltyRecipient;
    gatedNFT.royaltyBPS = event.params.royaltyBPS;
    gatedNFT.royaltyPercent = event.params.royaltyBPS
      .toBigDecimal()
      .div(HUNDRED_BD);
    gatedNFT.animationHash = event.params.config.animationHash;
    gatedNFT.animationUrl = event.params.config.animationUrl;
    gatedNFT.imageHash = event.params.config.imageHash;
    gatedNFT.imageUrl = event.params.config.imageUrl;
    gatedNFT.description = event.params.config.description;
    gatedNFT.tier = getTier(event.params.tier.toHex());

    gatedNFT.save();
  }
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let gatedNFT = GatedNFT.load(event.address.toHex());
  let ownershipTransferred = new OwnershipTransferred(
    event.transaction.hash.toHex()
  );

  if (gatedNFT) {
    gatedNFT.owner = event.params.newOwner;

    ownershipTransferred.emitter = event.address;
    ownershipTransferred.sender = event.transaction.from;
    ownershipTransferred.oldOwner = event.params.previousOwner;
    ownershipTransferred.newOwner = event.params.newOwner;
    ownershipTransferred.block = event.block.number;
    ownershipTransferred.timestamp = event.block.timestamp;
    ownershipTransferred.save();

    let ownershipHistory = gatedNFT.ownershipHistory;
    if (ownershipHistory) ownershipHistory.push(ownershipTransferred.id);
    gatedNFT.ownershipHistory = ownershipHistory;
    gatedNFT.save();
  }
}

export function handleUpdatedRoyaltyRecipient(
  event: UpdatedRoyaltyRecipientEvent
): void {
  let gatedNFT = GatedNFT.load(event.address.toHex());

  if (gatedNFT) {
    gatedNFT.royaltyRecipient = event.params.royaltyRecipient;

    let updatedRoyaltyRecipient = new UpdatedRoyaltyRecipient(
      event.transaction.hash.toHex()
    );

    updatedRoyaltyRecipient.nftContract = gatedNFT.id;
    updatedRoyaltyRecipient.origin = event.transaction.from;
    updatedRoyaltyRecipient.newRoyaltyRecipient = event.params.royaltyRecipient;
    updatedRoyaltyRecipient.block = event.block.number;
    updatedRoyaltyRecipient.timestamp = event.block.timestamp;

    updatedRoyaltyRecipient.save();

    let royaltyRecipientHistory = gatedNFT.royaltyRecipientHistory;
    if (royaltyRecipientHistory)
      royaltyRecipientHistory.push(updatedRoyaltyRecipient.id);
    gatedNFT.royaltyRecipientHistory = royaltyRecipientHistory;
    gatedNFT.save();
  }
}

export function handleTransfer(event: TransferEvent): void {
  let historicalTransfer = new HistoricalTransfer(
    event.transaction.hash.toHex()
  );
  historicalTransfer.transactionHash = event.transaction.hash;
  historicalTransfer.from = event.params.from;
  historicalTransfer.to = event.params.to;
  historicalTransfer.tokenId = event.params.tokenId;
  historicalTransfer.eventBlock = event.block.number;
  historicalTransfer.eventTimestamp = event.block.timestamp;

  let gatedToken = GatedToken.load(event.address.toHex());
  if (gatedToken == null) {
    gatedToken = new GatedToken(
      event.address.toHex() + " - " + event.params.tokenId.toString()
    );

    gatedToken.tokenId = event.params.tokenId;
    gatedToken.ownerAddress = event.params.to;
    gatedToken.gatedNFTAddress = event.address;
    gatedToken.mintBlock = event.block.number;
    gatedToken.mintTimestamp = event.block.timestamp;
    gatedToken.transferHistory = [];
  }
  gatedToken.ownerAddress = event.params.to;

  if (event.params.to.toHex() != ZERO_ADDRESS) {
    let history = gatedToken.transferHistory;
    if (history) history.push(historicalTransfer.id);
    gatedToken.transferHistory = history;
  }

  historicalTransfer.save();
  gatedToken.save();
}

function getTier(tierAddress: string): string {
  let eRC20BalanceTier = ERC20BalanceTier.load(tierAddress);
  if (eRC20BalanceTier) return eRC20BalanceTier.id;
  let eRC20TransferTier = ERC20TransferTier.load(tierAddress);
  if (eRC20TransferTier) return eRC20TransferTier.id;
  let eRC721BalanceTier = ERC721BalanceTier.load(tierAddress);
  if (eRC721BalanceTier) return eRC721BalanceTier.id;
  let combineTier = CombineTier.load(tierAddress);
  if (combineTier) return combineTier.id;
  let verifyTier = VerifyTier.load(tierAddress);
  if (verifyTier) return verifyTier.id;
  let uknownTier = UnknownTier.load(tierAddress);
  if (!uknownTier) {
    uknownTier = new UnknownTier(tierAddress);
    uknownTier.address = Address.fromString(tierAddress);
    uknownTier.deployBlock = ZERO_BI;
    uknownTier.deployTimestamp = ZERO_BI;
    uknownTier.deployer = Address.fromString(ZERO_ADDRESS);
    uknownTier.save();
  }
  return uknownTier.id;
}
