import { Address } from "@graphprotocol/graph-ts"
import { Deposit, PendingDeposit, RedeemableERC20ClaimEscrow as RedeemableERC20ClaimEscrowEvent, Undeposit, Withdraw} from "../../generated/RedeemableERC20ClaimEscrow/RedeemableERC20ClaimEscrow"
import { ERC20, RedeemableERC20, RedeemableERC20ClaimEscrow, RedeemableEscrowDeposit} from "../../generated/schema"

export function handleDeposit(event: Deposit): void {
    let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex()) 

    let redeemableEscrowDeposit = new RedeemableEscrowDeposit(event.transaction.hash.toHex())
    redeemableEscrowDeposit.depositorAddress = event.params.depositor
    redeemableEscrowDeposit.escrow = redeemableERC20ClaimEscrow.id
    redeemableEscrowDeposit.escrowAddress = event.address
    redeemableEscrowDeposit.saleAddress = event.params.trust
    
    let redeemableERC20 = RedeemableERC20.load(event.params.redeemable.toHex())
    redeemableEscrowDeposit.redeemable = redeemableERC20.id

    let token = ERC20.load(event.params.token.toHex())
    redeemableEscrowDeposit.token = token.id
    redeemableEscrowDeposit.tokenAddress = event.params.token

    redeemableEscrowDeposit.tokenAmount = event.params.amount
    redeemableEscrowDeposit.save()

    let deposits = redeemableERC20ClaimEscrow.deposits
    deposits.push(redeemableEscrowDeposit.id)
    redeemableERC20ClaimEscrow.deposits = deposits

    redeemableERC20ClaimEscrow.save()
}

export function handlePendingDeposit(event: PendingDeposit): void {
    let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex()) 
}

export function handleUndeposit(event: Undeposit): void {
    let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex()) 
}

export function handleWithdraw(event: Withdraw): void {
    let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex()) 
}

function getRedeemableERC20ClaimEscrow(address: string): RedeemableERC20ClaimEscrow {
    let redeemableERC20ClaimEscrow = RedeemableERC20ClaimEscrow.load(address)
    if(redeemableERC20ClaimEscrow == null)
        redeemableERC20ClaimEscrow = new RedeemableERC20ClaimEscrow(address)
    else
        return redeemableERC20ClaimEscrow as RedeemableERC20ClaimEscrow
    
    redeemableERC20ClaimEscrow.address = Address.fromString(address)
    redeemableERC20ClaimEscrow.pendingDeposits = []
    redeemableERC20ClaimEscrow.deposits = []
    redeemableERC20ClaimEscrow.undeposits = []
    redeemableERC20ClaimEscrow.withdraws = []
    redeemableERC20ClaimEscrow.pendingDepositorTokens = []
    redeemableERC20ClaimEscrow.supplyTokenDeposits = []
    redeemableERC20ClaimEscrow.depositors = []
    redeemableERC20ClaimEscrow.withdraws = []
    return redeemableERC20ClaimEscrow as RedeemableERC20ClaimEscrow
}