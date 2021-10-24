import { BigInt, dataSource, ethereum, log } from "@graphprotocol/graph-ts"
import { NewContract } from "../generated/RainProtocol/RainProtocol"
import { Trust as TrustContract } from "../generated/RainProtocol/Trust"
import { RedeemableERC20Pool } from "../generated/RainProtocol/RedeemableERC20Pool"
import { RedeemableERC20 } from "../generated/RainProtocol/RedeemableERC20"
import { BPool } from "../generated/templates/BalancerPool/BPool"
import { TrustFactory, Trust, Contract, DistributionProgress, ReserveERC20, CRP, RedeemableERC20Pool as RERC20P, Pool} from "../generated/schema"
import { Trust as T, ReserveERC20 as R, BalancerPool as BP} from "../generated/templates"
// import { Trust as T, ReserveERC20 as R, BalancerPool as BP} from "../generated/templates"
import { ERC20 } from "../generated/templates/ReserveERC20/ERC20"

let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
let ZERO_BI = BigInt.fromI32(0)
let ONE_BI = BigInt.fromI32(1)

export function handleNewContract(event: NewContract): void {
  let TF = TrustFactory.load(event.address.toHex())
  if(TF == null){
    TF = new TrustFactory(event.address.toHex())
    TF.trusts = ZERO_BI
  }
  TF.trusts = TF.trusts.plus(ONE_BI)
  TF.save()
  log.warning("Trusts added.", []);
  let trustContract = TrustContract.bind(event.params._contract)
  let trust = new Trust(event.params._contract.toHex())
  trust.deployBlock = event.block.number
  trust.deployTimestamp = event.block.timestamp
  trust.creator = trustContract.creator()
  
  let _contracts = trustContract.getContracts()
  let contracts = Contract.load(event.params._contract.toHex())
  if(contracts == null){
    contracts = new Contract(event.params._contract.toHex())
  }
  contracts.reserveERC20 = _contracts.reserveERC20
  contracts.redeemableERC20 = _contracts.redeemableERC20
  contracts.redeemableERC20Pool = _contracts.redeemableERC20Pool
  contracts.seeder = _contracts.seeder
  contracts.tier = _contracts.tier
  contracts.crp = _contracts.crp
  contracts.pool = _contracts.pool

  let _distributionProgress = trustContract.getDistributionProgress()
  // Creating reserveERC20
  let reserveERC20 = ReserveERC20.load(contracts.reserveERC20.toHex())
  if(reserveERC20 == null){
    reserveERC20 = new ReserveERC20(contracts.reserveERC20.toHex())
  }
  let reserveERC20Contract = ERC20.bind(_contracts.reserveERC20)
  reserveERC20.symbol = reserveERC20Contract.symbol()
  reserveERC20.name = reserveERC20Contract.name()
  reserveERC20.totalSupply = reserveERC20Contract.totalSupply()
  reserveERC20.decimals = reserveERC20Contract.decimals()
  reserveERC20.save()
  R.create(_contracts.reserveERC20)
  // end

  // creating balancer Pool
  if(contracts.pool.toHex() != ZERO_ADDRESS){
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
      bpool.save()
      BP.create(_contracts.pool)
    }
  }
  // end

  let crp = CRP.load(contracts.crp.toHex())
  if(crp == null){
    crp = new CRP(contracts.crp.toHex())
    crp.save()
  }

  let redeemableERC20Pool = RERC20P.load(_contracts.redeemableERC20Pool.toHex())
  if(redeemableERC20Pool == null){
    redeemableERC20Pool = new RERC20P(contracts.crp.toHex())
    redeemableERC20Pool.save()
  }

  
  let distributionProgress = new DistributionProgress(event.params._contract.toHex())
  distributionProgress.distributionStatus = _distributionProgress.distributionStatus
  distributionProgress.distributionEndBlock = _distributionProgress.distributionEndBlock
  distributionProgress.distributionStartBlock = _distributionProgress.distributionStartBlock
  distributionProgress.minimumCreatorRaise = _distributionProgress.minimumCreatorRaise
  distributionProgress.poolReserveBalance = _distributionProgress.poolReserveBalance
  distributionProgress.poolTokenBalance = _distributionProgress.poolTokenBalance
  distributionProgress.successBalance = trustContract.successBalance()
  distributionProgress.finalBalance = trustContract.finalBalance()
  distributionProgress.reserveInit = _distributionProgress.reserveInit
  distributionProgress.redeemInit = _distributionProgress.redeemInit
  if(_distributionProgress.distributionStatus < 4){
    distributionProgress.amountRaised = distributionProgress.poolReserveBalance.minus(distributionProgress.reserveInit)
    distributionProgress.percentRaised = distributionProgress.amountRaised.div(distributionProgress.successBalance)
  }
  distributionProgress.minimumTradingDuration = ZERO_BI
  distributionProgress.finalWeight = ZERO_BI
  distributionProgress.finalValuation = ZERO_BI
  distributionProgress.percentAvailable = ZERO_BI
  if(_contracts.redeemableERC20Pool.toHex() != ZERO_ADDRESS){
    let redeemableERC20Pool = RedeemableERC20Pool.bind(_contracts.redeemableERC20Pool)
    distributionProgress.minimumTradingDuration = redeemableERC20Pool.minimumTradingDuration()
    distributionProgress.finalWeight = redeemableERC20Pool.finalWeight()
    distributionProgress.finalValuation = redeemableERC20Pool.finalValuation()
  }
  if(_contracts.redeemableERC20.toHex() != ZERO_ADDRESS){
    let redeemableERC20 = RedeemableERC20.bind(_contracts.redeemableERC20)
    distributionProgress.percentAvailable = distributionProgress.poolTokenBalance.div(redeemableERC20.totalSupply())
  }
  
  distributionProgress.save()
  contracts.save()
  
  trust.contracts = contracts.id
  trust.distributionProgress = distributionProgress.id
  
  trust.save()
  T.create(event.params._contract)
}

export function handleBlock(block: ethereum.Block): void {
  let trust = dataSource.address()
  let trustContract = TrustContract.bind(trust)
  
  
  let _contracts = trustContract.getContracts()
  let contracts = Contract.load(trust.toHex())
  contracts.reserveERC20 = _contracts.redeemableERC20
  contracts.redeemableERC20 = _contracts.redeemableERC20
  contracts.redeemableERC20Pool = _contracts.redeemableERC20Pool
  contracts.seeder = _contracts.seeder
  contracts.tier = _contracts.tier
  contracts.crp = _contracts.crp
  contracts.pool = _contracts.pool

  let distributionProgress = DistributionProgress.load(trust.toHex())
  let _distributionProgress = trustContract.getDistributionProgress()
  distributionProgress.distributionStatus = _distributionProgress.distributionStatus
  distributionProgress.distributionEndBlock = _distributionProgress.distributionEndBlock
  distributionProgress.distributionStartBlock = _distributionProgress.distributionStartBlock
  distributionProgress.minimumCreatorRaise = _distributionProgress.minimumCreatorRaise
  distributionProgress.poolReserveBalance = _distributionProgress.poolReserveBalance
  distributionProgress.poolTokenBalance = _distributionProgress.poolTokenBalance
  distributionProgress.successBalance = trustContract.successBalance()
  distributionProgress.finalBalance = trustContract.finalBalance()
  distributionProgress.reserveInit = _distributionProgress.reserveInit
  distributionProgress.redeemInit = _distributionProgress.redeemInit
  if(_distributionProgress.distributionStatus < 4){
    distributionProgress.amountRaised = distributionProgress.poolReserveBalance.minus(distributionProgress.reserveInit)
    distributionProgress.percentRaised = distributionProgress.amountRaised.div(distributionProgress.successBalance)
  }
  if(_contracts.redeemableERC20Pool.toHex() != ZERO_ADDRESS){
    let redeemableERC20Pool = RedeemableERC20Pool.bind(_contracts.redeemableERC20Pool)
    distributionProgress.minimumTradingDuration = redeemableERC20Pool.minimumTradingDuration()
    distributionProgress.finalWeight = redeemableERC20Pool.finalWeight()
    distributionProgress.finalValuation = redeemableERC20Pool.finalValuation()
  }
  if(_contracts.redeemableERC20.toHex() != ZERO_ADDRESS){
    let redeemableERC20 = RedeemableERC20.bind(_contracts.redeemableERC20)
    distributionProgress.percentAvailable = distributionProgress.poolTokenBalance.div(redeemableERC20.totalSupply())
  }

  // creating balancer Pool
  if(contracts.pool.toHex() != ZERO_ADDRESS){
    let bpool = Pool.load(_contracts.pool.toHex())
    if(bpool == null){
      let poolContract = BPool.bind(_contracts.pool)
      bpool = new Pool(_contracts.pool.toHex())
      let trustId = Trust.load(trust.toHex())
      bpool.trust = trustId.id
      bpool.spotPriceOfReserve = poolContract.getSpotPrice(_contracts.redeemableERC20, _contracts.reserveERC20)
      bpool.spotPriceOfToken = poolContract.getSpotPrice(_contracts.reserveERC20, _contracts.redeemableERC20)
      let reserveERC20 = ReserveERC20.load(_contracts.reserveERC20.toHex())
      bpool.reserve = reserveERC20.id
      bpool.redeemable = _contracts.redeemableERC20
      bpool.poolBalanceReserve = _distributionProgress.poolReserveBalance
      bpool.poolTokenBalance = _distributionProgress.poolTokenBalance
      bpool.numberOfSwaps = ZERO_BI
      bpool.save()
      BP.create(_contracts.pool)
    }
  }
  // end

  distributionProgress.save()
  contracts.save()
}