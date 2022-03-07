/* eslint-disable prefer-const */
import { Address, dataSource, log, BigInt } from "@graphprotocol/graph-ts";
import {
  Contract,
  DistributionProgress,
  Pool,
  Swap,
} from "../../generated/schema";
import { LOG_SWAP } from "../../generated/templates/PoolTemplate/Pool";
import { ERC20 } from "../../generated/TrustFactory/ERC20";
import {
  BONE,
  getTrustParticipent,
  HUNDRED_BD,
  ONE_BI,
  ZERO_BI,
} from "../utils";

/**
 * @description Handler for LOG_SWAP event emitied by BalancerPool ontract
 * @param event LOG_SWAP
 */
export function handleLOG_SWAP(event: LOG_SWAP): void {
  // Load the Pool entity
  let pool = Pool.load(event.address.toHex());

  // Create a new Swap entity
  let swap = new Swap(event.transaction.hash.toHex());
  swap.deployBlock = event.block.number;
  swap.deployTimestamp = event.block.timestamp;
  swap.pool = pool.id;
  swap.caller = event.params.caller;
  swap.tokenIn = event.params.tokenIn;
  swap.tokenOut = event.params.tokenOut;
  swap.tokenAmountIn = event.params.tokenAmountIn;
  swap.tokenAmountOut = event.params.tokenAmountOut;
  swap.userAddress = event.params.caller;

  // Bind the TokenIn token address to ERC20 abi to make readonly calls
  let tokenIn = ERC20.bind(event.params.tokenIn);
  swap.tokenInSym = tokenIn.symbol();

  // Bind the TokenOut token address to ERC20 abi to make readonly calls
  let tokenOut = ERC20.bind(event.params.tokenOut);
  swap.tokenOutSym = tokenOut.symbol();
  swap.save();

  // Add the Swap in Pool entity
  let swaps = pool.swaps;
  swaps.push(swap.id);
  pool.swaps = swaps;

  // Increment numberOfSwaps on  pool entity
  pool.numberOfSwaps = pool.numberOfSwaps.plus(ONE_BI);

  pool.save();

  // Get the DatasourceDontext
  let context = dataSource.context();

  // Get the TrustParticipent
  let trustParticipant = getTrustParticipent(
    event.params.caller,
    context.getString("trust")
  );

  // Add Swap in TrustPartcipent entity
  let tswaps = trustParticipant.swaps;
  tswaps.push(swap.id);
  trustParticipant.swaps = tswaps;

  trustParticipant.save();

  // Load the Contract entity
  let contracts = Contract.load(context.getString("trust"));

  // Update the poolReserveBalance and poolRedeemableBalance
  updatePoolBalance(contracts as Contract, pool as Pool);
}

/**
 * @description Function to update poolReserveBalance and poolRedeemableBalance
 * @param contracts Contract entity
 * @param pool Pool entity
 */
function updatePoolBalance(contracts: Contract, pool: Pool): void {
  // Bind the ReserveERC20 token address to ERC20 abi to make readonly calls
  let reserveTokenContract = ERC20.bind(
    Address.fromString(contracts.reserveERC20)
  );

  // Bind the RedeemableERC20 token address to ERC20 abi to make readonly calls
  let redeemableTokenContract = ERC20.bind(
    Address.fromString(contracts.redeemableERC20)
  );

  // Load the DistributionProgress entity
  let distributionProgress = DistributionProgress.load(contracts.id);

  // Try to get poolReserveBalance without breaking the subgraph
  let poolReserveBalance = reserveTokenContract.try_balanceOf(
    Address.fromString(contracts.pool)
  );

  // Try to get poolRedeemableBalance without breaking the subgraph
  let poolRedeemableBalance = redeemableTokenContract.try_balanceOf(
    Address.fromString(contracts.pool)
  );

  // Set the values if poolRedeemableBalance not reverted
  if (!poolRedeemableBalance.reverted) {
    distributionProgress.poolRedeemableBalance = poolRedeemableBalance.value;
    pool.poolRedeemableBalance = poolRedeemableBalance.value;
    distributionProgress.percentAvailable = poolRedeemableBalance.value
      .toBigDecimal()
      .div(redeemableTokenContract.totalSupply().toBigDecimal())
      .times(HUNDRED_BD);
  }

  // Set the values if poolReserveBalance not reverted
  if (!poolReserveBalance.reverted) {
    distributionProgress.poolReserveBalance = poolReserveBalance.value;
    pool.poolReserveBalance = poolReserveBalance.value;
    if (
      distributionProgress.poolReserveBalance != null &&
      distributionProgress.reserveInit != null
    ) {
      distributionProgress.amountRaised =
        distributionProgress.poolReserveBalance.minus(
          distributionProgress.reserveInit
        );
    }

    // Update the Percent Raised
    if (distributionProgress.minimumRaise == ZERO_BI) {
      distributionProgress.percentRaised = HUNDRED_BD;
    } else {
      distributionProgress.percentRaised = distributionProgress.amountRaised
        .toBigDecimal()
        .div(distributionProgress.minimumRaise.toBigDecimal())
        .times(HUNDRED_BD);
    }
  } else {
    log.info("Poola balance Failed. reserve, redeemable.", []);
  }

  // Calculate the finalWeight
  distributionProgress.finalWeight = valuationWeight(
    distributionProgress.reserveInit,
    distributionProgress.finalValuation
  );

  distributionProgress.save();
  pool.save();
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
