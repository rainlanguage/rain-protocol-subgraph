import { Address, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Deposit, PendingDeposit, RedeemableERC20ClaimEscrow as RedeemableERC20ClaimEscrowEvent, Undeposit, Withdraw} from "../../generated/RedeemableERC20ClaimEscrow/RedeemableERC20ClaimEscrow"
import { ERC20, RedeemableERC20, RedeemableERC20ClaimEscrow, RedeemableEscrowDeposit, RedeemableEscrowDepositor, RedeemableEscrowPendingDeposit, Sale, Trust} from "../../generated/schema"
import { ERC20 as ERC20Contract} from "../../generated/RedeemableERC20ClaimEscrow/ERC20"

export function handleDeposit(event: Deposit): void {
    let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex()) 

    let redeemableEscrowDeposit = new RedeemableEscrowDeposit(event.transaction.hash.toHex())
    redeemableEscrowDeposit.depositorAddress = event.params.depositor
    redeemableEscrowDeposit.escrow = redeemableERC20ClaimEscrow.id
    redeemableEscrowDeposit.escrowAddress = event.address
    redeemableEscrowDeposit.saleAddress = event.params.trust
    redeemableEscrowDeposit.redeemableSupply = event.params.supply
    redeemableEscrowDeposit.tokenAmount = event.params.amount
    
    let redeemableERC20 = RedeemableERC20.load(event.params.redeemable.toHex())
    redeemableEscrowDeposit.redeemable = redeemableERC20.id

    let token = getERC20(event.params.token, event.block)
    redeemableEscrowDeposit.token = token.id
    redeemableEscrowDeposit.tokenAddress = event.params.token

    let iSale = getIsale(event.params.trust.toHex())
    redeemableEscrowDeposit.iSale = iSale


    let depositor = getRedeemableEscrowDepositor(event.address.toHex(), event.params.depositor)
    let dDeposits = depositor.deposits
    dDeposits.push(redeemableEscrowDeposit.id)
    depositor.deposits = dDeposits
    depositor.save()

    redeemableEscrowDeposit.depositor = depositor.id

    redeemableEscrowDeposit.save()

    let rDeposits = redeemableERC20ClaimEscrow.deposits
    rDeposits.push(redeemableEscrowDeposit.id)
    redeemableERC20ClaimEscrow.deposits = rDeposits

    let depositors = redeemableERC20ClaimEscrow.depositors
    if(!depositors.includes(depositor.id)){
        depositors.push(depositor.id)
    }
    redeemableERC20ClaimEscrow.depositors = depositors

    redeemableERC20ClaimEscrow.save()

    redeemableEscrowDeposit.save()

    let deposits = redeemableERC20ClaimEscrow.deposits
    deposits.push(redeemableEscrowDeposit.id)
    redeemableERC20ClaimEscrow.deposits = deposits

    redeemableERC20ClaimEscrow.save()
}

export function handlePendingDeposit(event: PendingDeposit): void {
    let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex()) 
    let redeemableEscrowPendingDeposit = new RedeemableEscrowPendingDeposit(event.transaction.hash.toHex())
    redeemableEscrowPendingDeposit.depositorAddress = event.params.sender
    redeemableEscrowPendingDeposit.escrow = redeemableERC20ClaimEscrow.id
    redeemableEscrowPendingDeposit.escrowAddress = event.address
    redeemableEscrowPendingDeposit.saleAddress = event.params.trust
    redeemableEscrowPendingDeposit.amount = event.params.amount

    let redeemableERC20 = RedeemableERC20.load(event.params.redeemable.toHex())
    if(redeemableERC20 != null)
        redeemableEscrowPendingDeposit.redeemable = redeemableERC20.id

    let token = getERC20(event.params.token, event.block)
    redeemableEscrowPendingDeposit.token = token.id
    redeemableEscrowPendingDeposit.tokenAddress = event.params.token

    let iSale = getIsale(event.params.trust.toHex())
    redeemableEscrowPendingDeposit.iSale = iSale

    let depositor = getRedeemableEscrowDepositor(event.address.toHex(), event.params.sender)
    let DpendingDeposits = depositor.pendingDeposits
    DpendingDeposits.push(redeemableEscrowPendingDeposit.id)
    depositor.deposits = DpendingDeposits
    depositor.save()

    redeemableEscrowPendingDeposit.depositor = depositor.id

    redeemableEscrowPendingDeposit.save()

    let pendingDeposits = redeemableERC20ClaimEscrow.pendingDeposits
    pendingDeposits.push(redeemableEscrowPendingDeposit.id)
    redeemableERC20ClaimEscrow.pendingDeposits = pendingDeposits

    let depositors = redeemableERC20ClaimEscrow.depositors
    if(!depositors.includes(depositor.id)){
        depositors.push(depositor.id)
    }
    redeemableERC20ClaimEscrow.depositors = depositors

    redeemableERC20ClaimEscrow.save()
}


export function handleUndeposit(event: Undeposit): void {
    // let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex()) 
}

export function handleWithdraw(event: Withdraw): void {
    // let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex()) 
}

function getRedeemableERC20ClaimEscrow(address: string): RedeemableERC20ClaimEscrow {
    let redeemableERC20ClaimEscrow = RedeemableERC20ClaimEscrow.load(address)
    if(redeemableERC20ClaimEscrow == null){
        redeemableERC20ClaimEscrow = new RedeemableERC20ClaimEscrow(address)
        redeemableERC20ClaimEscrow.address = Address.fromString(address)
        redeemableERC20ClaimEscrow.pendingDeposits = []
        redeemableERC20ClaimEscrow.deposits = []
        redeemableERC20ClaimEscrow.undeposits = []
        redeemableERC20ClaimEscrow.withdraws = []
        redeemableERC20ClaimEscrow.pendingDepositorTokens = []
        redeemableERC20ClaimEscrow.supplyTokenDeposits = []
        redeemableERC20ClaimEscrow.depositors = []
        redeemableERC20ClaimEscrow.withdraws = []
        redeemableERC20ClaimEscrow.save()
    }
    return redeemableERC20ClaimEscrow as RedeemableERC20ClaimEscrow
}


function getRedeemableEscrowDepositor(escrow: string, address: Address): RedeemableEscrowDepositor{
    let redeemableEscrowDepositor = RedeemableEscrowDepositor.load(escrow + " - " + address.toHex())
    if(redeemableEscrowDepositor == null){
        redeemableEscrowDepositor = new RedeemableEscrowDepositor(escrow + " - " + address.toHex())
        redeemableEscrowDepositor.address = address
        redeemableEscrowDepositor.pendingDepositorTokens = []
        redeemableEscrowDepositor.supplyTokenDeposits = []
        redeemableEscrowDepositor.pendingDeposits = []
        redeemableEscrowDepositor.deposits = []
        redeemableEscrowDepositor.undeposits  = []
    }
    redeemableEscrowDepositor.save()
    return redeemableEscrowDepositor as RedeemableEscrowDepositor
}

function getERC20(token: Address, block: ethereum.Block): ERC20 {
    let erc20 = ERC20.load(token.toHex())
    let erc20Contract = ERC20Contract.bind(token)
    if(erc20 == null){
        erc20 = new ERC20(token.toHex())
        erc20.deployBlock = block.number
        erc20.deployTimestamp = block.timestamp

        let name = erc20Contract.try_name()
        let symbol = erc20Contract.try_symbol()
        let decimals = erc20Contract.try_decimals()
        let totalSupply = erc20Contract.try_totalSupply()
        if(!(name.reverted || symbol.reverted || decimals.reverted || totalSupply.reverted)){
            erc20.name = name.value
            erc20.symbol = symbol.value
            erc20.decimals = decimals.value
            erc20.totalSupply = totalSupply.value
        }
    }
    return erc20 as ERC20
}

function getIsale(iSale: string): string {
    let trust = Trust.load(iSale)
    if(trust != null)
        return trust.id
    let sale = Sale.load(iSale)
    if(sale != null)
        return sale.id
    return ""
}