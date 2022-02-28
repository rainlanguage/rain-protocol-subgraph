import { Address, dataSource, DataSourceContext, ethereum, log } from "@graphprotocol/graph-ts"
import { Buy, Construct, CooldownInitialize, CooldownTriggered, End, Initialize, Refund, Start} from "../../generated/SaleFactory/Sale"
import { Sale, SaleFactory, ERC20, SaleStart, CanStartStateConfig, CanEndStateConfig, CalculatePriceStateConfig, SaleEnd, SaleBuy, SaleFeeRecipient, SaleReceipt, SaleRefund, RedeemableERC20, Contract } from "../../generated/schema"
import { RedeemableERC20Template } from "../../generated/templates"
import { ERC20 as ERC20Contract} from "../../generated/templates/SaleTemplate/ERC20"
import { ETHER, HUNDRED_BD, SaleStatus, ZERO_ADDRESS, ZERO_BI } from "../utils"

export function handleBuy(event: Buy): void {
    let sale = Sale.load(event.address.toHex())
    let saleBuy = new SaleBuy(event.transaction.hash.toHex())

    saleBuy.block = event.block.number
    saleBuy.refunded = false
    saleBuy.transactionHash = event.transaction.hash
    saleBuy.timestamp = event.block.timestamp
    saleBuy.saleContract = sale.id
    saleBuy.saleContractAddress = event.address
    saleBuy.feeRecipientAddress = event.params.receipt.feeRecipient
    saleBuy.minimumUnits = event.params.config.minimumUnits
    saleBuy.desiredUnits = event.params.config.desiredUnits
    saleBuy.maximumPrice = event.params.config.maximumPrice
    saleBuy.fee = event.params.receipt.fee
    saleBuy.sender = event.params.sender

    let receipt = new SaleReceipt(sale.id + " - " + event.params.receipt.id.toString())
    receipt.receiptId = event.params.receipt.id
    receipt.saleTransaction = event.transaction.hash.toHex()
    receipt.feeRecipient = event.params.receipt.feeRecipient
    receipt.fee = event.params.receipt.fee
    receipt.units = event.params.receipt.units
    receipt.price = event.params.receipt.price
    receipt.save()

    saleBuy.receipt = receipt.id
    saleBuy.totalIn = receipt.units.times(receipt.price).div(ETHER)
    
    let saleFeeRecipient = SaleFeeRecipient.load(sale.id + " - " + event.params.receipt.feeRecipient.toHex())

    if(saleFeeRecipient == null){
        saleFeeRecipient = new SaleFeeRecipient(sale.id + " - " + event.params.receipt.feeRecipient.toHex())
        saleFeeRecipient.address = event.params.receipt.feeRecipient
        saleFeeRecipient.totalFees = ZERO_BI
        saleFeeRecipient.buys = []
        saleFeeRecipient.refunds = []
        saleFeeRecipient.save()
    }

    saleBuy.feeRecipient = saleFeeRecipient.id
    saleBuy.save()

    let buys = saleFeeRecipient.buys
    buys.push(saleBuy.id)
    saleFeeRecipient.buys = buys
    saleFeeRecipient.save()

    let sbuys = sale.buys
    sbuys.push(saleBuy.id)
    sale.buys = sbuys

    let saleTransactions = sale.saleTransactions
    saleTransactions.push(saleBuy.id)
    sale.saleTransactions = saleTransactions

    sale.save()

    updateSale(sale as Sale)
    updateFeeRecipient(saleFeeRecipient as SaleFeeRecipient)
}
export function handleConstruct(event: Construct): void {
    let context = dataSource.context()
    let saleFactory = SaleFactory.load(context.getString("factory"))
    saleFactory.redeemableERC20Factory = event.params.config.redeemableERC20Factory
    saleFactory.save()
}

export function handleCooldownInitialize(event: CooldownInitialize): void {
    let sale = Sale.load(event.address.toHex())
    sale.cooldownDuration = event.params.cooldownDuration
    sale.save()
}

export function handleCooldownTriggered(event: CooldownTriggered): void {

}

export function handleEnd(event: End): void {
    let sale = Sale.load(event.address.toHex())

    let endEvent = new SaleEnd(event.transaction.hash.toHex())
    endEvent.block = event.block.number
    endEvent.timestamp = event.block.timestamp
    endEvent.transactionHash = event.transaction.hash
    endEvent.saleContract = sale.id
    endEvent.sender = event.params.sender
    endEvent.saleStatus = event.params.saleStatus
    endEvent.save()

    sale.endEvent = endEvent.id
    sale.saleStatus = event.params.saleStatus
    sale.save()

}

export function handleInitialize(event: Initialize): void {
    let sale = Sale.load(event.address.toHex())
    
    let token = getRedeemableERC20(event.params.token, event.block)
    sale.token = token.id
    let reserve = getERC20(event.params.config.reserve, event.block)
    sale.reserve = reserve.id

    let tokenContrct = ERC20Contract.bind(event.params.token)
    
    sale.recipient = event.params.config.recipient
    sale.cooldownDuration = event.params.config.cooldownDuration
    sale.minimumRaise = event.params.config.minimumRaise
    sale.dustSize = event.params.config.dustSize
    sale.saleStatus = SaleStatus.Pending
    sale.unitsAvailable = tokenContrct.balanceOf(event.address)

    let canStartStateConfig = new CanStartStateConfig(event.transaction.hash.toHex())
    canStartStateConfig.sources = event.params.config.canStartStateConfig.sources
    canStartStateConfig.stackLength = event.params.config.canStartStateConfig.stackLength
    canStartStateConfig.argumentsLength = event.params.config.canStartStateConfig.argumentsLength
    canStartStateConfig.constants = event.params.config.canStartStateConfig.constants
    canStartStateConfig.save()

    sale.canStartStateConfig = canStartStateConfig.id

    let canEndStateConfig = new CanEndStateConfig(event.transaction.hash.toHex())
    canEndStateConfig.sources = event.params.config.canEndStateConfig.sources
    canEndStateConfig.stackLength = event.params.config.canEndStateConfig.stackLength
    canEndStateConfig.argumentsLength = event.params.config.canEndStateConfig.argumentsLength
    canEndStateConfig.constants = event.params.config.canEndStateConfig.constants
    canEndStateConfig.save()

    sale.canEndStateConfig = canEndStateConfig.id

    let calculatePriceStateConfig = new CalculatePriceStateConfig(event.transaction.hash.toHex())
    calculatePriceStateConfig.sources = event.params.config.calculatePriceStateConfig.sources
    calculatePriceStateConfig.stackLength = event.params.config.calculatePriceStateConfig.stackLength
    calculatePriceStateConfig.argumentsLength = event.params.config.calculatePriceStateConfig.argumentsLength
    calculatePriceStateConfig.constants = event.params.config.calculatePriceStateConfig.constants
    calculatePriceStateConfig.save()

    sale.calculatePriceStateConfig = calculatePriceStateConfig.id

    token.save()
    reserve.save()
    sale.save()
}

export function handleRefund(event: Refund): void {
    let sale = Sale.load(event.address.toHex())

    let saleRefund = new SaleRefund(event.transaction.hash.toHex())
    saleRefund.block = event.block.number
    saleRefund.transactionHash = event.transaction.hash
    saleRefund.timestamp = event.block.timestamp
    saleRefund.saleContract = sale.id
    saleRefund.saleContractAddress = event.address
    saleRefund.fee = event.params.receipt.fee
    saleRefund.feeRecipientAddress = event.params.receipt.feeRecipient
    saleRefund.sender = event.params.sender

    let receipt = SaleReceipt.load(sale.id + " - " + event.params.receipt.id.toString())
    saleRefund.receipt = receipt.id
    saleRefund.totalOut = receipt.units.times(receipt.price).div(ETHER)
    
    let feeRecipient = SaleFeeRecipient.load(sale.id + " - " + saleRefund.feeRecipientAddress.toHex())
    saleRefund.feeRecipient = feeRecipient.id

    saleRefund.save()

    let saleFeeRecipient = SaleFeeRecipient.load(saleRefund.feeRecipient)
    let refunds = saleFeeRecipient.refunds
    refunds.push(saleRefund.id)
    saleFeeRecipient.refunds = refunds
    saleFeeRecipient.save()

    let srefunds = sale.refunds
    srefunds.push(saleRefund.id)
    sale.refunds = srefunds
    
    let saleBuy = SaleBuy.load(receipt.saleTransaction)
    saleBuy.refunded = true
    saleBuy.refundEvent = saleRefund.id
    saleBuy.save()

    let saleTransactions = sale.saleTransactions
    saleTransactions.push(saleRefund.id)
    sale.saleTransactions = saleTransactions
    
    sale.save()

    updateSale(sale as Sale)
    updateFeeRecipient(saleFeeRecipient as SaleFeeRecipient)
}

export function handleStart(event: Start): void {
    let sale = Sale.load(event.address.toHex())
    sale.saleStatus = SaleStatus.Active
    let salestart = new SaleStart(event.transaction.hash.toHex())
    salestart.transactionHash = event.transaction.hash
    salestart.block = event.block.number
    salestart.timestamp = event.block.timestamp
    salestart.saleContract = sale.id
    salestart.sender = event.params.sender
    salestart.save()

    sale.startEvent = salestart.id

    sale.save()
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

function getRedeemableERC20(token: Address, block: ethereum.Block): RedeemableERC20 {
    let redeemableERC20 = RedeemableERC20.load(token.toHex())
    let erc20Contract = ERC20Contract.bind(token)
    if(redeemableERC20 == null){
        redeemableERC20 = new RedeemableERC20(token.toHex())
        redeemableERC20.deployBlock = block.number
        redeemableERC20.deployTimestamp = block.timestamp

        let name = erc20Contract.try_name()
        let symbol = erc20Contract.try_symbol()
        let decimals = erc20Contract.try_decimals()
        let totalSupply = erc20Contract.try_totalSupply()
        if(!(name.reverted || symbol.reverted || decimals.reverted || totalSupply.reverted)){
            redeemableERC20.name = name.value
            redeemableERC20.symbol = symbol.value
            redeemableERC20.decimals = decimals.value
            redeemableERC20.totalSupply = totalSupply.value
        }
        redeemableERC20.redeems = []
        redeemableERC20.treasuryAssets = []
        redeemableERC20.holders = []
        redeemableERC20.grantedReceivers = []
        redeemableERC20.grantedSenders = []

        redeemableERC20.save()

        let contracts = Contract.load(ZERO_ADDRESS)
        if(contracts == null){
            contracts = new Contract(ZERO_ADDRESS)
            contracts.save()
        }

        let context = new DataSourceContext()
        context.setString("trust", ZERO_ADDRESS)
        RedeemableERC20Template.createWithContext(token, context)
    }
    
    return redeemableERC20 as RedeemableERC20
}

function updateFeeRecipient(recipient: SaleFeeRecipient): void {
    let buys = recipient.buys
    let buyAmount = ZERO_BI
    let buyLength = buys.length

    for(let i=0;i<buyLength;i++){
        let saleBuy = SaleBuy.load(buys.pop())
        buyAmount = buyAmount.plus(saleBuy.fee)
    }

    let refunds = recipient.refunds
    let refundAmount = ZERO_BI
    let refundLength = refunds.length


    for(let i=0;i<refundLength;i++){
        let saleRefund = SaleRefund.load(refunds.pop())
        refundAmount = refundAmount.plus(saleRefund.fee)
    }

    recipient.totalFees = buyAmount.minus(refundAmount)
    recipient.save()
}

function updateSale(sale: Sale): void {
    let erc20 = ERC20Contract.bind(Address.fromString(sale.token))
    sale.unitsAvailable = erc20.balanceOf(Address.fromString(sale.id))

    let saleBuys = sale.buys
    let totalIn = ZERO_BI
    let buyLength = saleBuys.length
    let buyFee = ZERO_BI

    for(let i=0;i<buyLength;i++){
        let saleBuy = SaleBuy.load(saleBuys.pop())
        totalIn = totalIn.plus(saleBuy.totalIn)
        buyFee = buyFee.plus(saleBuy.fee)
    }

    let saleRefunds = sale.refunds
    let totalOut = ZERO_BI
    let refundLength = saleRefunds.length
    let refundFee = ZERO_BI

    for(let i=0;i<refundLength;i++){
        let saleRefund = SaleRefund.load(saleRefunds.pop())
        totalOut = totalOut.plus(saleRefund.totalOut)
        refundFee = refundFee.plus(saleRefund.fee)
    }
    if(sale.saleStatus >= SaleStatus.Active)
        sale.totalRaised = totalIn.minus(totalOut)
    sale.totalFees = buyFee.minus(refundFee)

    if(sale.minimumRaise == ZERO_BI)
        sale.percentRaised = HUNDRED_BD
    else
        sale.percentRaised = sale.totalRaised.toBigDecimal().div(sale.minimumRaise.toBigDecimal()).times(HUNDRED_BD)
    sale.save()
}