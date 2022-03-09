/* eslint-disable prefer-const */
import {
  NewChild,
  Implementation,
} from "../../generated/TrustFactory/TrustFactory";
import { TrustFactory, Trust } from "../../generated/schema";
import { TrustTemplate } from "../../generated/templates";
import { ZERO_BI, ONE_BI, SaleStatus } from "../utils";
import { DataSourceContext } from "@graphprotocol/graph-ts";

/**
 * @deprecated handler for NewChild event of TurstFactory
 * @param event NewChild event
 */
export function handleNewChild(event: NewChild): void {
  // Load the TrustFactory entity
  let trustFactory = TrustFactory.load(event.address.toHex());

  // Create a new Trust entity with deafault value
  let trust = new Trust(event.params.child.toHex());
  trust.factory = event.address;
  trust.creator = event.params.sender;
  trust.deployBlock = event.block.number;
  trust.deployTimestamp = event.block.timestamp;
  trust.saleStatus = SaleStatus.Pending;
  trust.trustParticipants = [];
  trust.notices = [];
  trust.save();

  // Add the newly created Trust in TrustFactory entity
  if (trustFactory) {
    let trusts = trustFactory.trusts;
    if (trusts) trusts.push(trust.id);
    trustFactory.trusts = trusts;
    trustFactory.trustCount = trustFactory.trustCount.plus(ONE_BI);
    trustFactory.save();
  }

  // Create dynamic datasource for Trust to index its events
  TrustTemplate.create(event.params.child);
}

/**
 * @description handler for Implementation event of Trust Factory
 *              This is the first event emited by TrustFactiry
 * @param event Implementation event
 */
export function handleImplementation(event: Implementation): void {
  //Create a TrustFactory entity
  let trustFactory = new TrustFactory(event.address.toHex());
  trustFactory.trustCount = ZERO_BI;
  trustFactory.trusts = [];

  // Create a DataSourceContext with factory address in it
  let context = new DataSourceContext();
  context.setBytes("factory", event.address);

  // Create dynamic datasource for Trust to index its events with context
  // Index this Implementation Trust to get Contruction event
  TrustTemplate.createWithContext(event.params.implementation, context);
  trustFactory.save();
}
