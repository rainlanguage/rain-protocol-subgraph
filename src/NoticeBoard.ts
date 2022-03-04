import { NewNotice } from "../generated/NoticeBoard/NoticeBoard";
import {
  UnknownTier,
  Notice,
  Sale,
  Trust,
  Verify,
  ERC20BalanceTier,
  VerifyTier,
  ERC20TransferTier,
  ERC721BalanceTier,
  CombineTier,
  GatedNFT,
  RedeemableERC20ClaimEscrow,
  UnknownNotice,
} from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

/**
 * @description handler of NewNotice event
 * @param event NewNotice Event
 */
export function handleNewNotice(event: NewNotice): void {
  /**
   * Get the subject of event i.e to which contract the notice is sent
   * Currently we only save notice which sent to Trust, Sale, Verify
   * ERC20BalancerTier, ERC20TransferTier, ERC721BalanceTIer, CombineTier
   * UnknownTier, GatedNFT, RedeemableERC20ClaimEscrow
   */
  const subject = event.params.notice.subject.toHex();

  let newNotice: Notice; // Empty notice object

  /**
   * load all the bojects to compare
   */
  const trust = Trust.load(subject);
  const sale = Sale.load(subject);
  const verify = Verify.load(subject);
  const eRC20BalanceTier = ERC20BalanceTier.load(subject);
  const verifyTier = VerifyTier.load(subject);
  const eRC20TransferTier = ERC20TransferTier.load(subject);
  const eRC721BalanceTier = ERC721BalanceTier.load(subject);
  const combineTier = CombineTier.load(subject);
  const gatedNFT = GatedNFT.load(subject);
  const unknownTier = UnknownTier.load(subject);
  const redeemableERC20ClaimEscrow = RedeemableERC20ClaimEscrow.load(subject);

  /**
   * check if subject is from which Entity and add the newNotice to it
   * else Create a UnknownNotice Entitiy and add notice in it
   */
  if (trust != null) {
    const notices = trust.notices;

    newNotice = new Notice(
      trust.id +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;

    newNotice.subject = trust.id;
    notices.push(newNotice.id);
    trust.notices = notices;
    trust.save();
  } else if (sale != null) {
    const notices = sale.notices;

    newNotice = new Notice(
      sale.id +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;

    newNotice.subject = sale.id;
    notices.push(newNotice.id);
    sale.notices = notices;
    sale.save();
  } else if (verify != null) {
    const notices = verify.notices;

    newNotice = new Notice(
      verify.id +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;
    newNotice.subject = verify.id;

    notices.push(newNotice.id);
    verify.notices = notices;
    verify.save();
  } else if (eRC20BalanceTier != null) {
    const notices = eRC20BalanceTier.notices;

    newNotice = new Notice(
      eRC20BalanceTier.id +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;

    newNotice.subject = eRC20BalanceTier.id;

    notices.push(newNotice.id);
    eRC20BalanceTier.notices = notices;
    eRC20BalanceTier.save();
  } else if (verifyTier != null) {
    const notices = verifyTier.notices;

    newNotice = new Notice(
      verifyTier.id +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;

    newNotice.subject = verifyTier.id;
    notices.push(newNotice.id);
    verifyTier.notices = notices;
    verifyTier.save();
  } else if (eRC20TransferTier != null) {
    const notices = eRC20TransferTier.notices;

    newNotice = new Notice(
      eRC20TransferTier.id +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;

    newNotice.subject = eRC20TransferTier.id;
    notices.push(newNotice.id);
    eRC20TransferTier.notices = notices;
    eRC20TransferTier.save();
  } else if (eRC721BalanceTier != null) {
    const notices = eRC721BalanceTier.notices;

    newNotice = new Notice(
      eRC721BalanceTier.id +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;

    newNotice.subject = eRC721BalanceTier.id;
    notices.push(newNotice.id);
    eRC721BalanceTier.notices = notices;
    eRC721BalanceTier.save();
  } else if (combineTier != null) {
    const notices = combineTier.notices;

    newNotice = new Notice(
      combineTier.id +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;

    newNotice.subject = combineTier.id;
    notices.push(newNotice.id);
    combineTier.notices = notices;
    combineTier.save();
  } else if (gatedNFT != null) {
    const notices = gatedNFT.notices;

    newNotice = new Notice(
      gatedNFT.id +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;

    newNotice.subject = gatedNFT.id;
    notices.push(newNotice.id);
    gatedNFT.notices = notices;
    gatedNFT.save();
  } else if (redeemableERC20ClaimEscrow != null) {
    const notices = redeemableERC20ClaimEscrow.notices;

    newNotice = new Notice(
      redeemableERC20ClaimEscrow.id +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;

    newNotice.subject = redeemableERC20ClaimEscrow.id;
    notices.push(newNotice.id);
    redeemableERC20ClaimEscrow.notices = notices;
    redeemableERC20ClaimEscrow.save();
  } else if (unknownTier != null) {
    const notices = unknownTier.notices;

    newNotice = new Notice(
      unknownTier.id +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;

    newNotice.subject = unknownTier.id;
    notices.push(newNotice.id);
    unknownTier.notices = notices;
    unknownTier.save();
  } else {
    let unknownNotice = UnknownNotice.load("UNKNOWN_NOTICES");
    if (unknownNotice == null) {
      unknownNotice = new UnknownNotice("UNKNOWN_NOTICES");
      unknownNotice.notices = [];
    }

    const notices = unknownNotice.notices;

    newNotice = new Notice(
      "UNKNOWN_NOTICES" +
        " - " +
        event.transaction.hash.toHex() +
        " - " +
        BigInt.fromI32(notices.length).toString()
    );
    newNotice.data = event.params.notice.data;
    newNotice.sender = event.params.sender;
    newNotice.deployBlock = event.block.number;
    newNotice.deployTimestamp = event.block.timestamp;
    newNotice.subject = "UNKNOWN_NOTICES";

    notices.push(newNotice.id);
    unknownNotice.notices = notices;
    unknownNotice.save();
  }

  newNotice.save();
}
