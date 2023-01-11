import {
  ValidInterpreter,
  ExpressionDeployed,
  ExpressionConfig,
} from "../../generated/RainterpreterExpressionDeployer/RainterpreterExpressionDeployer";
import {
  ExpressionStateConfig,
  ExpressionDeployer,
} from "../../generated/schema";

import { OrderBook as OrderBookContract } from "../../generated/OrderBook/OrderBook";

import { Rainterpreter } from "../../generated/RainterpreterExpressionDeployer/Rainterpreter";

import { Address, Bytes } from "@graphprotocol/graph-ts";

import { log } from "@graphprotocol/graph-ts";

// import {   getExpressionStateConfig } from "../utils";

export function handleValidInterpreter(event: ValidInterpreter): void {
  let expressionDeployer = new ExpressionDeployer(event.address.toHex());
  expressionDeployer.interpreter = event.params.interpreter;

  let contract = Rainterpreter.bind(event.params.interpreter);
  let functionPointers = contract.functionPointers().toHexString();

  expressionDeployer.functionPointers = functionPointers;
  expressionDeployer.save();
}

export function handleExpressionDeployed(event: ExpressionDeployed): void {
  let deployExpressionObject = getExpressionState(
    event.transaction.hash.toHex()
  );
  deployExpressionObject.expressionAddress = event.params.expression;

  deployExpressionObject.save();
}

export function handleExpressionConfig(event: ExpressionConfig): void {
  let deployExpressionObject = getExpressionState(
    event.transaction.hash.toHex()
  );

  deployExpressionObject.sources = event.params.config.sources;
  deployExpressionObject.constants = event.params.config.constants;

  let expressionDeployer = ExpressionDeployer.load(event.address.toHex());
  if (expressionDeployer) {
    deployExpressionObject.decompiledSources = decompileStateConfig(
      expressionDeployer.functionPointers,
      event
    );

    deployExpressionObject.save();
  }
}

function decompileStateConfig(
  functionPointers: string,
  event: ExpressionConfig
): Bytes[] {
  let packedFnPtrs = functionPointers.substring(2);
  let srcsArray = event.params.config.sources;
  let decompiledSources: string[] = [];
  let decompiledSourcesBytes: Bytes[] = [];

  let count = 0;

  for (let k = 0; k < srcsArray.length; k++) {
    let srcs = srcsArray[k].toHex().substring(2);
    let sources: string[] = [];
    for (let i = 0; i < srcs.length; i += 4) {
      if (count % 2 == 0) {
        let indx = findPtrs(packedFnPtrs, srcs.substring(i, i + 4));
        sources.push(indx);
      } else {
        sources.push(srcs.substring(i, i + 4));
      }
      count++;
    }
    decompiledSources.push("0x" + sources.join(""));
  }

  log.info("decompiledSources {} : ", [decompiledSources.join("")]);

  for (let i = 0; i < decompiledSources.length; i++) {
    decompiledSourcesBytes.push(Bytes.fromHexString(decompiledSources[i]));
    log.info("decompiledSourcesBytes {} : ", [
      Bytes.fromHexString(decompiledSources[i]).toString(),
    ]);
  }
  return decompiledSourcesBytes;
}

function findPtrs(packedFnPtrs: string, opPtr: string): string {
  let index = 0;

  for (let j = 0; j < packedFnPtrs.length; j += 4) {
    if (packedFnPtrs.substring(j, j + 4) == opPtr) {
      break;
    }
    index++;
  }
  return ("0000" + index.toString(16).toLowerCase()).slice(-4);
}

function getExpressionState(hash: string): ExpressionStateConfig {
  let deployExpressionObject = ExpressionStateConfig.load(hash);

  if (!deployExpressionObject) {
    deployExpressionObject = new ExpressionStateConfig(hash);
    deployExpressionObject.expressionAddress = Address.zero();
    deployExpressionObject.sources = [];
    deployExpressionObject.constants = [];
    deployExpressionObject.decompiledSources = [];
    deployExpressionObject.save();
  }
  return deployExpressionObject as ExpressionStateConfig;
}
