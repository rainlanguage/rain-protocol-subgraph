import { BigDecimal, BigInt, dataSource, DataSourceContext, ethereum, log } from "@graphprotocol/graph-ts"
import { NewContract } from "../generated/RainProtocol/RainProtocol"
import { Trust as TrustContract } from "../generated/RainProtocol/Trust"
import { RedeemableERC20Pool } from "../generated/RainProtocol/RedeemableERC20Pool"
import { RedeemableERC20 as RERC20} from "../generated/RainProtocol/RedeemableERC20"
import { SeedERC20 as SeedERC20Contract} from "../generated/RainProtocol/SeedERC20"
import { BPool } from "../generated/templates/BalancerPool/BPool"
import { TrustFactory, Trust, Contract, DistributionProgress, ReserveERC20, CRP, RedeemableERC20Pool as RERC20P, Pool, RedeemableERC20, SeedERC20 } from "../generated/schema"
import { BalancerPoolTemplate, RedeemableERC20PoolTemplate, RedeemableERC20Template, SeedERC20Template} from "../generated/templates"
// import { Trust as T, ReserveERC20 as R, BalancerPool as BP} from "../generated/templates"
import { ERC20 } from "../generated/templates/ReserveERC20/ERC20"

let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
let ZERO_BI = BigInt.fromI32(0)
let ONE_BI = BigInt.fromI32(1)
let ZERO_BD = BigDecimal.fromString("0.0")
let HUNDRED_BD = BigDecimal.fromString("100.0")

export function handleNewContract(event: NewContract): void {
  let context = new DataSourceContext()
  context.setString("trustAddress",event.params._contract.toHex())

  let TF = TrustFactory.load(event.address.toHex())
  if(TF == null){
    TF = new TrustFactory(event.address.toHex())
    TF.trusts = ZERO_BI
  }
  TF.trusts = TF.trusts.plus(ONE_BI)
  TF.save()
  let trustContract = TrustContract.bind(event.params._contract)
  let trust = new Trust(event.params._contract.toHex())
  trust.deployBlock = event.block.number
  trust.deployTimestamp = event.block.timestamp
  trust.creator = trustContract.creator()
  trust.trustParticipants = []
  let _contracts = trustContract.getContracts()
  let contracts = Contract.load(event.params._contract.toHex())
  if(contracts == null){
    contracts = new Contract(event.params._contract.toHex())
  }

  contracts.tier = _contracts.tier

  let _distributionProgress = trustContract.getDistributionProgress()

  // Creating reserveERC20
  let reserveERC20 = ReserveERC20.load(_contracts.reserveERC20.toHex())
  if(reserveERC20 == null){
    reserveERC20 = new ReserveERC20(_contracts.reserveERC20.toHex())
  }
  let reserveERC20Contract = ERC20.bind(_contracts.reserveERC20)
  reserveERC20.symbol = reserveERC20Contract.symbol()
  reserveERC20.name = reserveERC20Contract.name()
  reserveERC20.totalSupply = reserveERC20Contract.totalSupply()
  reserveERC20.decimals = reserveERC20Contract.decimals()
  reserveERC20.save()
  contracts.reserveERC20 = reserveERC20.id
  // end

  // Creating RedeemableERC20
  let redeemableERC20 = RedeemableERC20.load(_contracts.redeemableERC20.toHex())
  if(redeemableERC20 == null){
    redeemableERC20 = new RedeemableERC20(_contracts.redeemableERC20.toHex())
    redeemableERC20.holders = []
  }
  let redeemableERC20Contract = RERC20.bind(_contracts.redeemableERC20)
  redeemableERC20.redeems = []
  redeemableERC20.symbol = redeemableERC20Contract.symbol()
  redeemableERC20.name = redeemableERC20Contract.name()
  redeemableERC20.totalSupply = redeemableERC20Contract.totalSupply()
  redeemableERC20.decimals = redeemableERC20Contract.decimals()
  redeemableERC20.maxRedeemables = redeemableERC20Contract.MAX_REDEEMABLES()
  redeemableERC20.save()
  RedeemableERC20Template.createWithContext(_contracts.redeemableERC20, context)

  contracts.redeemableERC20 = redeemableERC20.id
  // end

  let distributionProgress = new DistributionProgress(event.params._contract.toHex())

  // creating seeder
  let seedERC20 = SeedERC20.load(_contracts.seeder.toHex())
  if(seedERC20 == null){
    seedERC20 = new SeedERC20(_contracts.seeder.toHex())
    seedERC20.holders = []
  }
  seedERC20.trust = trust.id
  seedERC20.seederFee = trustContract.seederFee()
  seedERC20.seederUnits = trustContract.seederUnits()
  seedERC20.seedFeePerUnit = seedERC20.seederFee.div(BigInt.fromI32(seedERC20.seederUnits))
  seedERC20.seederCooldownDuration = trustContract.seederCooldownDuration()
  log.debug("Seeder : {}", [_contracts.seeder.toHex()])
  if(_contracts.seeder.toHex() != ZERO_ADDRESS){
    let seedErc20Contract = ERC20.bind(_contracts.seeder)
    seedERC20.seederUnitsAvail = seedErc20Contract.balanceOf(_contracts.seeder)
    seedERC20.name = seedErc20Contract.name()
    seedERC20.symbol = seedErc20Contract.symbol()
    seedERC20.decimals = seedErc20Contract.decimals()
    seedERC20.totalSupply = seedErc20Contract.totalSupply()
    if(seedERC20.seederUnitsAvail.equals(ZERO_BI)){
      seedERC20.seededAmount = _distributionProgress.reserveInit
    }
  }
  seedERC20.seededAmount = reserveERC20Contract.balanceOf(_contracts.seeder)
  // seedERC20.percentSeeded = seedERC20.seededAmount.div(distributionProgress.reserveInit)
  seedERC20.factory = trustContract.seedERC20Factory()
  seedERC20.seeds = []
  seedERC20.unseeds = []
  seedERC20.redeemSeeds = []
  seedERC20.save()

  SeedERC20Template.createWithContext(_contracts.seeder, context)
  contracts.seeder = seedERC20.id
  //end

  // creating balancer Pool
  if(_contracts.pool.toHex() != ZERO_ADDRESS){
    let bpool = Pool.load(_contracts.pool.toHex())
    if(bpool == null){
      let poolContract = BPool.bind(_contracts.pool)
      bpool = new Pool(_contracts.pool.toHex())
      bpool.trust = trust.id
      bpool.spotPriceOfReserve = poolContract.getSpotPrice(_contracts.redeemableERC20, _contracts.reserveERC20)
      bpool.spotPriceOfToken = poolContract.getSpotPrice(_contracts.reserveERC20, _contracts.redeemableERC20)
      let reserveERC20 = ReserveERC20.load(_contracts.reserveERC20.toHex())
      bpool.reserve = reserveERC20.id
      bpool.redeemable = _contracts.redeemableERC20
      bpool.poolBalanceReserve = _distributionProgress.poolReserveBalance
      bpool.poolTokenBalance = _distributionProgress.poolTokenBalance
      bpool.numberOfSwaps = ZERO_BI
      bpool.swaps = []
      bpool.save()
      BalancerPoolTemplate.create(_contracts.pool)
    }
    contracts.pool = bpool.id
  }
  // end

  let crp = CRP.load(_contracts.crp.toHex())
  if(crp == null){
    crp = new CRP(_contracts.crp.toHex())
    crp.save()
  }
  contracts.crp = crp.id

  let redeemableERC20Pool = RERC20P.load(_contracts.redeemableERC20Pool.toHex())
  if(redeemableERC20Pool == null){
    redeemableERC20Pool = new RERC20P(_contracts.redeemableERC20Pool.toHex())
    redeemableERC20Pool.save()
  }
  contracts.redeemableERC20Pool = redeemableERC20Pool.id
  RedeemableERC20PoolTemplate.createWithContext(_contracts.redeemableERC20Pool, context)
  
  distributionProgress.distributionStatus = _distributionProgress.distributionStatus
  distributionProgress.distributionEndBlock = _distributionProgress.distributionEndBlock
  distributionProgress.distributionStartBlock = _distributionProgress.distributionStartBlock
  distributionProgress.minimumCreatorRaise = _distributionProgress.minimumCreatorRaise
  distributionProgress.poolReserveBalance = _distributionProgress.poolReserveBalance
  distributionProgress.poolTokenBalance = _distributionProgress.poolTokenBalance
  distributionProgress.successPoolBalance = trustContract.successBalance()
  distributionProgress.finalBalance = trustContract.finalBalance()
  distributionProgress.reserveInit = _distributionProgress.reserveInit
  distributionProgress.redeemInit = _distributionProgress.redeemInit
  distributionProgress.minimumRaise = distributionProgress.minimumCreatorRaise.plus(distributionProgress.redeemInit).plus(seedERC20.seederFee)
  if(distributionProgress.distributionStatus < 4){
    distributionProgress.amountRaised = distributionProgress.poolReserveBalance.minus(distributionProgress.reserveInit)
    distributionProgress.percentRaised = (distributionProgress.amountRaised).toBigDecimal().div((distributionProgress.minimumRaise).toBigDecimal()).times(HUNDRED_BD)
    distributionProgress.finalBalance = ZERO_BI
  }
  distributionProgress.minimumTradingDuration = ZERO_BI
  distributionProgress.finalWeight = ZERO_BI
  distributionProgress.finalValuation = ZERO_BI
  distributionProgress.percentAvailable = ZERO_BD
  if(_contracts.redeemableERC20Pool.toHex() != ZERO_ADDRESS){
    let redeemableERC20Pool = RedeemableERC20Pool.bind(_contracts.redeemableERC20Pool)
    distributionProgress.minimumTradingDuration = redeemableERC20Pool.minimumTradingDuration()
    distributionProgress.finalWeight = redeemableERC20Pool.finalWeight()
    distributionProgress.finalValuation = redeemableERC20Pool.finalValuation()
  }
  if(_contracts.redeemableERC20.toHex() != ZERO_ADDRESS){
    let redeemableERC20 = RERC20.bind(_contracts.redeemableERC20)
    distributionProgress.percentAvailable = (distributionProgress.poolTokenBalance).toBigDecimal().div(redeemableERC20.totalSupply().toBigDecimal()).times(HUNDRED_BD)
  }
  if(distributionProgress.distributionStatus < 2){
    distributionProgress.distributionEndBlock = ZERO_BI
    distributionProgress.distributionStartBlock = ZERO_BI
    distributionProgress.percentAvailable = ZERO_BD
    distributionProgress.percentRaised = ZERO_BD
    distributionProgress.poolReserveBalance = ZERO_BI
    distributionProgress.poolTokenBalance = ZERO_BI
    distributionProgress.amountRaised = ZERO_BI
  }
  
  distributionProgress.save()
  contracts.save()
  
  trust.contracts = contracts.id
  trust.distributionProgress = distributionProgress.id
  
  trust.save()
  // TrustTemplate.create(event.params._contract)
}