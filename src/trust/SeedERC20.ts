/* eslint-disable prefer-const */
import { Address, dataSource, BigInt } from "@graphprotocol/graph-ts";
import {
  Seed,
  Unseed,
  SeedERC20,
  Holder,
  DistributionProgress,
  TrustParticipant,
  RedeemSeed,
} from "../../generated/schema";
import {
  CooldownInitialize,
  Initialize,
  Redeem as RedeemEvent,
  Seed as SeedEvent,
  Transfer,
  Unseed as UnseedEvent,
} from "../../generated/templates/SeedERC20Template/SeedERC20";
import {
  getTrustParticipent,
  HUNDRED_BD,
  notAContract,
  ZERO_BI,
} from "../utils";
import { SeedERC20 as SeedERC20Contract } from "../../generated/templates/SeedERC20Template/SeedERC20";
import { Trust } from "../../generated/TrustFactory/Trust";

/**
 * @description Handler for CooldownInitialize event emited from SeedERC20 token contract.
 * @param event CooldownInitialize event
 */
export function handleCooldownInitialize(event: CooldownInitialize): void {
  // Load the seedERC20 entity
  let seedERC20 = SeedERC20.load(event.address.toHex());

  // Update the CooldownDuration
  if (seedERC20) {
    seedERC20.seederCooldownDuration = event.params.cooldownDuration;
    seedERC20.save();
  }
}

/**
 * @description Handler for Seed event emited from SeedERC20 token contract
 * @param event Seed event
 */
export function handleSeed(event: SeedEvent): void {
  // Load the SeedERC20 entity
  let seedERC20 = SeedERC20.load(event.address.toHex());

  // Create DataSourceContext
  let context = dataSource.context();

  // Load the DistributionProgress entity
  let distributionProgess = DistributionProgress.load(
    context.getString("trust")
  );

  // Create new Seed entity with trasaction hash
  let seed = new Seed(event.transaction.hash.toHex());
  seed.deployBlock = event.block.number;
  seed.deployTimestamp = event.block.timestamp;
  if (seedERC20) seed.seedERC20 = seedERC20.id;
  seed.caller = event.params.sender;
  seed.tokensSeeded = event.params.tokensSeeded;
  seed.reserveReceived = event.params.reserveReceived;

  seed.save();

  if (seedERC20 && seedERC20.seederUnitsAvail) {
    // Add the Seed in SeedERC20 entity
    let seeds = seedERC20.seeds;
    if (seeds) seeds.push(seed.id);
    seedERC20.seeds = seeds;

    // Update the seededAmount
    seedERC20.seededAmount = seedERC20.seededAmount.plus(
      event.params.reserveReceived
    );

    // Update the seederUnitsAvail
    seedERC20.seederUnitsAvail = seedERC20.seederUnitsAvail.minus(
      event.params.tokensSeeded
    );

    // Update to percentSeeded id redeemInit is not Zero
    if (distributionProgess && distributionProgess.redeemInit != ZERO_BI)
      seedERC20.percentSeeded = seedERC20.seededAmount
        .toBigDecimal()
        .div(distributionProgess.redeemInit.toBigDecimal())
        .times(HUNDRED_BD);
    seedERC20.save();
  }

  // Load the TrustParticipent entity
  let trustParticipant = getTrustParticipent(
    event.params.sender,
    context.getString("trust")
  );

  // Get seedERC20 balance of TrustParticipent
  let tbalance = SeedERC20Contract.bind(event.address).balanceOf(
    event.params.sender
  );

  // Update TrustParticipents seedFeeClaimable
  if (seedERC20)
    trustParticipant.seedFeeClaimable = tbalance.times(
      seedERC20.seedFeePerUnit
    );

  // Add the seed in TrustParticipents seeds
  if (trustParticipant) {
    let tseeds = trustParticipant.seeds;
    if (tseeds) tseeds.push(seed.id);
    trustParticipant.seeds = tseeds;
    trustParticipant.save();
  }

  // Update the distributionStatus after each seed
  let trust = Trust.bind(Address.fromString(context.getString("trust")));
  if (distributionProgess) {
    distributionProgess.distributionStatus = trust.getDistributionStatus();
    distributionProgess.save();
  }
}

/**
 * @description Handler for Unseed event emited from SeedERC20 token contract
 * @param event Unseed event
 */
export function handleUnseed(event: UnseedEvent): void {
  // Load SeedERC20 entity
  let seedERC20 = SeedERC20.load(event.address.toHex());

  // Get the DatasourseContext
  let context = dataSource.context();

  // Load DistributionProgress entity
  let distributionProgess = DistributionProgress.load(
    context.getString("trust")
  );

  // Create a new Unseed entity
  let unseed = new Unseed(event.transaction.hash.toHex());
  unseed.deployBlock = event.block.number;
  unseed.deployTimestamp = event.block.timestamp;
  if (seedERC20) unseed.seedERC20 = seedERC20.id;
  unseed.caller = event.params.sender;
  unseed.tokensSeeded = event.params.tokensUnseeded;
  unseed.reserveReturned = event.params.reserveReturned;

  unseed.save();

  if (seedERC20) {
    // Add the Unseed entity to SeecERC20 entity
    let unseeds = seedERC20.unseeds;
    if (unseeds) unseeds.push(unseed.id);
    seedERC20.unseeds = unseeds;

    // Update the seededAmount
    seedERC20.seededAmount = seedERC20.seededAmount.minus(
      event.params.reserveReturned
    );

    // Update to percentSeeded id redeemInit is not Zero
    if (distributionProgess && distributionProgess.redeemInit != ZERO_BI)
      seedERC20.percentSeeded = seedERC20.seededAmount
        .toBigDecimal()
        .div(distributionProgess.redeemInit.toBigDecimal())
        .times(HUNDRED_BD);
    seedERC20.save();

    // Update the seederUnitsAvail
    seedERC20.seederUnitsAvail = seedERC20.seederUnitsAvail.plus(
      event.params.tokensUnseeded
    );
    seedERC20.save();

    // Load the TrustParticipent entity
    let trustParticipant = getTrustParticipent(
      event.params.sender,
      context.getString("trust")
    );

    // Get the seedERC20 balance of TrustParticipent
    let tbalance = SeedERC20Contract.bind(event.address).balanceOf(
      event.params.sender
    );

    // Update the seedFeeClaimable of TrustParticipent
    trustParticipant.seedFeeClaimable = tbalance.times(
      seedERC20.seedFeePerUnit
    );

    // Add the UnSeed to TrustParticipent
    let tunseeds = trustParticipant.unSeeds;
    if (tunseeds) tunseeds.push(unseed.id);
    trustParticipant.unSeeds = tunseeds;
    trustParticipant.save();
  }
}

/**
 * @description Handler for Initialize envent emited from SeedERC20 contract
 * @param event Initialize event
 */
export function handleInitialize(event: Initialize): void {
  let seedERC20 = SeedERC20.load(event.address.toHex());
  if (seedERC20) {
    seedERC20.factory = event.params.sender;
    seedERC20.recipient = event.params.recipient;
    seedERC20.reserve = event.params.reserve;
    seedERC20.seedPrice = event.params.seedPrice;
    seedERC20.save();
  }
}

/**
 * @description Handler for Redeem event emited from SeedERC20
 * @param event Redeem event
 */
export function handleRedeem(event: RedeemEvent): void {
  // Get the Datasource
  let context = dataSource.context();

  // Load SeedERC20 entity
  let seedERC20 = SeedERC20.load(event.address.toHex());
  if (seedERC20) {
    let redeemSeeds = seedERC20.redeemSeeds;

    // Create Redeem entity with "transaction.hash - totalSeeds" as iD
    if (redeemSeeds) {
      let redeem = new RedeemSeed(
        event.transaction.hash.toHex() +
          " - " +
          BigInt.fromI32(redeemSeeds.length).toString()
      );
      redeem.caller = event.params.sender;
      redeem.redeemAmount = event.params.redeemAmount;
      redeem.treasuryAssetAmount = event.params.assetAmount;
      redeem.deployBlock = event.block.number;
      redeem.deployTimestamp = event.block.timestamp;
      redeem.seedERC20 = event.address.toHex();

      redeem.save();

      // Add RedeemSeeds to seedERC20
      redeemSeeds.push(redeem.id);
      seedERC20.redeemSeeds = redeemSeeds;

      seedERC20.save();

      // Load the TrustParticipent
      let trustParticipant = getTrustParticipent(
        event.params.sender,
        context.getString("trust")
      );

      // Add the Redeems to TrustParticipent
      let tRedeemSeeds = trustParticipant.redeemSeeds;
      if (tRedeemSeeds) tRedeemSeeds.push(redeem.id);
      trustParticipant.redeemSeeds = tRedeemSeeds;

      trustParticipant.save();
    }
  }
}

/**
 * @deprecated hnadler for Transfer evnt emited from SeedERC20 token contract
 * @param event Transfer event
 */
export function handleTransfer(event: Transfer): void {
  if (event.params.value != ZERO_BI) {
    // Load SeedERC20 entity
    let seedERC20 = SeedERC20.load(event.address.toHex());

    // Bind SeedERC20 token address to SeedERC20 abi
    let seedERC20Contract = SeedERC20Contract.bind(event.address);

    // Get the DatasourcceContext
    let context = dataSource.context();

    if (seedERC20) {
      // Get All the holders
      let holders = seedERC20.holders;

      // Chcek if sender is not any Contract address
      if (notAContract(event.params.from.toHex(), context.getString("trust"))) {
        // Load the Holder entity
        let sender = Holder.load(
          event.address.toHex() + " - " + event.params.from.toHex()
        );

        // Create new Holder entity if not exists
        if (sender == null) {
          sender = new Holder(
            event.address.toHex() + " - " + event.params.from.toHex()
          );
          // set the balance of holder
          sender.balance = seedERC20Contract.balanceOf(event.params.from);
        }

        // Update the balance of holder
        sender.balance = sender.balance.minus(event.params.value);
        sender.save();

        let trustParticipant = TrustParticipant.load(
          event.params.from.toHex() + " - " + context.getString("trust")
        );
        // Check if holder is also TrustPaticipent
        if (trustParticipant != null) {
          // If yes then update its balance
          trustParticipant.seedBalance = seedERC20Contract.balanceOf(
            event.params.from
          );

          // Upadte seedFeeClaimable of TrustParticipent
          trustParticipant.seedFeeClaimable =
            trustParticipant.seedBalance.times(seedERC20.seedFeePerUnit);
          trustParticipant.save();
        }
      }

      // Chcek if receiver is not any Contract address
      if (notAContract(event.params.to.toHex(), context.getString("trust"))) {
        // Load the Holder entity
        let receiver = Holder.load(
          event.address.toHex() + " - " + event.params.to.toHex()
        );

        // Create new Holder entity if not exists
        if (receiver == null) {
          receiver = new Holder(
            event.address.toHex() + " - " + event.params.to.toHex()
          );

          // set the balance of holder
          receiver.balance = ZERO_BI;
        }
        // Update the balance of holder
        receiver.balance = receiver.balance.plus(event.params.value);
        receiver.address = event.params.to;
        receiver.save();

        if (holders && !holders.includes(receiver.id)) {
          holders.push(receiver.id);
          seedERC20.holders = holders;
          seedERC20.save();
        }

        let trustParticipant = TrustParticipant.load(
          event.params.to.toHex() + " - " + context.getString("trust")
        );
        // Check if holder is also TrustPaticipent
        if (trustParticipant != null) {
          // If yes then update its balance
          trustParticipant.seedBalance = seedERC20Contract.balanceOf(
            event.params.from
          );

          // Upadte seedFeeClaimable of TrustParticipent
          trustParticipant.seedFeeClaimable =
            trustParticipant.seedBalance.times(seedERC20.seedFeePerUnit);
          trustParticipant.save();
        }
      }
    }
  }
}
