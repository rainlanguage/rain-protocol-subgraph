import { Sale, SaleFactory } from "../../generated/schema";
import {
  NewChild,
  Implementation,
} from "../../generated/SaleFactory/SaleFactory";
import { SaleTemplate } from "../../generated/templates";
import { DataSourceContext, log } from "@graphprotocol/graph-ts";
import { ZERO_ADDRESS, ZERO_BD, ZERO_BI } from "../utils";

export function handleImplementation(event: Implementation): void {
  let saleFactory = new SaleFactory(event.address.toHex());
  saleFactory.address = event.address;
  saleFactory.implementation = event.params.implementation;
  saleFactory.children = [];
  saleFactory.save();

  let context = new DataSourceContext();
  context.setString("factory", event.address.toHex());

  SaleTemplate.createWithContext(event.params.implementation, context);
}

export function handleNewChild(event: NewChild): void {
  let saleFactory = SaleFactory.load(event.address.toHex());
  let sale = new Sale(event.params.child.toHex());
  sale.address = event.params.child;
  sale.deployer = event.transaction.from;
  sale.deployBlock = event.block.number;
  sale.deployTimestamp = event.block.timestamp;
  sale.unitsAvailable = ZERO_BI;
  sale.totalRaised = ZERO_BI;
  sale.totalFees = ZERO_BI;
  sale.percentRaised = ZERO_BD;
  sale.token = ZERO_ADDRESS;
  sale.totalRaised = ZERO_BI;
  sale.minimumRaise = ZERO_BI;
  sale.buys = [];
  sale.refunds = [];
  sale.saleTransactions = [];
  sale.notices = [];
  sale.saleFeeRecipients = [];

  if (saleFactory) {
    sale.factory = saleFactory.id;

    let children = saleFactory.children;
    if (children) children.push(sale.id);
    saleFactory.children = children;

    saleFactory.save();
  }

  sale.save();

  SaleTemplate.create(event.params.child);
}
