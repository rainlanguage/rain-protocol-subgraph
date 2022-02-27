import { Address, ethereum, BigInt, log } from "@graphprotocol/graph-ts"
import { Deposit, PendingDeposit, Undeposit, Withdraw} from "../../generated/RedeemableERC20ClaimEscrow/RedeemableERC20ClaimEscrow"
import { ERC20, RedeemableERC20, RedeemableERC20ClaimEscrow, RedeemableEscrowDeposit, RedeemableEscrowDepositor, RedeemableEscrowPendingDeposit, RedeemableEscrowPendingDepositorToken, RedeemableEscrowSupplyTokenDeposit, RedeemableEscrowUndeposit, RedeemableEscrowWithdraw, RedeemableEscrowWithdrawer, Sale, Trust, UnknownSale} from "../../generated/schema"
import { ERC20 as ERC20Contract} from "../../generated/RedeemableERC20ClaimEscrow/ERC20"
import { SaleStatus, ZERO_ADDRESS, ZERO_BI } from "../utils"
import { Trust as TrustContract } from "../../generated/RedeemableERC20ClaimEscrow/Trust"

export function handleDeposit(event: Deposit): void {
    let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex()) 
    let redeemableEscrowDeposit = new RedeemableEscrowDeposit(event.transaction.hash.toHex())
    redeemableEscrowDeposit.depositorAddress = event.params.depositor
    redeemableEscrowDeposit.escrow = redeemableERC20ClaimEscrow.id
    redeemableEscrowDeposit.escrowAddress = event.address
    redeemableEscrowDeposit.iSaleAddress = event.params.trust
    redeemableEscrowDeposit.redeemableSupply = event.params.supply
    redeemableEscrowDeposit.tokenAmount = event.params.amount

    let redeemableERC20 = RedeemableERC20.load(event.params.redeemable.toHex())
    if(redeemableERC20 != null)
    redeemableEscrowDeposit.redeemable = redeemableERC20.id

    let token = getERC20(event.params.token, event.block)
    redeemableEscrowDeposit.token = token.id
    redeemableEscrowDeposit.tokenAddress = event.params.token

    let iSale= getIsale(event.params.trust.toHex())
    redeemableEscrowDeposit.iSale = iSale

    let trust = Trust.load(iSale)
    let sale = Sale.load(iSale)
    if(trust != null){
        if(SaleStatus.Success == trust.saleStatus || SaleStatus.Fail == trust.saleStatus){
            // let repdt = getRedeemableEscrowPendingDepositorToken(Address.fromString(iSale), event.address, event.params.depositor, event.params.token)
            // repdt.swept = true
            // repdt.save()
        }
    }
    else if(sale != null){
        if(SaleStatus.Success == trust.saleStatus || SaleStatus.Fail == trust.saleStatus){
            let repdt = getRedeemableEscrowPendingDepositorToken(Address.fromString(iSale), event.address, event.params.depositor, event.params.token)
            repdt.swept = true
            repdt.save()
        }
    }

    let depositor = getRedeemableEscrowDepositor(event.address.toHex(), event.params.depositor)
    let dDeposits = depositor.deposits
    dDeposits.push(redeemableEscrowDeposit.id)
    depositor.deposits = dDeposits
    depositor.save()

    let resdt = getRedeemableEscrowSupplyTokenDeposit(Address.fromString(iSale), event.address, event.params.supply, event.params.token)
    resdt.totalDeposited = resdt.totalDeposited.plus(event.params.amount)
    resdt.depositors = depositor.id
    resdt.depositorAddress = event.params.depositor
    resdt.redeemableSupply = event.params.supply

    let resdtDeposits = resdt.deposits
    resdtDeposits.push(redeemableEscrowDeposit.id)
    resdt.deposits = resdtDeposits
    
    resdt.save()

    let DsupplyTokenDeposits = depositor.supplyTokenDeposits
    if(!(DsupplyTokenDeposits.includes(resdt.id)))
        DsupplyTokenDeposits.push(resdt.id)
    depositor.supplyTokenDeposits = DsupplyTokenDeposits

    
    depositor.save()

    redeemableEscrowDeposit.depositor = depositor.id

    redeemableEscrowDeposit.save()

    let deposits = redeemableERC20ClaimEscrow.deposits
    deposits.push(redeemableEscrowDeposit.id)
    redeemableERC20ClaimEscrow.deposits = deposits

    let depositors = redeemableERC20ClaimEscrow.depositors
    if(!depositors.includes(depositor.id)){
        depositors.push(depositor.id)
    }
    redeemableERC20ClaimEscrow.depositors = depositors

    let supplyTokenDeposits = redeemableERC20ClaimEscrow.supplyTokenDeposits
    if(!(supplyTokenDeposits.includes(resdt.id)))
        supplyTokenDeposits.push(resdt.id)
    redeemableERC20ClaimEscrow.supplyTokenDeposits = supplyTokenDeposits

    redeemableERC20ClaimEscrow.save()
}

export function handlePendingDeposit(event: PendingDeposit): void {
    let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex()) 
    let redeemableEscrowPendingDeposit = new RedeemableEscrowPendingDeposit(event.transaction.hash.toHex())
    redeemableEscrowPendingDeposit.depositorAddress = event.params.sender
    redeemableEscrowPendingDeposit.escrow = redeemableERC20ClaimEscrow.id
    redeemableEscrowPendingDeposit.escrowAddress = event.address
    redeemableEscrowPendingDeposit.iSaleAddress = event.params.trust
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
    depositor.pendingDeposits = DpendingDeposits
    depositor.save()
    
    let repdt = getRedeemableEscrowPendingDepositorToken(Address.fromString(iSale), event.address, event.params.sender, event.params.token)
    repdt.totalDeposited = repdt.totalDeposited.plus(event.params.amount)

    let repdtPendingDeposits = repdt.pendingDeposits
    repdtPendingDeposits.push(redeemableEscrowPendingDeposit.id)
    repdt.pendingDeposits = repdtPendingDeposits
    
    repdt.save()

    let DpendingDepositorTokens = depositor.pendingDepositorTokens
    if(!(DpendingDepositorTokens.includes(repdt.id)))
        DpendingDepositorTokens.push(repdt.id)
    depositor.pendingDepositorTokens = DpendingDepositorTokens

    
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

    let pendingDepositorTokens = redeemableERC20ClaimEscrow.pendingDepositorTokens
    if(!(pendingDepositorTokens.includes(repdt.id)))
        pendingDepositorTokens.push(repdt.id)
    redeemableERC20ClaimEscrow.pendingDepositorTokens = pendingDepositorTokens

    redeemableERC20ClaimEscrow.save()
}


export function handleUndeposit(event: Undeposit): void {
    let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex())

    let redeemableEscrowUndeposit = new RedeemableEscrowUndeposit(event.transaction.hash.toHex())
    redeemableEscrowUndeposit.sender = event.params.sender
    redeemableEscrowUndeposit.escrow = event.address.toHex() 
    redeemableEscrowUndeposit.escrowAddress = event.address
    redeemableEscrowUndeposit.iSaleAddress = event.params.trust

    let iSale = getIsale(event.params.trust.toHex())
    redeemableEscrowUndeposit.iSale = iSale

    let token = getERC20(event.params.token, event.block)
    redeemableEscrowUndeposit.token = token.id
    redeemableEscrowUndeposit.tokenAddress = event.params.token
    redeemableEscrowUndeposit.redeemableSupply = event.params.supply
    redeemableEscrowUndeposit.tokenAmount = event.params.amount

    redeemableEscrowUndeposit.save()

    let undeposits = redeemableERC20ClaimEscrow.undeposits
    undeposits.push(redeemableEscrowUndeposit.id)
    redeemableERC20ClaimEscrow.undeposits = undeposits

    redeemableERC20ClaimEscrow.save()

    let depositor = getRedeemableEscrowDepositor(event.address.toHex(), event.params.sender)
    let dUndeposits = depositor.undeposits
    dUndeposits.push(redeemableEscrowUndeposit.id)
    depositor.undeposits = dUndeposits

    depositor.save()

    let resdt = getRedeemableEscrowSupplyTokenDeposit(Address.fromString(iSale), event.address, event.params.supply, event.params.token)
    resdt.totalDeposited = resdt.totalDeposited.minus(event.params.amount)
    resdt.save()
}

export function handleWithdraw(event: Withdraw): void {
    let redeemableERC20ClaimEscrow = getRedeemableERC20ClaimEscrow(event.address.toHex()) 

    let redeemableEscrowWithdraw = new RedeemableEscrowWithdraw(event.transaction.hash.toHex())
    redeemableEscrowWithdraw.withdrawer = event.params.withdrawer
    redeemableEscrowWithdraw.escrow = event.address.toHex()
    redeemableEscrowWithdraw.escrowAddress = event.address
    redeemableEscrowWithdraw.iSaleAddress = event.params.trust

    let iSale = getIsale(event.params.trust.toHex())
    redeemableEscrowWithdraw.iSale = iSale

    redeemableEscrowWithdraw.redeemable = event.params.redeemable.toHex()
    
    let token = getERC20(event.params.token, event.block)
    redeemableEscrowWithdraw.tokenAddress = event.params.token
    redeemableEscrowWithdraw.token = token.id
    redeemableEscrowWithdraw.redeemableSupply = event.params.supply
    redeemableEscrowWithdraw.tokenAmount = event.params.amount

    redeemableEscrowWithdraw.save()

    let withdraws = redeemableERC20ClaimEscrow.withdraws
    withdraws.push(redeemableEscrowWithdraw.id)
    redeemableERC20ClaimEscrow.withdraws = withdraws
    
    let redeemableEscrowWithdrawer = getRedeemableEscrowWithdrawer(event.address, event.params.withdrawer)

    let rWithdraws = redeemableEscrowWithdrawer.withdraws
    rWithdraws.push(redeemableEscrowWithdraw.id)
    redeemableEscrowWithdrawer.withdraws = rWithdraws

    redeemableEscrowWithdrawer.save()

    let withdrawers = redeemableERC20ClaimEscrow.withdrawers
    if(!withdrawers.includes(redeemableEscrowWithdrawer.id))
        withdrawers.push(redeemableEscrowWithdrawer.id)
    redeemableERC20ClaimEscrow.withdrawers = withdrawers
    
    redeemableERC20ClaimEscrow.save()

    let resdt = getRedeemableEscrowSupplyTokenDeposit(Address.fromString(iSale), event.address, event.params.supply, event.params.token)
    resdt.totalDeposited = resdt.totalDeposited.minus(event.params.amount)
    resdt.save()
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
        redeemableERC20ClaimEscrow.withdrawers = []
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
        redeemableEscrowDepositor.save()
    }
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
        erc20.save()
    }
    return erc20 as ERC20
}

function getIsale(iSale: string): string {
    let trust = Trust.load(iSale)
    let contract = TrustContract.bind(Address.fromString(iSale))
    if(trust != null){
        trust.saleStatus = contract.saleStatus()
        trust.save()
        return trust.id
    }
    let sale = Sale.load(iSale)
    if(sale != null){
        sale.saleStatus = contract.saleStatus()
        sale.save()
        return sale.id
    }
    let unknownSale = UnknownSale.load(iSale)
    if(unknownSale == null){
        unknownSale = new UnknownSale(iSale)
        unknownSale.address = Address.fromString(iSale)
    }
    unknownSale.saleStatus = contract.saleStatus()
    unknownSale.save()
    return unknownSale.id
}


function getRedeemableEscrowPendingDepositorToken(sale: Address, escrow: Address, depositor: Address, token: Address): RedeemableEscrowPendingDepositorToken {
    let REPDT = RedeemableEscrowPendingDepositorToken.load(sale.toHex() + " - " + escrow.toHex() + " - " + depositor.toHex() + " - " + token.toHex())
    if(REPDT == null){
        REPDT = new RedeemableEscrowPendingDepositorToken(sale.toHex() + " - " + escrow.toHex() + " - " + depositor.toHex() + " - " + token.toHex())
        REPDT.iSale = sale.toHex()
        REPDT.iSaleAddress = sale
        REPDT.escrow = escrow.toHex()
        REPDT.escrowAddress = escrow
        REPDT.depositor = escrow.toHex() + " - " + depositor.toHex()
        REPDT.depositorAddress = depositor
        REPDT.pendingDeposits = []
        REPDT.token = token.toHex()
        REPDT.tokenAddress = token
        REPDT.totalDeposited = ZERO_BI
        REPDT.swept = false
    }
    return REPDT as RedeemableEscrowPendingDepositorToken
}

function getRedeemableEscrowSupplyTokenDeposit(sale: Address, escrow: Address, supply: BigInt, token: Address): RedeemableEscrowSupplyTokenDeposit {
    let RESDT = RedeemableEscrowSupplyTokenDeposit.load(sale.toHex() + " - " + escrow.toHex() + " - " + supply.toString() + " - " + token.toHex())
    if(RESDT == null){
        RESDT = new RedeemableEscrowSupplyTokenDeposit(sale.toHex() + " - " + escrow.toHex() + " - " + supply.toString() + " - " + token.toHex())
        RESDT.iSale = sale.toHex()
        RESDT.iSaleAddress = sale
        RESDT.escrow = escrow.toHex()
        RESDT.escrowAddress = escrow
        RESDT.deposits = []
        RESDT.redeemableSupply = supply
        RESDT.token = token.toHex()
        RESDT.tokenAddress = token
        RESDT.totalDeposited = ZERO_BI
    }
    return RESDT as RedeemableEscrowSupplyTokenDeposit
}
    
function getRedeemableEscrowWithdrawer(escrow: Address, account: Address): RedeemableEscrowWithdrawer {
    let redeemableEscrowWithdrawer = RedeemableEscrowWithdrawer.load(escrow.toHex() + " - " + account.toHex())
    if(redeemableEscrowWithdrawer == null){
        redeemableEscrowWithdrawer = new RedeemableEscrowWithdrawer(escrow.toHex() + " - " + account.toHex())
        redeemableEscrowWithdrawer.address = account
        redeemableEscrowWithdrawer.escrow = escrow.toHex()
        redeemableEscrowWithdrawer.escrowAddress = escrow
        redeemableEscrowWithdrawer.withdraws = []
    }
    
    return redeemableEscrowWithdrawer as RedeemableEscrowWithdrawer
}