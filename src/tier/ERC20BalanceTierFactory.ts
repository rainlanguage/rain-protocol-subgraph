import { NewChild, Implementation } from '../../generated/ERC20BalanceTierFactory/ERC20BalanceTierFactory'
import { ERC20BalanceTier as ERC20BalanceTierContarct} from "../../generated/templates/ERC20BalanceTierTemplate/ERC20BalanceTier"
import { ERC20BalanceTierFactory, ERC20BalanceTier } from '../../generated/schema'
import { ERC20BalanceTierTemplate } from "../../generated/templates"

export function handleNewChild(event: NewChild): void {
    let erc20BalanceTierFactory = ERC20BalanceTierFactory.load(event.address.toHex())

    let erc20BalanceTier = new ERC20BalanceTier(event.params.child.toHex())
    let erc20BalanceTierContract = ERC20BalanceTierContarct.bind(event.params.child)
    
    erc20BalanceTier.address = event.params.child
    erc20BalanceTier.deployBlock = event.block.number
    erc20BalanceTier.deployTimestamp = event.block.timestamp
    erc20BalanceTier.deployer = event.transaction.from
    erc20BalanceTier.factory = event.address.toHex()
    erc20BalanceTier.tierValues = erc20BalanceTierContract.tierValues()
    erc20BalanceTier.notices = []

    let children = erc20BalanceTierFactory.children
    children.push(erc20BalanceTier.id)
    erc20BalanceTierFactory.children = children

    erc20BalanceTierFactory.save()

    erc20BalanceTier.save()

    ERC20BalanceTierTemplate.create(event.params.child)
}

export function handleImplementation(event: Implementation): void {
    let erc20BalanceTierFactory = new ERC20BalanceTierFactory(event.address.toHex())
    erc20BalanceTierFactory.implementation = event.params.implementation
    erc20BalanceTierFactory.address = event.address
    erc20BalanceTierFactory.children = []
    erc20BalanceTierFactory.save()
}
