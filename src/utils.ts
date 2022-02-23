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

export enum Role {
    NONE,
    APPROVER,
    REMOVER,
    BANNER
}

export enum DistributionStatus {
    Pending,
    Seeded,
    Trading,
    TradingCanEnd,
    Success,
    Fail,
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
    let seedBalance = seedERC20Contract.try_balanceOf(participant)
    let tokenBalance = redeemableERC20Contract.try_balanceOf(participant)

    if(!seedBalance.reverted)
        trustParticipant.seedBalance = seedBalance.value
    if(!tokenBalance.reverted)
        trustParticipant.tokenBalance = tokenBalance.value
    return trustParticipant as TrustParticipant
}


export function notAContract(address: string, trust: string): boolean {
    let contracts = Contract.load(trust)
    if(address == ZERO_ADDRESS)
        return false
    if(contracts.seeder == address)
        return false
    if(contracts.redeemableERC20 == address)
        return false
    if(contracts.reserveERC20 == address)
        return false
    if(contracts.crp == address)
        return false
    if(contracts.pool == address)
        return false
    if(contracts.tier == address)
        return false
    return true
}