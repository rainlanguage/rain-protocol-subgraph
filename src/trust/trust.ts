import {
  Construction,
  CreatorFundsRelease,
  EndDutchAuction,
  Initialize,
  PhaseScheduled,
  StartDutchAuction,
} from "../../generated/TrustFactory/Trust";

import {
  Contract,
  ConfigurableRightPool,
  DistributionProgress,
  DutchAuction,
  Pool,
  RedeemableERC20,
  ERC20,
  SeedERC20,
  Trust,
  TrustFactory,
  Holder,
} from "../../generated/schema";
import {
  Address,
  dataSource,
  DataSourceContext,
  log,
  BigInt,
  store,
} from "@graphprotocol/graph-ts";
import { ERC20 as ERC20Contract } from "../../generated/TrustFactory/ERC20";
import {
  PoolTemplate,
  RedeemableERC20Template,
  SeedERC20Template,
} from "../../generated/templates";
import {
  HUNDRED_BD,
  ZERO_BI,
  BONE,
  ZERO_BD,
  ONE_BI,
  DistributionStatus,
  ZERO_ADDRESS,
  getEmptyPool,
} from "../utils";

/**
 * @ handler for Contrsuction event of First Implemented Trust Contract
 * @param event Construction event
 */
export function handleConstruction(event: Construction): void {
  // Get the datasource Context to get factory addresss
  let context = dataSource.context();

  // Load the TrustFactory Entity using context
  let trustFactory = TrustFactory.load(context.getBytes("factory").toHex());

  // Initialise the Factory addresses
  if (trustFactory) {
    trustFactory.balancerFactory = event.params.balancerFactory;
    trustFactory.crpFactory = event.params.crpFactory;
    trustFactory.redeemableERC20Factory = event.params.redeemableERC20Factory;
    trustFactory.seedERC20Factory = event.params.seedERC20Factory;
    trustFactory.bPoolFeeEscrow = event.params.bPoolFeeEscrow;
    trustFactory.save();
  }
}

export function handleCreatorFundsRelease(event: CreatorFundsRelease): void {
  //Empty
}

/**
 * @description handler for EndDutchAuction event of Trust
 * @param event EndDutchAuction event
 */
export function handleEndDutchAuction(event: EndDutchAuction): void {
  // Load the DutchAuction entity
  let dutchAuction = DutchAuction.load(event.address.toHex());
  if (dutchAuction) {
    dutchAuction.enderAddress = event.params.sender;
    dutchAuction.finalBalance = event.params.finalBalance;
    dutchAuction.seederPay = event.params.seederPay;
    dutchAuction.creatorPay = event.params.creatorPay;
    dutchAuction.tokenPay = event.params.tokenPay;
    dutchAuction.poolDust = event.params.poolDust;

    dutchAuction.save();
  }

  // Load the distributionProgress uisng Trust address
  let distributionProgress = DistributionProgress.load(event.address.toHex());
  if (distributionProgress) {
    if (event.params.finalBalance >= distributionProgress.finalBalance) {
      distributionProgress.distributionStatus = DistributionStatus.Success;
    } else {
      distributionProgress.distributionStatus = DistributionStatus.Fail;
    }

    // Update the distributionProgress using event parameters
    distributionProgress.finalBalance = event.params.finalBalance;
    distributionProgress.poolReserveBalance = ZERO_BI;
    distributionProgress.poolRedeemableBalance = ZERO_BI;
    distributionProgress.percentAvailable = ZERO_BD;

    distributionProgress.save();
  }

  // Load the Contract entity using Trust address
  let contracts = Contract.load(event.address.toHex());

  // Set the poolReserveBalance and poolRedeemableBalance of Pool to Zero when auction ends.
  if (contracts && contracts.pool) {
    let pool = Pool.load(contracts.pool);
    if (pool) {
      pool.poolReserveBalance = ZERO_BI;
      pool.poolRedeemableBalance = ZERO_BI;
      pool.save();
    }
  }
}

/**
 * @description handler for Initialize event of Trust. This event will be emited when the Trust is colned from its Implementation.
 * @param event Initialize event
 */
export function handleInitialize(event: Initialize): void {
  // load the Trust entity
  let trust = Trust.load(event.address.toHex());

  // Create the new Contract for the trust
  let contracts = new Contract(event.address.toHex());
  contracts.configurableRightPool = createConfigurableRightPool(event); // Create the ConfigurableRightPool for given Trust
  contracts.reserveERC20 = createReserveERC20(event); // Create the ReserveERC20 token for given Trust
  contracts.seeder = createSeedERC20(event); // Create the SeedERC20 token for given Trust
  contracts.redeemableERC20 = createRedeemableERC20(event); // Create the RedeemableERC20 token for given Trust
  contracts.pool = getEmptyPool(); // Setting pool to  Zero Address. not available yet
  contracts.tier = ZERO_ADDRESS; // Setting tier to  Zero Address. not available yet
  contracts.save();

  // Create the new DistributionProgress for the trust
  let distributionProgress = new DistributionProgress(event.address.toHex());
  if (distributionProgress) {
    distributionProgress.finalBalance = ZERO_BI;
    distributionProgress.distributionStatus = DistributionStatus.Pending;
    distributionProgress.successPoolBalance = event.params.successBalance;
    distributionProgress.reserveInit = event.params.config.reserveInit;
    distributionProgress.initialValuation =
      event.params.config.initialValuation;
    distributionProgress.finalValuation = event.params.config.finalValuation;
    distributionProgress.minimumTradingDuration =
      event.params.config.minimumTradingDuration;
    distributionProgress.minimumCreatorRaise =
      event.params.config.minimumCreatorRaise;
    distributionProgress.redeemInit = event.params.config.redeemInit;
    distributionProgress.minimumRaise = event.params.config.minimumCreatorRaise
      .plus(event.params.config.redeemInit)
      .plus(event.params.config.seederFee);
    distributionProgress.finalWeight = valuationWeight(
      event.params.config.reserveInit,
      event.params.config.finalValuation
    );
    distributionProgress.amountRaised = ZERO_BI;
    distributionProgress.save();
  }
  // Add the Contract and DistributionProgress in to the Trust
  if (trust && contracts && distributionProgress) {
    trust.contracts = contracts.id;
    trust.distributionProgress = distributionProgress.id;
    trust.save();
  }
}

export function handlePhaseScheduled(event: PhaseScheduled): void {
  //Empty
}

/**
 * @description handler for StartDutchAuction event
 * @param event StartDutchAuction
 */
export function handleStartDutchAuction(event: StartDutchAuction): void {
  // Load the Trust entity
  let trust = Trust.load(event.address.toHex());

  // Create a new DutchAuction entity since it is a Start of auction
  let dutchAuction = new DutchAuction(event.address.toHex());
  dutchAuction.starterAddress = event.params.sender;
  dutchAuction.pool = event.params.pool;
  dutchAuction.finalAuctionBlock = event.params.finalAuctionBlock;
  dutchAuction.save();

  // Add the DutchAuction to the Trust
  if (trust) {
    trust.dutchAuction = dutchAuction.id;
    trust.save();
  }

  // Update the DistributionProgress
  let distributionProgress = DistributionProgress.load(event.address.toHex());
  if (distributionProgress) {
    distributionProgress.distributionStatus = DistributionStatus.Trading;
    distributionProgress.distributionStartBlock = event.block.number;
    distributionProgress.distributionEndBlock = event.params.finalAuctionBlock;
    distributionProgress.save();
  }

  // Update the Contracts
  let contracts = Contract.load(event.address.toHex());

  // StartDutchAuction event gives the address of pool.
  // Create Pool for contracts
  if (contracts) {
    contracts.pool = createPool(event);
    contracts.save();
  }

  // Update the PoolReserveBalance and PoolRedemableBalance of Pool
  updatePoolBalance(contracts as Contract);
}

/**
 * @description Function to get ConfigurableRightPool if exist else create a new one
 * @param event Initialize event
 * @returns string i.e iD of ConfigurableRightPool entity
 */
function createConfigurableRightPool(event: Initialize): string {
  let configurableRightPool = ConfigurableRightPool.load(
    event.params.crp.toHex()
  );
  if (configurableRightPool == null)
    configurableRightPool = new ConfigurableRightPool(event.params.crp.toHex());
  else return configurableRightPool.id;
  configurableRightPool.deployBlock = event.block.number;
  configurableRightPool.deployTimestamp = event.block.timestamp;
  configurableRightPool.save();
  return configurableRightPool.id;
}

/**
 * @description Function to create ReserveERC20 token
 * @param event Initialize event
 * @returns string i.e iD of ReserveERC20 entity
 */
function createReserveERC20(event: Initialize): string {
  // Load the ERC20 entity
  let reserveERC20 = ERC20.load(event.params.config.reserve.toHex());

  // Bind the reserev ERC20 address to ERC20 abi to make readonly calls to smartContract.
  let reserveERC20Contract = ERC20Contract.bind(event.params.config.reserve);

  // create a new token if not exist
  if (reserveERC20 == null)
    reserveERC20 = new ERC20(event.params.config.reserve.toHex());
  else return reserveERC20.id;
  reserveERC20.deployBlock = event.block.number;
  reserveERC20.deployTimestamp = event.block.timestamp;

  // Try to get token information with try_, if any non ERC20 address is passed the subgraph will not fail
  let name = reserveERC20Contract.try_name();
  let symbol = reserveERC20Contract.try_symbol();
  let decimals = reserveERC20Contract.try_decimals();
  let totalSupply = reserveERC20Contract.try_totalSupply();
  if (
    !(
      name.reverted ||
      symbol.reverted ||
      decimals.reverted ||
      totalSupply.reverted
    )
  ) {
    reserveERC20.name = name.value;
    reserveERC20.symbol = symbol.value;
    reserveERC20.decimals = decimals.value;
    reserveERC20.totalSupply = totalSupply.value;
  }

  reserveERC20.save();
  return reserveERC20.id;
}

/**
 * @description Function to create RedeemableERC20 token
 * @param event Initialize event
 * @returns string i.e iD of RedeemableERC20 entity
 */
function createRedeemableERC20(event: Initialize): string {
  // Load the RedeemableERC20 entity
  let redeemableERC20 = RedeemableERC20.load(
    event.params.redeemableERC20.toHex()
  );
  // Bind the RedeemableERC20 address to ERC20 abi to make readonly calls
  let redeemableERC20Contract = ERC20Contract.bind(
    event.params.redeemableERC20
  );

  // create a new token if not exist
  if (redeemableERC20 == null)
    redeemableERC20 = new RedeemableERC20(event.params.redeemableERC20.toHex());
  else return redeemableERC20.id;
  redeemableERC20.deployBlock = event.block.number;
  redeemableERC20.deployTimestamp = event.block.timestamp;
  // Try to get token information with try_, if any non ERC20 address is passed the subgraph will not fail
  let name = redeemableERC20Contract.try_name();
  let symbol = redeemableERC20Contract.try_symbol();
  let decimals = redeemableERC20Contract.try_decimals();
  let totalSupply = redeemableERC20Contract.try_totalSupply();
  if (
    !(
      name.reverted ||
      symbol.reverted ||
      decimals.reverted ||
      totalSupply.reverted
    )
  ) {
    redeemableERC20.name = name.value;
    redeemableERC20.symbol = symbol.value;
    redeemableERC20.decimals = decimals.value;
    redeemableERC20.totalSupply = totalSupply.value;
  }

  redeemableERC20.deployer = event.transaction.from;
  redeemableERC20.redeems = [];
  redeemableERC20.treasuryAssets = [];
  redeemableERC20.holders = [];
  redeemableERC20.grantedReceivers = [];
  redeemableERC20.grantedSenders = [];

  redeemableERC20.save();
  // Create a datasource with Trust Address
  let context = new DataSourceContext();
  context.setString("trust", event.address.toHex());
  // Create a Dynamic Datasource RedeemableERC20Template with context to index its events
  RedeemableERC20Template.createWithContext(
    event.params.redeemableERC20,
    context
  );
  return redeemableERC20.id;
}

/**
 * @description Function to create SeedERC20 token
 * @param event Initialize event
 * @returns string i.e iD of SeedERC20 entity
 */
function createSeedERC20(event: Initialize): string {
  // Load the SeedERC20 entity
  let seedERC20 = SeedERC20.load(event.params.seeder.toHex());
  let seedERC20Contract = ERC20Contract.bind(event.params.seeder);
  // Load the Trust Entity
  let trust = Trust.load(event.address.toHex());
  // Load the TrustFactory entity
  if (trust) {
    let trustFactory = TrustFactory.load(trust.factory.toHex());

    // Bind the RedeemableERC20 address to ERC20 abi to make readonly calls

    if (!seedERC20) {
      seedERC20 = new SeedERC20(event.params.seeder.toHex());
    } else return seedERC20.id;
    seedERC20.deployBlock = event.block.number;
    seedERC20.deployTimestamp = event.block.timestamp;
    seedERC20.reserve = event.params.config.reserve;
    if (trustFactory) seedERC20.factory = trustFactory.seedERC20Factory;
    seedERC20.deployer = event.transaction.from;
    seedERC20.seederFee = event.params.config.seederFee;
    seedERC20.seederUnits = ONE_BI;
    seedERC20.seedFeePerUnit = ONE_BI;
    seedERC20.seededAmount = ZERO_BI;
    seedERC20.seederUnitsAvail = ZERO_BI;

    // Try to get token information with try_, if any non ERC20 address is passed the subgraph will not fail
    let name = seedERC20Contract.try_name();
    let symbol = seedERC20Contract.try_symbol();
    let decimals = seedERC20Contract.try_decimals();
    let totalSupply = seedERC20Contract.try_totalSupply();
    if (
      !(
        name.reverted ||
        symbol.reverted ||
        decimals.reverted ||
        totalSupply.reverted
      )
    ) {
      seedERC20.name = name.value;
      seedERC20.symbol = symbol.value;
      seedERC20.decimals = decimals.value;
      seedERC20.totalSupply = totalSupply.value;
      seedERC20.seederUnits = totalSupply.value;
      seedERC20.seederUnitsAvail = totalSupply.value;
      seedERC20.seedFeePerUnit = event.params.config.seederFee.div(
        totalSupply.value
      );
    }

    seedERC20.seeds = [];
    seedERC20.unseeds = [];
    seedERC20.holders = [];
    seedERC20.redeemSeeds = [];

    // set SeedAmount and PercentSeeded to ZERO
    seedERC20.seededAmount = ZERO_BI;
    seedERC20.percentSeeded = ZERO_BD;
    seedERC20.save();

    // Create a datasource with Trust Address
    let context = new DataSourceContext();
    context.setString("trust", event.address.toHex());

    // Create a Dynamic Datasource RedeemableERC20Template with context to index its events
    SeedERC20Template.createWithContext(event.params.seeder, context);
  }
  return event.params.seeder.toHex();
}

/**
 * @description Function to create Pool
 * @param event StartDutchAuction event
 * @returns string i.e iD of Pool entity
 */
function createPool(event: StartDutchAuction): string {
  // Load the Contract entity
  let contracts = Contract.load(event.address.toHex());

  // Load the Pool entity
  let pool = Pool.load(event.params.pool.toHex());

  // if Pool entity does not exists create a new
  if (!pool) {
    pool = new Pool(event.params.pool.toHex());
    pool.deployBlock = event.block.number;
    pool.deployTimestamp = event.block.timestamp;
    pool.trust = event.address.toHex();
    pool.numberOfSwaps = ZERO_BI;
    if (contracts) pool.reserve = contracts.reserveERC20;
    if (contracts) pool.redeemable = contracts.redeemableERC20;
    pool.swaps = [];
  } else {
    return pool.id;
  }
  pool.save();

  // Remove the holder from RedeemableERC20 if Pool is in holders
  if (contracts) {
    let id = contracts.redeemableERC20 + " - " + pool.id;
    let holder = Holder.load(id);
    if (holder != null) store.remove("Holder", id);
  }

  // Create a DatasourceContext with Trust address
  let context = new DataSourceContext();
  context.setString("trust", event.address.toHex());

  // Create a Dynamic DataSource of Pool to index its events
  PoolTemplate.createWithContext(event.params.pool, context);
  return pool.id;
}

/**
 * @description Fucntion to update the PoolReserveBalance and PoolRedeemableBalnce of Pool
 * @param contracts Contract entity
 */
function updatePoolBalance(contracts: Contract): void {
  // Bind the ReserveERC20 token Address from contracts to ERC20 token abi to make readonly calls
  let reserveTokenContract = ERC20Contract.bind(
    Address.fromString(contracts.reserveERC20)
  );

  // Bind the RedeemableERC20Token token Address from contracts to ERC20 token abi to make readonly calls
  let redeemableTokenContract = ERC20Contract.bind(
    Address.fromString(contracts.redeemableERC20)
  );

  // Load the DistributionProgress entity
  let distributionProgress = DistributionProgress.load(contracts.id);

  // Try to get balance Pool Address drom ReserveERC20 token Contract
  // Use try_ incase nonERC20 address is passed and subgraph will not failed
  let poolReserveBalance = reserveTokenContract.try_balanceOf(
    Address.fromString(contracts.pool)
  );

  // Try to get balance Pool Address drom ReserveERC20 token Contract
  // Use try_ incase nonERC20 address is passed and subgraph will not failed
  let poolRedeemableBalance = redeemableTokenContract.try_balanceOf(
    Address.fromString(contracts.pool)
  );

  // Load the Pool entity
  let pool = Pool.load(contracts.pool);

  // Check if redeemableTokenContract.try_balanceOf(contracts.pool) is not reverted and update the value
  if (distributionProgress && !poolRedeemableBalance.reverted && pool) {
    distributionProgress.poolRedeemableBalance = poolRedeemableBalance.value;
    pool.poolRedeemableBalance = poolRedeemableBalance.value;
    distributionProgress.percentAvailable = poolRedeemableBalance.value
      .toBigDecimal()
      .div(redeemableTokenContract.totalSupply().toBigDecimal())
      .times(HUNDRED_BD);
  }

  // Check if reserveTokenContract.try_balanceOf(contracts.pool) is not reverted and update the value
  if (distributionProgress && !poolReserveBalance.reverted && pool) {
    distributionProgress.poolReserveBalance = poolReserveBalance.value;
    pool.poolReserveBalance = poolReserveBalance.value;

    if (distributionProgress.minimumRaise == ZERO_BI) {
      // If minimumRaise is zero set percentRaised to 100%
      distributionProgress.percentRaised = HUNDRED_BD;
    } else if (distributionProgress) {
      // Else apply  the formula percentReaise = amountRaised / minimumRaise * 100
      distributionProgress.percentRaised = distributionProgress.amountRaised
        .toBigDecimal()
        .div(distributionProgress.minimumRaise.toBigDecimal())
        .times(HUNDRED_BD);
    }

    if (
      distributionProgress &&
      distributionProgress.poolReserveBalance &&
      distributionProgress.reserveInit
    ) {
      distributionProgress.amountRaised =
        distributionProgress.poolReserveBalance.minus(
          distributionProgress.reserveInit
        );
    }
    pool.save();
  } else {
    log.info("Poola balance Failed. reserve, redeemable .", []);
  }

  // Update the Final weight
  if (distributionProgress) {
    distributionProgress.finalWeight = valuationWeight(
      distributionProgress.reserveInit,
      distributionProgress.finalValuation
    );
    distributionProgress.save();
  }
}

/**
 * @description Function to calculate finalWeight for DistributionProgress entity
 * @param reserveBalance_ BigInt: ReserveInit from DistributionProgress entity
 * @param valuation_ BigInt: finalValuation from DistributionProgress entity
 * @returns BigInt: finalWeight for DistributionProgress
 */
function valuationWeight(reserveBalance_: BigInt, valuation_: BigInt): BigInt {
  let weight = valuation_.times(BONE).div(reserveBalance_);

  return weight;
}
