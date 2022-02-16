import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { Contract, Trust, TrustParticipant } from '../generated/schema'
import { SeedERC20 } from "../generated/TrustFactory/SeedERC20"
import { RedeemableERC20 } from "../generated/TrustFactory/RedeemableERC20"

let ZERO_BI = BigInt.fromI32(0)
let ONE_BI = BigInt.fromI32(1)
let ZERO_BD = BigDecimal.fromString("0.0")
let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
let HUNDRED_BD = BigDecimal.fromString("100.0")
let ETHER = BigInt.fromString("1000000000000000000")

let BONE = BigInt.fromString("1000000000000000000")
let MIN_WEIGHT = BONE
let MAX_WEIGHT = BONE.times(BigInt.fromI32(50))

export enum SaleStatus {
    Pending,
    Active,
    Success,
    Fail
}

export enum RequestStatus {
    NONE,
    REQUEST_APPROVE,
    REQUEST_BAN,
    REQUEST_REMOVE
}

export enum Status {
    NONE,
    APPROVED,
    BANNED,
    REMOVED
}

export enum Transferrable {
    NonTransferrable,
    Transferrable,
    TierGatedTransferrable
}



export {
    ZERO_BI,
    ONE_BI,
    ZERO_BD,
    HUNDRED_BD,
    ZERO_ADDRESS,
    ETHER,
    BONE,
    MAX_WEIGHT,
    MIN_WEIGHT
}

export function getTrustParticipent(participant: Address, trust: string) : TrustParticipant {
    let trustParticipant = TrustParticipant.load(participant.toHex() + " - "+ trust)
    let contracts = Contract.load(trust)
    let seedERC20Contract = SeedERC20.bind(Address.fromString(contracts.seeder))
    let redeemableERC20Contract = RedeemableERC20.bind(Address.fromString(contracts.redeemableERC20))
    if(trustParticipant == null){
        trustParticipant = new TrustParticipant(participant.toHex() + " - "+ trust)
        trustParticipant.address = participant
        trustParticipant.trust = trust
        trustParticipant.seeds = []
        trustParticipant.unSeeds = []
        trustParticipant.redeems = []
        trustParticipant.redeemSeeds = []
        trustParticipant.swaps = []

        let trustEntity = Trust.load(trust)
        let tp = trustEntity.trustParticipants
        tp.push(trustParticipant.id)
        trustEntity.trustParticipants = tp
        trustEntity.save()
    }
    trustParticipant.seedBalance = seedERC20Contract.balanceOf(participant)
    trustParticipant.tokenBalance = redeemableERC20Contract.balanceOf(participant)
    return trustParticipant as TrustParticipant
}
