/* eslint-disable prefer-const */
import {
  Address,
  BigDecimal,
  BigInt,
  ByteArray,
  crypto,
} from "@graphprotocol/graph-ts";
import { Contract, Pool, Trust, TrustParticipant } from "../generated/schema";
import { SeedERC20 } from "../generated/TrustFactory/SeedERC20";
import { RedeemableERC20 } from "../generated/TrustFactory/RedeemableERC20";

let ZERO_BI = BigInt.fromI32(0);
let ONE_BI = BigInt.fromI32(1);
let ZERO_BD = BigDecimal.fromString("0.0");
let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
let HUNDRED_BD = BigDecimal.fromString("100.0");
let ETHER = BigInt.fromString("1000000000000000000");

let BONE = BigInt.fromString("1000000000000000000");

// enum for SaleStatus on Trust and Sale
export enum SaleStatus {
  Pending,
  Active,
  Success,
  Fail,
}

// enum for RequestStatus on VerifyAddresses
export enum RequestStatus {
  NONE,
  APPROVE,
  BAN,
  REMOVE,
}

// enum for Status on VerifyAddresses
export enum Status {
  NIL,
  ADDED,
  APPROVED,
  BANNED,
}

export enum Transferrable {
  NonTransferrable,
  Transferrable,
  TierGatedTransferrable,
}

export enum Role {
  NONE,
  APPROVER_ADMIN,
  REMOVER_ADMIN,
  BANNER_ADMIN,
  APPROVER,
  REMOVER,
  BANNER,
}

// enum for DistributionStatus on Trust
export enum DistributionStatus {
  Pending,
  Seeded,
  Trading,
  TradingCanEnd,
  Success,
  Fail,
}

/// Role for `APPROVER_ADMIN`.
let APPROVER_ADMIN =
  "0x2d4d1d70bd81797c3479f5c3f873a5c9203d249659c3b317cdad46367472783c";
/// Role for `APPROVER`.
let APPROVER =
  "0x5ff1fb0ce9089603e6e193667ed17164e0360a6148f4a39fc194055588948a31";

/// Admin role for `REMOVER`.
let REMOVER_ADMIN =
  "0x9d65f741849e7609dd1e2c70f0d7da5f5433b36bfcf3ba4d27d2bb08ad2155b1";
/// Role for `REMOVER`.
let REMOVER =
  "0x794e4221ebb6dd4e460d558b4ec709511d44017d6610ba89daa896c0684ddfac";

/// Admin role for `BANNER`.
let BANNER_ADMIN =
  "0xbb496ca6fee71a17f78592fbc6fc7f04a436edb9c709c4289d6bbfbc5fd45f4d";
/// Role for `BANNER`.
let BANNER =
  "0x5a686c9d070917be517818979fb56f451f007e3ae83e96fb5a22a304929b070d";

export {
  ZERO_BI,
  ONE_BI,
  ZERO_BD,
  HUNDRED_BD,
  ZERO_ADDRESS,
  ETHER,
  BONE,
  APPROVER_ADMIN,
  APPROVER,
  REMOVER_ADMIN,
  REMOVER,
  BANNER_ADMIN,
  BANNER,
};

/**
 * @description A function to create a trustParticipant if not exists.
 * @param participant Address of user.
 * @param trust Address of Trust.
 * @returns TrustParticipant Enitity.
 */
export function getTrustParticipent(
  participant: Address,
  trust: string
): TrustParticipant {
  // load trustParticipant using "participant - trust"
  let trustParticipant = TrustParticipant.load(
    participant.toHex() + " - " + trust
  );

  // load contracts of trust Address
  let contracts = Contract.load(trust);

  // create seedERC20Contract using seeder from contracts
  if (contracts) {
    let seedERC20Contract = SeedERC20.bind(
      Address.fromString(contracts.seeder)
    );

    // create seedERC20Contract using redeemableERC20 from contracts
    let redeemableERC20Contract = RedeemableERC20.bind(
      Address.fromString(contracts.redeemableERC20)
    );

    /**
     *   check if trustParticipant exists
     *   If not create a bew one with default value.
     */
    if (!trustParticipant) {
      trustParticipant = new TrustParticipant(
        participant.toHex() + " - " + trust
      );
      trustParticipant.address = participant;
      trustParticipant.trust = trust;
      trustParticipant.seedBalance = ZERO_BI;
      trustParticipant.seeds = [];
      trustParticipant.unSeeds = [];
      trustParticipant.redeems = [];
      trustParticipant.redeemSeeds = [];
      trustParticipant.swaps = [];

      let trustEntity = Trust.load(trust);
      if (trustEntity) {
        let tp = trustEntity.trustParticipants;
        if (tp) tp.push(trustParticipant.id); // add the trustParticipant in Trust
        trustEntity.trustParticipants = tp;
        trustEntity.save();
      }
    }

    // Update the seedBalance and tokenBalance everytime when getting trustParticipant
    let seedBalance = seedERC20Contract.try_balanceOf(participant);
    let tokenBalance = redeemableERC20Contract.try_balanceOf(participant);

    if (!seedBalance.reverted) trustParticipant.seedBalance = seedBalance.value;
    if (!tokenBalance.reverted)
      trustParticipant.tokenBalance = tokenBalance.value;
  }

  return trustParticipant as TrustParticipant;
}

/**
* @description A function to chechk if a given address is not a ZERO_ADDRESSE
                or contract address for the given Trust.
* @param address Address of user.
* @param trust Address of Trust.
* @returns True if not any contract address or ZERO_ADDRESSE else False.
*/
export function notAContract(address: string, trust: string): boolean {
  let contracts = Contract.load(trust);
  if (address == ZERO_ADDRESS) return false;
  if (trust == address) return false;
  if (contracts) {
    if (contracts.seeder == address) return false;
    if (contracts.redeemableERC20 == address) return false;
    if (contracts.reserveERC20 == address) return false;
    if (contracts.configurableRightPool == address) return false;
    if (contracts.pool == address) return false;
    if (contracts.tier == address) return false;
  }
  return true;
}

export function getEmptyPool(): string {
  let pool = new Pool("EMPTY_POOL");
  pool.deployBlock = ZERO_BI;
  pool.deployTimestamp = ZERO_BI;
  pool.numberOfSwaps = ZERO_BI;

  let trust = new Trust("EMPTY_TRUST");
  trust.deployBlock = ZERO_BI;
  trust.deployTimestamp = ZERO_BI;
  trust.creator = Address.fromString(ZERO_ADDRESS);
  trust.factory = Address.fromString(ZERO_ADDRESS);
  trust.save();

  pool.trust = trust.id;
  pool.save();
  return pool.id;
}
