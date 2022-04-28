import {
  ERC20Pull,
  Holder,
  RedeemableERC20,
  TreasuryAsset,
  TreasuryAssetCaller,
  Redeem,
  Contract,
  ERC20BalanceTier,
  ERC20TransferTier,
  ERC721BalanceTier,
  VerifyTier,
  CombineTier,
  UnknownTier,
} from "../../generated/schema";
import {
  Initialize,
  Receiver,
  Sender,
  Transfer,
  ERC20PullInitialize,
  Redeem as RedeemEvent,
  TreasuryAsset as TreasuryAssetEvent,
} from "../../generated/templates/RedeemableERC20Template/RedeemableERC20";
import {
  getTrustParticipent,
  notAContract,
  ZERO_ADDRESS,
  ZERO_BI,
} from "../utils";
import { RedeemableERC20 as RedeemabaleERC20Contract } from "../../generated/TrustFactory/RedeemableERC20";
import { ERC20 } from "../../generated/TrustFactory/ERC20";
import { Address, dataSource } from "@graphprotocol/graph-ts";

/**
 * @description Handler for Initialize event emited by RedeemableERC20
 * @param event Initialize event
 */
export function handleInitialize(event: Initialize): void {
  // Load the RedeemableERC20 entity
  let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex());

  if (redeemabaleERC20) {
    redeemabaleERC20.factory = event.params.sender;
    redeemabaleERC20.admin = event.params.config.erc20Config.distributor;
    redeemabaleERC20.minimumTier = event.params.config.minimumTier;

    // Get DataSourceContext
    let context = dataSource.context();

    // Load the contracts entity
    let contracts = Contract.load(context.getString("trust"));

    // Set the Tier address in Contracts entity
    if (contracts) {
      contracts.tier = getTier(event.params.config.tier.toHex());
      contracts.save();
    }

    // Set Tier in RedeemableERC20 entity
    redeemabaleERC20.tier = getTier(event.params.config.tier.toHex());
    redeemabaleERC20.save();
  }
}

/**
 * @description Handler for Sender event emited by RedeemableERC20 Contract to add Granted Senders
 * @param event Sender event
 */
export function handleSender(event: Sender): void {
  // Load RedeemableERC20 entity
  let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex());

  // Add Granted Sender in Redeemable
  if (redeemabaleERC20) {
    let grantedSenders = redeemabaleERC20.grantedSenders;
    if (grantedSenders) grantedSenders.push(event.params.grantedSender);
    redeemabaleERC20.grantedSenders = grantedSenders;
    redeemabaleERC20.save();
  }
}

/**
 * @description Handler for Receiver event emited by RedeemableERC20 Contract to add Granted Receiver
 * @param event Receiver event
 */
export function handleReceiver(event: Receiver): void {
  // Load RedeemableERC20 entity
  let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex());

  // Add Granted Sender in Redeemable
  if (redeemabaleERC20) {
    let grantedReceivers = redeemabaleERC20.grantedReceivers;
    if (grantedReceivers) grantedReceivers.push(event.params.grantedReceiver);
    redeemabaleERC20.grantedReceivers = grantedReceivers;
    redeemabaleERC20.save();
  }
}

/**
 * @deprecated hnadler for Transfer evnt emited from RedeemableERC20 token contract
 * @param event Transfer event
 */
export function handleTransfer(event: Transfer): void {
  if (event.params.value != ZERO_BI) {
    // Load the RedeemableERC20 entity
    let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex());

    // Bind RedeemableERC20 token address to RedeemableERC20 abi to make readonly calls
    let redeemabaleERC20Contract = RedeemabaleERC20Contract.bind(event.address);

    // Get the DataSourceContext
    let context = dataSource.context();

    // Get all the Holders of RedeemableERC20
    if (redeemabaleERC20) {
      let holders = redeemabaleERC20.holders;

      // Check if Sender is not any contract address or Zero address
      if (notAContract(event.params.from.toHex(), context.getString("trust"))) {
        // Load the Sender's Holder entity
        let sender = Holder.load(
          event.address.toHex() + " - " + event.params.from.toHex()
        );

        // Create a new Holders entity if Sender doesnot exists
        if (!sender) {
          sender = new Holder(
            event.address.toHex() + " - " + event.params.from.toHex()
          );
        }

        // Set the sender's balance
        sender.balance = redeemabaleERC20Contract.balanceOf(event.params.from);
      }

      // Check if Receiver is not any contract address or Zero address
      if (notAContract(event.params.to.toHex(), context.getString("trust"))) {
        // Load the Receiver's Holder entity
        let receiver = Holder.load(
          event.address.toHex() + " - " + event.params.to.toHex()
        );

        // Create a new Holders entity if Receiver doesnot exists
        if (!receiver) {
          receiver = new Holder(
            event.address.toHex() + " - " + event.params.to.toHex()
          );
          // Set the Reciver's balance
          receiver.balance = ZERO_BI;
        }

        // Update the Receiver balance
        // Set the sender's balance
        receiver.balance = redeemabaleERC20Contract.balanceOf(event.params.to);
        receiver.address = event.params.to;
        receiver.save();

        // Add the Receiver in Holders if not already exists
        if (holders && !holders.includes(receiver.id)) {
          holders.push(receiver.id);
          redeemabaleERC20.holders = holders;
          redeemabaleERC20.save();
        }
      }
    }
  }
}

/**
 * @description Handler for ERC20PullInitialize event emited by RedeemableERC20 contract
 * @param event
 */
export function handleERC20PullInitialize(event: ERC20PullInitialize): void {
  // Create a new ERC20Pull using transaction hash
  let erc20pull = new ERC20Pull(event.address.toHex());
  erc20pull.sender = event.params.sender;
  erc20pull.tokenSender = event.params.tokenSender;
  erc20pull.token = event.params.token;
  erc20pull.save();

  // Add the ERC20Pull entity to RedemableERC20
  let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex());
  if (redeemabaleERC20) {
    redeemabaleERC20.erc20Pull = erc20pull.id;
    redeemabaleERC20.save();
  }
}

/**
 * @description Handler for Redeem event emited from RedeemableERC20 contract
 * @param event Redeem
 */
export function handleRedeem(event: RedeemEvent): void {
  // Load the RedeemableERC20 entity
  let redeemableERC20 = RedeemableERC20.load(event.address.toHex());

  // Get the total count of current redeems
  if (redeemableERC20) {
    let totalRedeems = redeemableERC20.redeems.length;

    // Create a new Redeem with "transaction.hash - totalRedeems"
    let redeem = new Redeem(
      event.transaction.hash.toHex() + " - " + totalRedeems.toString()
    );

    // Load the TreasuryAsset
    let treasuryAsset = TreasuryAsset.load(
      event.address.toHex() + " - " + event.params.treasuryAsset.toHex()
    );

    // Get the DatasourceContext
    let context = dataSource.context();

    redeem.redeemableERC20 = redeemableERC20.id;
    redeem.caller = event.params.sender;
    if (treasuryAsset) redeem.treasuryAsset = treasuryAsset.id;
    redeem.treasuryAssetAmount = event.params.assetAmount;
    redeem.redeemAmount = event.params.redeemAmount;
    redeem.deployBlock = event.block.number;
    redeem.deployTimestamp = event.block.timestamp;
    redeem.trust = context.getString("trust");
    redeem.save();

    // Add the newlyu created Redeem into TreasuryAsset entity
    if (treasuryAsset) {
      let taredeems = treasuryAsset.redeems;
      if (taredeems) taredeems.push(redeem.id);
      treasuryAsset.redeems = taredeems;

      treasuryAsset.save();
    }

    // Add the newlyu created Redeem into RedeemableERC20 entity
    let redeems = redeemableERC20.redeems;
    redeems.push(redeem.id);
    redeemableERC20.redeems = redeems;

    redeemableERC20.save();

    // Get the TrustParticipent
    let trustParticipant = getTrustParticipent(
      event.params.sender,
      redeem.trust
    );

    if (trustParticipant) {
      let tpRedeems = trustParticipant.redeems;
      if (tpRedeems) tpRedeems.push(redeem.id);
      trustParticipant.redeems = tpRedeems;

      trustParticipant.save();
    }
  }
}

/**
 * @description Handler for TreasuryAsset event emited by RedeemableERC20 token contract
 * @param event TreasuryAsset event
 */
export function handleTreasuryAsset(event: TreasuryAssetEvent): void {
  // Load the RedeemableERC20 entity
  let redeemabaleERC20 = RedeemableERC20.load(event.address.toHex());

  // Bind the RedeemableERC20 Token Address to RedeemableERC20 abi to make readonly
  let redeemabaleERC20Contract = RedeemabaleERC20Contract.bind(event.address);

  // Get the DataSourceContext
  let context = dataSource.context();

  // Load the TreasuryAsset entity
  let treasuryAsset = TreasuryAsset.load(
    event.address.toHex() + " - " + event.params.asset.toHex()
  );

  // If TreasuryAsset does not exist create a new one
  if (treasuryAsset == null) {
    // Bind the TreasuryAsset Address to TreasuryAsset abi
    let treasuryAssetContract = ERC20.bind(event.params.asset);

    // Create new TreasuryAsset entity
    treasuryAsset = new TreasuryAsset(
      event.address.toHex() + " - " + event.params.asset.toHex()
    );

    treasuryAsset.deployBlock = event.block.number;
    treasuryAsset.deployTimestamp = event.block.timestamp;

    // Try to kame call to TreasuryAsset Contract wit try_
    let name = treasuryAssetContract.try_name();
    let symbol = treasuryAssetContract.try_symbol();
    let decimals = treasuryAssetContract.try_decimals();
    let totalSupply = treasuryAssetContract.try_totalSupply();
    let balance = treasuryAssetContract.try_balanceOf(event.address);
    if (
      !(
        name.reverted ||
        symbol.reverted ||
        decimals.reverted ||
        totalSupply.reverted ||
        balance.reverted
      )
    ) {
      treasuryAsset.name = name.value;
      treasuryAsset.symbol = symbol.value;
      treasuryAsset.decimals = decimals.value;
      treasuryAsset.totalSupply = totalSupply.value;
      treasuryAsset.balance = balance.value;
      treasuryAsset.redemptionRatio = balance.value.div(
        redeemabaleERC20Contract.totalSupply()
      );
    }

    if (redeemabaleERC20) treasuryAsset.redeemableERC20 = redeemabaleERC20.id;
    treasuryAsset.address = event.params.asset;
    treasuryAsset.trust = context.getString("trust");
    treasuryAsset.callers = [];
    treasuryAsset.redeems = [];
  }
  // Create a new TreasuryAssetCaller
  let caller = new TreasuryAssetCaller(event.transaction.hash.toHex());
  caller.caller = event.params.sender;
  caller.deployBlock = event.block.number;
  caller.deployTimestamp = event.block.timestamp;
  caller.trustAddress = context.getString("trust");
  caller.redeemableERC20Address = event.address;
  caller.treasuryAsset = treasuryAsset.id;
  caller.save();

  // Add teh TreasuryAssetCaller to the TreasuryAsset
  let callers = treasuryAsset.callers;
  if (callers) callers.push(caller.id);
  treasuryAsset.callers = callers;
  treasuryAsset.save();

  // Add TreasuryAsset to RedeemableERC20 entity
  if (redeemabaleERC20) {
    let rERC20treasuryAssets = redeemabaleERC20.treasuryAssets;
    if (rERC20treasuryAssets) rERC20treasuryAssets.push(treasuryAsset.id);
    redeemabaleERC20.treasuryAssets = rERC20treasuryAssets;

    redeemabaleERC20.save();
  }
}

/**
 * @description Function to get the matching Tier from multiple availabe tiers
 * @param tierAddress TierAddress ib hexString
 * @returns string i.e iD of any Tier entity
 */
function getTier(tierAddress: string): string {
  /**
   * Check one by if Tier address to any existing tier entites like
   * ERC20BalanceTier, ERC20TransferTier, ERC721BalanceTier, CombineTier
   * VerifyTier
   */
  let eRC20BalanceTier = ERC20BalanceTier.load(tierAddress);
  if (eRC20BalanceTier != null) return eRC20BalanceTier.id;
  let eRC20TransferTier = ERC20TransferTier.load(tierAddress);
  if (eRC20TransferTier != null) return eRC20TransferTier.id;
  let eRC721BalanceTier = ERC721BalanceTier.load(tierAddress);
  if (eRC721BalanceTier != null) return eRC721BalanceTier.id;
  let combineTier = CombineTier.load(tierAddress);
  if (combineTier != null) return combineTier.id;
  let verifyTier = VerifyTier.load(tierAddress);
  if (verifyTier != null) return verifyTier.id;

  // if does not match to any Tier check in UnknownTiers
  let uknownTier = UnknownTier.load(tierAddress);

  // If not in UnknownTiers create a new UnknownTier
  if (uknownTier == null) {
    uknownTier = new UnknownTier(tierAddress);
    uknownTier.address = Address.fromString(tierAddress);
    uknownTier.deployBlock = ZERO_BI;
    uknownTier.deployTimestamp = ZERO_BI;
    uknownTier.deployer = Address.fromString(ZERO_ADDRESS);
    uknownTier.save();
  }
  return uknownTier.id;
}
