import {
  Address,
  BigInt,
  ByteArray,
  crypto,
  ethereum,
} from "@graphprotocol/graph-ts";
import {
  AfterClear,
  Deposit,
  Withdraw,
  OrderDead,
  OrderLive,
  Clear,
} from "../../generated/OrderBook/OrderBook";
import { ERC20 } from "../../generated/RedeemableERC20ClaimEscrow/ERC20";

import {
  Order,
  OrderBook,
  OrderClear,
  Vault,
  VaultDeposit,
  VaultWithdraw,
  TokenVault,
  OrderClearStateChange,
  Bounty,
  OrderStateConfig,
} from "../../generated/schema";

import { getERC20 } from "../utils";

export function handleAfterClear(event: AfterClear): void {}

export function handleDeposit(event: Deposit): void {
  let vaultDeposit = new VaultDeposit(event.transaction.hash.toHex());
  vaultDeposit.sender = event.params.sender;
  vaultDeposit.token = getERC20(event.params.config.token, event.block).id;
  vaultDeposit.vaultId = event.params.config.vaultId;

  let vault = getVault(
    event.params.config.vaultId,
    event.params.sender.toHex()
  );

  vaultDeposit.vault = vault.id;
  vaultDeposit.amount = event.params.config.amount;

  let tokenVault = getTokenVault(
    event.params.config.token.toHex(),
    event.params.sender.toHex(),
    event.params.config.vaultId
  );

  vaultDeposit.tokenVault = tokenVault.id;

  let tokenContract = ERC20.bind(event.params.config.token);
  let TVBalance = tokenContract.try_balanceOf(event.params.sender);

  if (!TVBalance.reverted) {
    tokenVault.balance = TVBalance.value;
  }

  tokenVault.save();

  vaultDeposit.save();

  if (vault) {
    let vDeposits = vault.deposits;
    if (vDeposits) vDeposits.push(vaultDeposit.id);
    vault.deposits = vDeposits;
    vault.save();
  }
}

export function handleWithdraw(event: Withdraw): void {
  let vaultWithdraw = new VaultWithdraw(event.transaction.hash.toHex());
  vaultWithdraw.sender = event.params.sender;
  vaultWithdraw.amount = event.params.amount;
  vaultWithdraw.vaultId = event.params.config.vaultId;
  vaultWithdraw.requestedAmount = event.params.config.amount;

  let token = getERC20(event.params.config.token, event.block);
  vaultWithdraw.token = token.id;

  let tokenVault = getTokenVault(
    token.id,
    event.params.sender.toHex(),
    event.params.config.vaultId
  );

  vaultWithdraw.tokenVault = tokenVault.id;

  let tokenContract = ERC20.bind(event.params.config.token);
  let TVBalance = tokenContract.try_balanceOf(event.params.sender);

  if (!TVBalance.reverted) {
    tokenVault.balance = TVBalance.value;
  }

  tokenVault.save();

  let vault = getVault(
    event.params.config.vaultId,
    event.params.sender.toHex()
  );
  vaultWithdraw.vault = vault.id;

  if (vault) {
    let vWithdraws = vault.withdraws;
    if (vWithdraws) vWithdraws.push(vaultWithdraw.id);
    vault.withdraws = vWithdraws;
    vault.save();
  }

  vaultWithdraw.save();
}

export function handleOrderDead(event: OrderDead): void {
  let order = getOrderDead(event);
  order.orderLiveness = false;
  order.tracking = event.params.config.tracking;
}

export function handleOrderLive(event: OrderLive): void {
  let order = getOrderLive(event);

  if (order) {
    let inputTokenVault = getTokenVault(
      order.inputToken,
      order.owner.toHex(),
      event.params.config.inputVaultId
    );

    if (inputTokenVault) {
      let ITVOrders = inputTokenVault.orders;
      if (ITVOrders) ITVOrders.push(order.id);
      inputTokenVault.orders = ITVOrders;

      let inputTokenContract = ERC20.bind(event.params.config.inputToken);
      let ITVBalance = inputTokenContract.try_balanceOf(
        event.params.config.owner
      );

      if (!ITVBalance.reverted) {
        inputTokenVault.balance = ITVBalance.value;
      }

      inputTokenVault.save();
    }

    let inputValut = getVault(
      event.params.config.inputVaultId,
      order.owner.toHex()
    );

    if (inputValut) {
      let IVTokenvaults = inputValut.tokenVaults;
      if (inputTokenVault && IVTokenvaults)
        IVTokenvaults.push(inputTokenVault.id);
    }

    inputValut.save();

    let outputTokenVault = getTokenVault(
      order.outputToken,
      order.owner.toHex(),
      event.params.config.outputVaultId
    );

    if (outputTokenVault) {
      let OTVOrders = outputTokenVault.orders;
      if (OTVOrders) OTVOrders.push(order.id);
      outputTokenVault.orders = OTVOrders;

      let outputTokenContract = ERC20.bind(event.params.config.outputToken);
      let OTVBalance = outputTokenContract.try_balanceOf(
        event.params.config.owner
      );

      if (!OTVBalance.reverted) {
        outputTokenVault.balance = OTVBalance.value;
      }

      outputTokenVault.save();
    }

    let outputValut = getVault(
      event.params.config.outputVaultId,
      order.owner.toHex()
    );

    if (outputValut) {
      let OVTokenvaults = outputValut.tokenVaults;
      if (outputTokenVault && OVTokenvaults) OVTokenvaults.push(outputValut.id);
    }

    outputValut.save();

    order.orderLiveness = true;
    order.save();
  }
}

export function handleClear(event: Clear): void {

}

function getOrderLive(event: OrderLive): Order {
  // let encodedOrder = ethereum.encode(
  //   [
  //     "tuple(address owner, address inputToken, uint256 inputVaultId, address outputToken, uint256 outputVaultId, uint256 tracking, bytes vmState)",
  //   ],
  //   [event.params.config]
  // );

  let encodedOrder = ethereum.encode(
    ethereum.Value.fromTuple(event.params.config)
  );

  let keccak256 = crypto.keccak256(encodedOrder as ByteArray);
  let uint256 = BigInt.fromByteArray(keccak256);

  let order = Order.load(uint256.toString());
  if (!order) {
    order = new Order(uint256.toString());
    order.owner = event.params.config.owner;

    let inputToken = getERC20(event.params.config.inputToken, event.block);
    order.inputToken = inputToken.id;

    let inputTokenVault = getTokenVault(
      inputToken.id,
      event.params.config.owner.toHex(),
      event.params.config.inputVaultId
    );
    order.inputTokenVault = inputTokenVault.id;

    let inputVault = getVault(
      event.params.config.inputVaultId,
      event.params.config.owner.toHex()
    );
    order.inputVault = inputVault.id;

    let outputToken = getERC20(event.params.config.outputToken, event.block);
    order.outputToken = outputToken.id;

    let outputTokenVault = getTokenVault(
      outputToken.id,
      event.params.config.owner.toHex(),
      event.params.config.outputVaultId
    );

    order.outputTokenVault = outputTokenVault.id;

    let outputVault = getVault(
      event.params.config.outputVaultId,
      event.params.config.owner.toHex()
    );
    order.outputVault = outputVault.id;
    order.vmState = event.params.config.vmState;
  }

  order.tracking = event.params.config.tracking;
  order.save();
  return order as Order;
}

function getOrderDead(event: OrderDead): Order {
  // let encodedOrder = ethereum.encode(
  //   [
  //     "tuple(address owner, address inputToken, uint256 inputVaultId, address outputToken, uint256 outputVaultId, uint256 tracking, bytes vmState)",
  //   ],
  //   [event.params.config]
  // );

  let encodedOrder = ethereum.encode(
    ethereum.Value.fromTuple(event.params.config)
  );

  let keccak256 = crypto.keccak256(encodedOrder as ByteArray);
  let uint256 = BigInt.fromByteArray(keccak256);

  let order = Order.load(uint256.toString());
  if (!order) {
    order = new Order(uint256.toString());
    order.owner = event.params.config.owner;

    let inputToken = getERC20(event.params.config.inputToken, event.block);
    order.inputToken = inputToken.id;

    let inputTokenVault = getTokenVault(
      inputToken.id,
      event.params.config.owner.toHex(),
      event.params.config.inputVaultId
    );
    order.inputTokenVault = inputTokenVault.id;

    let inputVault = getVault(
      event.params.config.inputVaultId,
      event.params.config.owner.toHex()
    );
    order.inputVault = inputVault.id;

    let outputToken = getERC20(event.params.config.outputToken, event.block);
    order.outputToken = outputToken.id;

    let outputTokenVault = getTokenVault(
      outputToken.id,
      event.params.config.owner.toHex(),
      event.params.config.outputVaultId
    );

    order.outputTokenVault = outputTokenVault.id;

    let outputVault = getVault(
      event.params.config.outputVaultId,
      event.params.config.owner.toHex()
    );
    order.outputVault = outputVault.id;
    order.vmState = event.params.config.vmState;
  }

  order.tracking = event.params.config.tracking;
  order.save();
  return order as Order;
}

function getTokenVault(
  token: string,
  owner: string,
  valutId: BigInt
): TokenVault {
  let tokenVault = TokenVault.load(
    valutId.toString() + "-" + owner + "-" + token
  );

  if (!tokenVault) {
    tokenVault = new TokenVault(valutId.toString() + "-" + owner + "-" + token);
    tokenVault.owner = Address.fromString(owner);
    tokenVault.token = token;
    tokenVault.orders = [];
    tokenVault.orderClears = [];
  }

  return tokenVault as TokenVault;
}

function getVault(valutId: BigInt, owner: string): Vault {
  let vault = Vault.load(valutId.toString() + "-" + owner);

  if (!vault) {
    vault = new Vault(valutId.toString() + "-" + owner);
    vault.owner = Address.fromString(owner);
    vault.tokenVaults = [];
    vault.deposits = [];
    vault.withdraws = [];
    vault.save();
  }

  return vault as Vault;
}
