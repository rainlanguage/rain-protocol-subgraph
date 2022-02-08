import { Address, dataSource, ethereum, log } from "@graphprotocol/graph-ts"
import { Buy, Construct, CooldownInitialize, CooldownTriggered, End, Initialize, Refund, Start} from "../../generated/SaleFactory/Sale"
import { Sale, SaleFactory, ERC20, SaleStart, CanStartStateConfig, CanEndStateConfig, CalculatePriceStateConfig, SaleEnd } from "../../generated/schema"
import { ERC20 as ERC20Contract} from "../../generated/templates/SaleTemplate/ERC20"
import { SaleStatus } from "../utils"

export function handleBuy(event: Buy): void {

}

export function handleConstruct(event: Construct): void {
    let context = dataSource.context()
    let saleFactory = SaleFactory.load(context.getString("factory"))
    log.info("SaleFactory Address : {}", [saleFactory.id])
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
    
    
    let token = getERC20(event.params.token, event.block)
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
        erc20.name = erc20Contract.name()
        erc20.symbol = erc20Contract.symbol()
        erc20.decimals = erc20Contract.decimals()
        erc20.totalSupply = erc20Contract.totalSupply()
    }
    return erc20 as ERC20
}