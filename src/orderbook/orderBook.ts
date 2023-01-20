/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Address,
  BigInt,
  ByteArray,
  Bytes,
  crypto,
  ethereum,
} from "@graphprotocol/graph-ts";
import {
  AddOrder,
  AfterClear,
  Deposit,
  Withdraw,
  Clear,
  OrderExceedsMaxRatio,
  OrderNotFound,
  OrderZeroAmount,
  RemoveOrder,
  TakeOrder,
} from "../../generated/OrderBook/OrderBook";

import {
  Order,
  OrderClear,
  Vault,
  VaultDeposit,
  VaultWithdraw,
  TokenVault,
  OrderClearStateChange,
  TakeOrderEntity,
  Bounty,
  IO,
  ERC20,
  ExpressionStateConfig,
} from "../../generated/schema";

import { getERC20, ZERO_BI } from "../utils";

import { log } from "@graphprotocol/graph-ts";

export function handleOrderExceedsMaxRatio(event: OrderExceedsMaxRatio): void {}

export function handleOrderNotFound(event: OrderNotFound): void {}

export function handleOrderZeroAmount(event: OrderZeroAmount): void {}

export function handleAddOrder(event: AddOrder): void {
  let order = getOrderAdd(event);
  if (order) {
    let validInputsParams = event.params.order.validInputs;
    let validOutputParams = event.params.order.validOutputs;

    for (let i = 0; i < validInputsParams.length; i++) {
      //Input Token
      let input = validInputsParams[i];
      let inputToken = getERC20(input.token, event.block);

      //Input Token Vault
      let inputTokenVault = getTokenVault(
        inputToken.id,
        event.params.order.owner.toHex(),
        input.vaultId
      );

      if (inputTokenVault) {
        let ITVOrders = inputTokenVault.orders;
        if (ITVOrders) {
          if (!ITVOrders.includes(order.id)) {
            ITVOrders.push(order.id);
            inputTokenVault.orders = ITVOrders;
          }
        }

        inputTokenVault.save();
      }

      //Input Vault
      let inputValut = getVault(
        input.vaultId,
        event.params.order.owner.toHex()
      );

      if (inputValut) {
        let IVTokenvaults = inputValut.tokenVaults;
        if (inputTokenVault && IVTokenvaults)
          IVTokenvaults.push(inputTokenVault.id);
      }

      inputValut.save();
    }

    for (let i = 0; i < validOutputParams.length; i++) {
      //Output Token
      let output = validOutputParams[i];
      let outputToken = getERC20(output.token, event.block);

      //Output Token Vault
      let outputTokenVault = getTokenVault(
        outputToken.id,
        order.owner.toHex(),
        output.vaultId
      );

      if (outputTokenVault) {
        let OTVOrders = outputTokenVault.orders;
        if (OTVOrders) {
          if (!OTVOrders.includes(order.id)) {
            OTVOrders.push(order.id);
            outputTokenVault.orders = OTVOrders;
          }
        }

        outputTokenVault.save();
      }

      //Output Vault
      let outputValut = getVault(
        output.vaultId,
        event.params.order.owner.toHex()
      );

      if (outputValut) {
        let OVTokenvaults = outputValut.tokenVaults;
        if (outputTokenVault && OVTokenvaults)
          OVTokenvaults.push(outputValut.id);
      }

      outputValut.save();
    }
    order.orderLive = true;

    order.save();
  }
}

export function handleAfterClear(event: AfterClear): void {
  let orderClearStateChange = new OrderClearStateChange(
    event.block.timestamp.toString()
  );

  orderClearStateChange.aInput = event.params.clearStateChange.aInput;
  orderClearStateChange.aOutput = event.params.clearStateChange.aOutput;
  orderClearStateChange.bInput = event.params.clearStateChange.bInput;
  orderClearStateChange.bOutput = event.params.clearStateChange.aInput;
  orderClearStateChange.sender = event.params.sender;


  orderClearStateChange.save();

  let bounty = Bounty.load(event.block.timestamp.toString());

  //Update bounty vault balance
  if (bounty) {
    bounty.bountyAmountA = event.params.clearStateChange.aOutput.minus(
      event.params.clearStateChange.bInput
    );
    bounty.bountyAmountB = event.params.clearStateChange.bOutput.minus(
      event.params.clearStateChange.aInput
    );

    bounty.save();
  }

  let orderClear = OrderClear.load(event.block.timestamp.toString());
  if (orderClear) {
    orderClear.stateChange = orderClearStateChange.id;
    orderClear.save();

    let aInputIOIndex = orderClear.aInputIOIndex;
    let aOutputIOIndex = orderClear.aOutputIOIndex;
    let bInputIOIndex = orderClear.bInputIOIndex;
    let bOutputIOIndex = orderClear.bOutputIOIndex;

    let OrderA = Order.load(orderClear.orderA);
    // Update vault balances associated with Order A
    if (OrderA) {
      if (OrderA.validInputs) {
        let orderAValidInputs = OrderA.validInputs;
        if (orderAValidInputs) {
          let orderAInputIO = orderAValidInputs[aInputIOIndex.toI32()];
          if (orderAInputIO) {
            let orderAIO = IO.load(orderAInputIO);
            if (orderAIO) {
              let inputTokenVault = TokenVault.load(orderAIO.tokenVault);

              if (inputTokenVault) {
                inputTokenVault.balance = inputTokenVault.balance.plus(
                  event.params.clearStateChange.aInput
                );

                let orderClears = inputTokenVault.orderClears;
                if (orderClears) orderClears.push(orderClear.id);
                inputTokenVault.orderClears = orderClears;

                inputTokenVault.save();
              }
            }
          }
        }
      }

      if (OrderA.validOutputs) {
        let orderAValidOutputs = OrderA.validOutputs;
        if (orderAValidOutputs) {
          let orderAOutputIO = orderAValidOutputs[aOutputIOIndex.toI32()];
          if (orderAOutputIO) {
            let orderAIO = IO.load(orderAOutputIO);
            if (orderAIO) {
              let outputTokenVault = TokenVault.load(orderAIO.tokenVault);

              if (outputTokenVault) {
                outputTokenVault.balance = outputTokenVault.balance.minus(
                  event.params.clearStateChange.aOutput
                );

                let orderClears = outputTokenVault.orderClears;
                if (orderClears) orderClears.push(orderClear.id);
                outputTokenVault.orderClears = orderClears;

                outputTokenVault.save();
              }
            }
          }
        }
      }
    }

    let OrderB = Order.load(orderClear.orderB);
    // Update vault balances associated with Order B

    if (OrderB) {
      if (OrderB.validInputs) {
        let orderBValidInputs = OrderB.validInputs;
        if (orderBValidInputs) {
          let orderBInputIO = orderBValidInputs[bInputIOIndex.toI32()];
          if (orderBInputIO) {
            let orderBIO = IO.load(orderBInputIO);
            if (orderBIO) {
              let inputTokenVault = TokenVault.load(orderBIO.tokenVault);

              if (inputTokenVault) {
                inputTokenVault.balance = inputTokenVault.balance.plus(
                  event.params.clearStateChange.bInput
                );

                let orderClears = inputTokenVault.orderClears;
                if (orderClears) orderClears.push(orderClear.id);
                inputTokenVault.orderClears = orderClears;

                inputTokenVault.save();
              }
            }
          }
        }
      }

      if (OrderB.validOutputs) {
        let orderBValidOutputs = OrderB.validOutputs;
        if (orderBValidOutputs) {
          let orderBOutputIO = orderBValidOutputs[bOutputIOIndex.toI32()];
          if (orderBOutputIO) {
            let orderBIO = IO.load(orderBOutputIO);
            if (orderBIO) {
              let outputTokenVault = TokenVault.load(orderBIO.tokenVault);

              if (outputTokenVault) {
                outputTokenVault.balance = outputTokenVault.balance.minus(
                  event.params.clearStateChange.bOutput
                );

                let orderClears = outputTokenVault.orderClears;
                if (orderClears) orderClears.push(orderClear.id);
                outputTokenVault.orderClears = orderClears;

                outputTokenVault.save();
              }
            }
          }
        }
      }
    }
  }
}

export function handleClear(event: Clear): void {
  let orderClear = new OrderClear(event.block.timestamp.toString());

  orderClear.sender = event.params.sender;
  orderClear.clearer = event.params.sender;

  let order_a_: Order, order_b_: Order;

  let orders = getOrderClear(event);
  order_a_ = orders[0];
  order_b_ = orders[1];

  orderClear.orderA = order_a_.id;
  orderClear.orderB = order_b_.id;

  orderClear.owners = [order_a_.owner, order_b_.owner];

  orderClear.aInputIOIndex = event.params.clearConfig.aInputIOIndex;
  orderClear.aOutputIOIndex = event.params.clearConfig.aOutputIOIndex;
  orderClear.bInputIOIndex = event.params.clearConfig.bInputIOIndex;
  orderClear.bOutputIOIndex = event.params.clearConfig.bOutputIOIndex;

  let bounty = new Bounty(event.block.timestamp.toString());
  bounty.clearer = event.params.sender;
  bounty.orderClear = event.block.timestamp.toString();

  let bountyVaultA = getVault(
    event.params.clearConfig.aBountyVaultId,
    event.params.sender.toHex()
  );

  let bountyVaultB = getVault(
    event.params.clearConfig.bBountyVaultId,
    event.params.sender.toHex()
  );

  bounty.bountyVaultA = bountyVaultA.id;
  bounty.bountyVaultB = bountyVaultB.id;

  let aIndex = event.params.clearConfig.aOutputIOIndex;
  let bIndex = event.params.clearConfig.bOutputIOIndex;

  // Get Valid Token from Vault and set it as bounty token
  if (order_a_) {
    if (order_a_.validOutputs) {
      let ipArr = order_a_.validOutputs;
      if (ipArr) {
        let avault = ipArr[aIndex.toI32()];
        if (avault) {
          let order_a_op = IO.load(avault);
          if (order_a_op) {
            bounty.bountyTokenA = order_a_op.token;
          }
        }
      }
    }
  }

  // Get Valid Token from Vault and set it as bounty token

  if (order_b_) {
    if (order_b_.validOutputs) {
      let ipArr = order_b_.validOutputs;
      if (ipArr) {
        let avault = ipArr[bIndex.toI32()];
        if (avault) {
          let order_a_op = IO.load(avault);
          if (order_a_op) {
            bounty.bountyTokenB = order_a_op.token;
          }
        }
      }
    }
  }

  bounty.save();

  orderClear.bounty = bounty.id;

  orderClear.save();
}

export function handleDeposit(event: Deposit): void {
  let vaultDeposit = new VaultDeposit(event.transaction.hash.toHex());
  vaultDeposit.sender = event.params.sender;
  vaultDeposit.token = getERC20(event.params.config.token, event.block).id;
  vaultDeposit.vaultId = event.params.config.vaultId;
  vaultDeposit.timestamp = event.block.timestamp;

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

  tokenVault.balance = tokenVault.balance.plus(event.params.config.amount);
  tokenVault.vaultId = event.params.config.vaultId;

  tokenVault.save();

  vaultDeposit.save();

  if (vault) {
    let vDeposits = vault.deposits;
    if (vDeposits) vDeposits.push(vaultDeposit.id);
    vault.deposits = vDeposits;

    let tokenVaults = vault.tokenVaults;
    if (tokenVaults && !tokenVaults.includes(tokenVault.id))
      tokenVaults.push(tokenVault.id);
    vault.tokenVaults = tokenVaults;
    vault.save();
  }
}

export function handleRemoveOrder(event: RemoveOrder): void {
  let order = Order.load(event.params.orderHash.toHex());

  if (order) {
    order.orderLive = false;
    order.save();
  }
}

export function handleTakeOrder(event: TakeOrder): void {
  let takeOrder = new TakeOrderEntity(event.transaction.hash.toHex());

  takeOrder.sender = event.params.sender;
  takeOrder.input = event.params.input;
  takeOrder.output = event.params.output;
  takeOrder.inputIOIndex = event.params.takeOrder.inputIOIndex;
  takeOrder.outputIOIndex = event.params.takeOrder.outputIOIndex;
  takeOrder.timestamp = event.block.timestamp;

  let order_: Order;
  order_ = getTakeOrder(event)[0];
  takeOrder.order = order_.id;

  if (order_) {
    // Get IO at index position and update the vault balance
    if (order_.validInputs) {
      let orderValidInputs = order_.validInputs;
      if (orderValidInputs) {
        let orderInputIO =
          orderValidInputs[event.params.takeOrder.inputIOIndex.toI32()];
        if (orderInputIO) {
          let orderIO = IO.load(orderInputIO);
          if (orderIO) {
            let inputTokenVault = TokenVault.load(orderIO.tokenVault);
            if (inputTokenVault) {
              inputTokenVault.balance = inputTokenVault.balance.plus(
                event.params.output
              );

              inputTokenVault.save();

              let inputToken = ERC20.load(inputTokenVault.token);
              if (inputToken) {
                takeOrder.inputToken = inputToken.id;
              }
            }
          }
        }
      }
    }
    // Get IO at index position and update the vault balance
    if (order_.validOutputs) {
      let orderValidOutputs = order_.validOutputs;
      if (orderValidOutputs) {
        let orderOutputIO =
          orderValidOutputs[event.params.takeOrder.outputIOIndex.toI32()];
        if (orderOutputIO) {
          let orderIO = IO.load(orderOutputIO);
          if (orderIO) {
            let outputTokenVault = TokenVault.load(orderIO.tokenVault);

            if (outputTokenVault) {
              outputTokenVault.balance = outputTokenVault.balance.minus(
                event.params.input
              );

              outputTokenVault.save();

              let outputToken = ERC20.load(outputTokenVault.token);
              if (outputToken) {
                takeOrder.outputToken = outputToken.id;
              }
            }
          }
        }
      }
    }
  }

  takeOrder.save();
}

export function handleWithdraw(event: Withdraw): void {
  let vaultWithdraw = new VaultWithdraw(event.transaction.hash.toHex());
  vaultWithdraw.sender = event.params.sender;
  vaultWithdraw.amount = event.params.amount;
  vaultWithdraw.vaultId = event.params.config.vaultId;
  vaultWithdraw.requestedAmount = event.params.config.amount;
  vaultWithdraw.timestamp = event.block.timestamp;

  let token = getERC20(event.params.config.token, event.block);
  vaultWithdraw.token = token.id;

  let tokenVault = getTokenVault(
    token.id,
    event.params.sender.toHex(),
    event.params.config.vaultId
  );

  vaultWithdraw.tokenVault = tokenVault.id;
  tokenVault.balance = tokenVault.balance.minus(event.params.amount);
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

function getOrderAdd(event: AddOrder): Order {
  let order = Order.load(event.params.orderHash.toHex());
  if (!order) {
    order = new Order(event.params.orderHash.toHex());
    order.owner = event.params.order.owner;
    order.interpreter = event.params.order.interpreter;
    order.expressionDeployer = event.params.expressionDeployer;


    order.transactionHash = event.transaction.hash;

    order.dispatch = event.params.order.dispatch;
    order.handleIODispatch = event.params.order.handleIODispatch;
    order.data = event.params.order.data;
    order.timestamp = event.block.timestamp;

    order.stateConfig = event.transaction.hash.toHex();

    let validInputsParams = event.params.order.validInputs;
    let validOutputParams = event.params.order.validOutputs;

    let validInputs: string[] = [];
    let validOutputs: string[] = [];

    for (let i = 0; i < validInputsParams.length; i++) {
      let input = validInputsParams[i];
      let ipToken = getERC20(input.token, event.block);

      let inputIO = getIO(
        event.params.orderHash.toHex(),
        ipToken.id,
        input.vaultId
      );
      inputIO.token = ipToken.id;
      inputIO.index = BigInt.fromI32(i);

      let ipVault = getVault(input.vaultId, event.params.sender.toHex());
      inputIO.vault = ipVault.id;

      let ipTokenVault = getTokenVault(
        ipToken.id,
        event.params.sender.toHex(),
        input.vaultId
      );
      inputIO.tokenVault = ipTokenVault.id;

      inputIO.save();
      validInputs.push(inputIO.id);
    }

    for (let i = 0; i < validOutputParams.length; i++) {
      let output = validOutputParams[i];

      let opToken = getERC20(output.token, event.block);
      let outputIO = getIO(
        event.params.orderHash.toHex(),
        opToken.id,
        output.vaultId
      );

      outputIO.token = opToken.id;
      outputIO.index = BigInt.fromI32(i);

      let opVault = getVault(output.vaultId, event.params.sender.toHex());
      outputIO.vault = opVault.id;

      let opTokenVault = getTokenVault(
        opToken.id,
        event.params.sender.toHex(),
        output.vaultId
      );
      outputIO.tokenVault = opTokenVault.id;

      outputIO.save();
      validOutputs.push(outputIO.id);
    }

    order.validInputs = validInputs;
    order.validOutputs = validOutputs;
  }

  order.save();
  return order as Order;
}

function getOrderHash(event: Clear): string[] {
  let ordera_ = event.params.a;
  let orderb_ = event.params.b;

  // tokenA array
  let validAIP = ordera_.validInputs;
  let ipAIOTulpe: Array<ethereum.Tuple> = [];

  for (let i = 0; i < validAIP.length; i++) {
    let e = validAIP[i];

    let ioElement: Array<ethereum.Value> = [
      ethereum.Value.fromAddress(e.token),
      ethereum.Value.fromI32(e.decimals),
      ethereum.Value.fromUnsignedBigInt(e.vaultId),
    ];
    let ioTupleElement = changetype<ethereum.Tuple>(ioElement);
    ipAIOTulpe.push(ioTupleElement);
  }

  let validAOP = ordera_.validOutputs;
  let opAIOTulpe: Array<ethereum.Tuple> = [];

  for (let i = 0; i < validAOP.length; i++) {
    let e = validAOP[i];

    let opElement: Array<ethereum.Value> = [
      ethereum.Value.fromAddress(e.token),
      ethereum.Value.fromI32(e.decimals),
      ethereum.Value.fromUnsignedBigInt(e.vaultId),
    ];
    let opTupleElement = changetype<ethereum.Tuple>(opElement);
    opAIOTulpe.push(opTupleElement);
  }

  // tokenB array

  let validBIP = orderb_.validInputs;
  let ipBIOTulpe: Array<ethereum.Tuple> = [];

  for (let i = 0; i < validBIP.length; i++) {
    let e = validBIP[i];

    let ioElement: Array<ethereum.Value> = [
      ethereum.Value.fromAddress(e.token),
      ethereum.Value.fromI32(e.decimals),
      ethereum.Value.fromUnsignedBigInt(e.vaultId),
    ];
    let ioTupleElement = changetype<ethereum.Tuple>(ioElement);
    ipBIOTulpe.push(ioTupleElement);
  }

  let validBOP = orderb_.validOutputs;
  let opBIOTulpe: Array<ethereum.Tuple> = [];

  for (let i = 0; i < validBOP.length; i++) {
    let e = validBOP[i];

    let opElement: Array<ethereum.Value> = [
      ethereum.Value.fromAddress(e.token),
      ethereum.Value.fromI32(e.decimals),
      ethereum.Value.fromUnsignedBigInt(e.vaultId),
    ];
    let opTupleElement = changetype<ethereum.Tuple>(opElement);
    opBIOTulpe.push(opTupleElement);
  }

  let tupleArray_a_: Array<ethereum.Value> = [
    ethereum.Value.fromAddress(event.params.a.owner),
    ethereum.Value.fromAddress(event.params.a.interpreter),
    ethereum.Value.fromUnsignedBigInt(event.params.a.dispatch),
    ethereum.Value.fromUnsignedBigInt(event.params.a.handleIODispatch),
    ethereum.Value.fromTupleArray(ipAIOTulpe),
    ethereum.Value.fromTupleArray(opAIOTulpe),
    ethereum.Value.fromBytes(event.params.a.data),
  ];

  let tuple_a_ = changetype<ethereum.Tuple>(tupleArray_a_);
  let encodedOrder_a_ = ethereum.encode(ethereum.Value.fromTuple(tuple_a_))!;
  let keccak256_a_ = crypto.keccak256(encodedOrder_a_ as ByteArray);
  let uint256_a_ = hexToBI(keccak256_a_.toHex());

  let tupleArray_b_: Array<ethereum.Value> = [
    ethereum.Value.fromAddress(event.params.b.owner),
    ethereum.Value.fromAddress(event.params.b.interpreter),
    ethereum.Value.fromUnsignedBigInt(event.params.b.dispatch),
    ethereum.Value.fromUnsignedBigInt(event.params.b.handleIODispatch),
    ethereum.Value.fromTupleArray(ipBIOTulpe),
    ethereum.Value.fromTupleArray(opBIOTulpe),
    ethereum.Value.fromBytes(event.params.b.data),
  ];

  let tuple_b_ = changetype<ethereum.Tuple>(tupleArray_b_);
  let encodedOrder_b_ = ethereum.encode(ethereum.Value.fromTuple(tuple_b_))!;
  let keccak256_b_ = crypto.keccak256(encodedOrder_b_ as ByteArray);
  let uint256_b_ = hexToBI(keccak256_b_.toHex());

  if (uint256_a_ && uint256_b_)
    return [keccak256_a_.toHex(), keccak256_b_.toHex()];
  else log.info("getOrderHash Hash not found", []);
  return [];
}

function getOrderClear(event: Clear): Order[] {
  let orderHash = getOrderHash(event);

  let order_a_ = Order.load(orderHash[0]);
  let order_b_ = Order.load(orderHash[1]);

  if (order_a_ && order_b_) {
    return [order_a_, order_b_];
  } else {
    log.info("getOrderClear Orders not found", []);
  }

  return [];
}

function getTakeOrder(event: TakeOrder): Order[] {
  let order_ = event.params.takeOrder.order;

  let validAIP = order_.validInputs;
  let ipAIOTulpe: Array<ethereum.Tuple> = [];

  for (let i = 0; i < validAIP.length; i++) {
    let e = validAIP[i];

    let ioElement: Array<ethereum.Value> = [
      ethereum.Value.fromAddress(e.token),
      ethereum.Value.fromI32(e.decimals),
      ethereum.Value.fromUnsignedBigInt(e.vaultId),
    ];
    let ioTupleElement = changetype<ethereum.Tuple>(ioElement);
    ipAIOTulpe.push(ioTupleElement);
  }

  let validAOP = order_.validOutputs;
  let opAIOTulpe: Array<ethereum.Tuple> = [];

  for (let i = 0; i < validAOP.length; i++) {
    let e = validAOP[i];

    let opElement: Array<ethereum.Value> = [
      ethereum.Value.fromAddress(e.token),
      ethereum.Value.fromI32(e.decimals),
      ethereum.Value.fromUnsignedBigInt(e.vaultId),
    ];
    let opTupleElement = changetype<ethereum.Tuple>(opElement);
    opAIOTulpe.push(opTupleElement);
  }

  let tupleArray_a_: Array<ethereum.Value> = [
    ethereum.Value.fromAddress(order_.owner),
    ethereum.Value.fromAddress(order_.interpreter),
    ethereum.Value.fromUnsignedBigInt(order_.dispatch),
    ethereum.Value.fromUnsignedBigInt(order_.handleIODispatch),
    ethereum.Value.fromTupleArray(ipAIOTulpe),
    ethereum.Value.fromTupleArray(opAIOTulpe),
    ethereum.Value.fromBytes(order_.data),
  ];

  let tuple_a_ = changetype<ethereum.Tuple>(tupleArray_a_);
  let encodedOrder_a_ = ethereum.encode(ethereum.Value.fromTuple(tuple_a_))!;
  let keccak256_a_ = crypto.keccak256(encodedOrder_a_ as ByteArray);

  let Order_ = Order.load(keccak256_a_.toHex());

  if (Order_) {
    return [Order_];
  } else {
    log.info("TakeOrder not found", []);
  }
  return [];
}

function getIO(orderHash: string, token: string, id: BigInt): IO {
  let io = IO.load(orderHash + " - " + token + " - " + id.toString());
  if (!io) {
    io = new IO(orderHash + " - " + token + " - " + id.toString());
  }
  return io as IO;
}

function getTokenVault(
  token: string,
  owner: string,
  valutId: BigInt
): TokenVault {
  let tokenVault = TokenVault.load(
    valutId.toString() + " - " + owner + " - " + token
  );

  if (!tokenVault) {
    tokenVault = new TokenVault(
      valutId.toString() + " - " + owner + " - " + token
    );
    tokenVault.owner = Address.fromString(owner);
    tokenVault.token = token;
    tokenVault.orders = [];
    tokenVault.orderClears = [];
    tokenVault.vaultId = valutId;
    tokenVault.balance = ZERO_BI;
  }

  return tokenVault as TokenVault;
}

function getVault(valutId: BigInt, owner: string): Vault {
  let vault = Vault.load(valutId.toString() + " - " + owner);

  if (!vault) {
    vault = new Vault(valutId.toString() + " - " + owner);
    vault.owner = Address.fromString(owner);
    vault.tokenVaults = [];
    vault.deposits = [];
    vault.withdraws = [];
    vault.save();
  }

  return vault as Vault;
}

function hexToBI(hexString: string): BigInt {
  return BigInt.fromUnsignedBytes(
    changetype<Bytes>(Bytes.fromHexString(hexString).reverse())
  );
}
