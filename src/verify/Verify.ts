/* eslint-disable prefer-const */
import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  Verify,
  VerifyAddress,
  VerifyApprove,
  VerifyBan,
  VerifyRemove,
  VerifyRequestApprove,
  VerifyRequestBan,
  VerifyRequestRemove,
} from "../../generated/schema";
import {
  Approve,
  Ban,
  Remove,
  RequestApprove,
  RequestBan,
  RequestRemove,
  RoleAdminChanged,
  RoleGranted,
  RoleRevoked,
  Verify as VerifyContract,
  Verify__statusAtBlockInputState_Struct,
} from "../../generated/templates/VerifyTemplate/Verify";
import {
  APPROVER,
  APPROVER_ADMIN,
  BANNER,
  BANNER_ADMIN,
  ONE_BI,
  REMOVER,
  REMOVER_ADMIN,
  RequestStatus,
  Role,
  Status,
} from "../utils";

export function handleApprove(event: Approve): void {
  let verify = Verify.load(event.address.toHex());
  verify.verifyEventCount = verify.verifyEventCount.plus(ONE_BI);
  let verifyApprovals = verify.verifyApprovals;
  let count = verify.verifyEventCount.toString();

  let verifyContract = VerifyContract.bind(event.address);

  let state = verifyContract.state(
    event.params.evidence.account
  ) as Verify__statusAtBlockInputState_Struct;

  let status = verifyContract.statusAtBlock(state, event.block.number);

  log.info("Status : {}", [status.toString()]);

  let verifyApprove = new VerifyApprove(
    event.address.toHex() +
      " - " +
      event.transaction.hash.toHex() +
      " - " +
      count
  );
  verifyApprove.block = event.block.number;
  verifyApprove.transactionHash = event.transaction.hash;
  verifyApprove.timestamp = event.block.timestamp;
  verifyApprove.verifyContract = event.address;
  verifyApprove.sender = event.params.sender;
  verifyApprove.account = event.params.evidence.account;
  verifyApprove.data = event.params.evidence.data;
  verifyApprove.save();

  verifyApprovals.push(verifyApprove.id);
  verify.verifyApprovals = verifyApprovals;
  verify.save();

  let verifyAddress = getVerifyAddress(
    event.address.toHex(),
    event.params.evidence.account.toHex()
  );
  verifyAddress.requestStatus = RequestStatus.NONE;
  verifyAddress.status = Status.APPROVED;
  let events = verifyAddress.events;
  events.push(verifyApprove.id);
  verifyAddress.events = events;
  verifyAddress.save();

  let role = getVerifyAddress(
    event.address.toHex(),
    event.params.sender.toHex()
  );

  let roleEvents = role.events;
  roleEvents.push(verifyApprove.id);
  role.events = roleEvents;
  role.save();
}

export function handleBan(event: Ban): void {
  let verify = Verify.load(event.address.toHex());
  verify.verifyEventCount = verify.verifyEventCount.plus(ONE_BI);
  let verifyBans = verify.verifyBans;
  let count = verify.verifyEventCount.toString();

  let ban = new VerifyBan(
    event.address.toHex() +
      " - " +
      event.transaction.hash.toHex() +
      " - " +
      count
  );
  ban.block = event.block.number;
  ban.transactionHash = event.transaction.hash;
  ban.timestamp = event.block.timestamp;
  ban.verifyContract = event.address;
  ban.sender = event.params.sender;
  ban.account = event.params.evidence.account;
  ban.data = event.params.evidence.data;
  ban.save();

  verifyBans.push(ban.id);
  verify.verifyBans = verifyBans;
  verify.save();

  let verifyAddress = getVerifyAddress(
    event.address.toHex(),
    event.params.evidence.account.toHex()
  );
  verifyAddress.requestStatus = RequestStatus.NONE;
  verifyAddress.status = Status.BANNED;
  let events = verifyAddress.events;
  events.push(ban.id);
  verifyAddress.events = events;
  verifyAddress.save();

  let role = getVerifyAddress(
    event.address.toHex(),
    event.params.sender.toHex()
  );

  let roleEvents = role.events;
  roleEvents.push(ban.id);
  role.events = roleEvents;
  role.save();
}

export function handleRemove(event: Remove): void {
  let verify = Verify.load(event.address.toHex());
  verify.verifyEventCount = verify.verifyEventCount.plus(ONE_BI);
  let verifyRemovals = verify.verifyRemovals;
  let count = verify.verifyEventCount.toString();

  let verifyRemove = new VerifyRemove(
    event.address.toHex() +
      " - " +
      event.transaction.hash.toHex() +
      " - " +
      count
  );
  verifyRemove.block = event.block.number;
  verifyRemove.transactionHash = event.transaction.hash;
  verifyRemove.timestamp = event.block.timestamp;
  verifyRemove.verifyContract = event.address;
  verifyRemove.sender = event.params.sender;
  verifyRemove.account = event.params.evidence.account;
  verifyRemove.data = event.params.evidence.data;
  verifyRemove.save();

  verifyRemovals.push(verifyRemove.id);
  verify.verifyRemovals = verifyRemovals;
  verify.save();

  let verifyAddress = getVerifyAddress(
    event.address.toHex(),
    event.params.evidence.account.toHex()
  );
  verifyAddress.requestStatus = RequestStatus.NONE;
  verifyAddress.status = Status.REMOVED;
  let events = verifyAddress.events;
  events.push(verifyRemove.id);
  verifyAddress.events = events;
  verifyAddress.save();

  let role = getVerifyAddress(
    event.address.toHex(),
    event.params.sender.toHex()
  );

  let roleEvents = role.events;
  roleEvents.push(verifyRemove.id);
  role.events = roleEvents;
  role.save();
}

export function handleRequestApprove(event: RequestApprove): void {
  let verify = Verify.load(event.address.toHex());
  verify.verifyEventCount = verify.verifyEventCount.plus(ONE_BI);
  let verifyRequestApprovals = verify.verifyRequestApprovals;
  let count = verify.verifyEventCount.toString();

  let verifyRequestApprove = new VerifyRequestApprove(
    event.address.toHex() +
      " - " +
      event.transaction.hash.toHex() +
      " - " +
      count
  );
  verifyRequestApprove.block = event.block.number;
  verifyRequestApprove.timestamp = event.block.timestamp;
  verifyRequestApprove.transactionHash = event.transaction.hash;
  verifyRequestApprove.verifyContract = event.address;
  verifyRequestApprove.sender = event.params.sender;
  verifyRequestApprove.account = event.params.sender;
  verifyRequestApprove.data = event.params.evidence.data;
  verifyRequestApprove.save();

  verifyRequestApprovals.push(verifyRequestApprove.id);
  verify.verifyRequestApprovals = verifyRequestApprovals;
  verify.save();

  let verifyAddress = getVerifyAddress(
    event.address.toHex(),
    event.params.sender.toHex()
  );
  verifyAddress.requestStatus = RequestStatus.REQUEST_APPROVE;

  let events = verifyAddress.events;
  events.push(verifyRequestApprove.id);
  verifyAddress.events = events;

  verifyAddress.save();
}

export function handleRequestBan(event: RequestBan): void {
  let verify = Verify.load(event.address.toHex());
  verify.verifyEventCount = verify.verifyEventCount.plus(ONE_BI);
  let verifyRequestBans = verify.verifyRequestBans;
  let count = verify.verifyEventCount.toString();

  let verifyRequestBan = new VerifyRequestBan(
    event.address.toHex() +
      " - " +
      event.transaction.hash.toHex() +
      " - " +
      count
  );
  verifyRequestBan.block = event.block.number;
  verifyRequestBan.timestamp = event.block.timestamp;
  verifyRequestBan.transactionHash = event.transaction.hash;
  verifyRequestBan.verifyContract = event.address;
  verifyRequestBan.sender = event.params.sender;
  verifyRequestBan.account = event.params.evidence.account;
  verifyRequestBan.data = event.params.evidence.data;
  verifyRequestBan.save();

  verifyRequestBans.push(verifyRequestBan.id);
  verify.verifyRequestBans = verifyRequestBans;
  verify.save();

  let verifyAddress = VerifyAddress.load(
    event.address.toHex() + " - " + event.params.evidence.account.toHex()
  );
  verifyAddress.requestStatus = RequestStatus.REQUEST_BAN;
  let events = verifyAddress.events;
  events.push(verifyRequestBan.id);
  verifyAddress.events = events;
  verifyAddress.save();

  let verifyAddressRequester = getVerifyAddress(
    event.address.toHex(),
    event.params.sender.toHex()
  );
  let eventsRequester = verifyAddressRequester.events;
  eventsRequester.push(verifyRequestBan.id);
  verifyAddressRequester.events = eventsRequester;
  verifyAddressRequester.save();
}

export function handleRequestRemove(event: RequestRemove): void {
  let verify = Verify.load(event.address.toHex());
  verify.verifyEventCount = verify.verifyEventCount.plus(ONE_BI);
  let verifyRequestRemovals = verify.verifyRequestRemovals;
  let count = verify.verifyEventCount.toString();

  let verifyRequestRemove = new VerifyRequestRemove(
    event.address.toHex() +
      " - " +
      event.transaction.hash.toHex() +
      " - " +
      count
  );
  verifyRequestRemove.block = event.block.number;
  verifyRequestRemove.timestamp = event.block.timestamp;
  verifyRequestRemove.transactionHash = event.transaction.hash;
  verifyRequestRemove.verifyContract = event.address;
  verifyRequestRemove.sender = event.params.sender;
  verifyRequestRemove.account = event.params.evidence.account;
  verifyRequestRemove.data = event.params.evidence.data;
  verifyRequestRemove.save();

  verifyRequestRemovals.push(verifyRequestRemove.id);
  verify.verifyRequestRemovals = verifyRequestRemovals;
  verify.save();

  let verifyAddress = getVerifyAddress(
    event.address.toHex(),
    event.params.evidence.account.toHex()
  );
  verifyAddress.requestStatus = RequestStatus.REQUEST_REMOVE;
  let events = verifyAddress.events;
  events.push(verifyRequestRemove.id);
  verifyAddress.events = events;
  verifyAddress.save();

  let verifyAddressRequester = getVerifyAddress(
    event.address.toHex(),
    event.params.sender.toHex()
  );
  let eventsRequester = verifyAddressRequester.events;
  eventsRequester.push(verifyRequestRemove.id);
  verifyAddressRequester.events = eventsRequester;
  verifyAddressRequester.save();
}

export function handleRoleAdminChanged(event: RoleAdminChanged): void {
  // EMPTY
}

export function handleRoleGranted(event: RoleGranted): void {
  if (event.params.role.toHex() == APPROVER) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );
    let roles = verifyAddress.roles;
    if (!roles.includes(BigInt.fromI32(Role.APPROVER))) {
      roles.push(BigInt.fromI32(Role.APPROVER));
      verifyAddress.roles = roles;
      verifyAddress.save();

      let verify = Verify.load(event.address.toHex());
      let approvers = verify.approvers;
      approvers.push(verifyAddress.id);
      verify.approvers = approvers;
      verify.save();
    }
  } else if (event.params.role.toHex() == REMOVER) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );
    let roles = verifyAddress.roles;
    if (!roles.includes(BigInt.fromI32(Role.REMOVER))) {
      roles.push(BigInt.fromI32(Role.REMOVER));
      verifyAddress.roles = roles;
      verifyAddress.save();

      let verify = Verify.load(event.address.toHex());
      let removers = verify.removers;
      removers.push(verifyAddress.id);
      verify.removers = removers;
      verify.save();
    }
  } else if (event.params.role.toHex() == BANNER) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );
    let roles = verifyAddress.roles;
    if (!roles.includes(BigInt.fromI32(Role.BANNER))) {
      roles.push(BigInt.fromI32(Role.BANNER));
      verifyAddress.roles = roles;
      verifyAddress.save();
      let verify = Verify.load(event.address.toHex());
      let banners = verify.banners;
      banners.push(verifyAddress.id);
      verify.banners = banners;
      verify.save();
    }
  } else if (event.params.role.toHex() == APPROVER_ADMIN) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );
    let roles = verifyAddress.roles;
    if (!roles.includes(BigInt.fromI32(Role.APPROVER_ADMIN))) {
      roles.push(BigInt.fromI32(Role.APPROVER_ADMIN));
      verifyAddress.roles = roles;
      verifyAddress.save();
      let verify = Verify.load(event.address.toHex());
      let approverAdmins = verify.approverAdmins;
      approverAdmins.push(verifyAddress.id);
      verify.approverAdmins = approverAdmins;
      verify.save();
    }
  } else if (event.params.role.toHex() == REMOVER_ADMIN) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );
    let roles = verifyAddress.roles;
    if (!roles.includes(BigInt.fromI32(Role.REMOVER_ADMIN))) {
      roles.push(BigInt.fromI32(Role.REMOVER_ADMIN));
      verifyAddress.roles = roles;
      verifyAddress.save();
      let verify = Verify.load(event.address.toHex());
      let removerAdmins = verify.removerAdmins;
      removerAdmins.push(verifyAddress.id);
      verify.removerAdmins = removerAdmins;
      verify.save();
    }
  } else if (event.params.role.toHex() == BANNER_ADMIN) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );
    let roles = verifyAddress.roles;
    if (!roles.includes(BigInt.fromI32(Role.BANNER_ADMIN))) {
      roles.push(BigInt.fromI32(Role.BANNER_ADMIN));
      verifyAddress.roles = roles;
      verifyAddress.save();
      let verify = Verify.load(event.address.toHex());
      let bannerAdmins = verify.bannerAdmins;
      bannerAdmins.push(verifyAddress.id);
      verify.bannerAdmins = bannerAdmins;
      verify.save();
    }
  }
}

export function handleRoleRevoked(event: RoleRevoked): void {
  if (event.params.role.toHex() == APPROVER_ADMIN) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );

    let roles = verifyAddress.roles;
    let new_role: BigInt[] = [];
    while (roles.length != 0) {
      let ele = roles.pop();
      if (ele != BigInt.fromI32(Role.APPROVER_ADMIN)) new_role.push(ele);
    }
    verifyAddress.roles = new_role;
    verifyAddress.save();

    let verify = Verify.load(event.address.toHex());
    let approverAdmins = verify.approverAdmins;
    let new_approverAdmins: string[] = [];
    while (approverAdmins.length != 0) {
      let ele = approverAdmins.pop();
      if (ele != verifyAddress.id) new_approverAdmins.push(ele);
    }
    verify.approverAdmins = new_approverAdmins;
    verify.save();
  } else if (event.params.role.toHex() == REMOVER_ADMIN) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );

    let roles = verifyAddress.roles;
    let new_role: BigInt[] = [];
    while (roles.length != 0) {
      let ele = roles.pop();
      if (ele != BigInt.fromI32(Role.REMOVER_ADMIN)) new_role.push(ele);
    }
    verifyAddress.roles = new_role;
    verifyAddress.save();

    let verify = Verify.load(event.address.toHex());
    let removerAdmins = verify.removerAdmins;
    let new_removerAdmins: string[] = [];
    while (removerAdmins.length != 0) {
      let ele = removerAdmins.pop();
      if (ele != verifyAddress.id) new_removerAdmins.push(ele);
    }
    verify.removerAdmins = new_removerAdmins;
    verify.save();
  } else if (event.params.role.toHex() == BANNER_ADMIN) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );

    let roles = verifyAddress.roles;
    let new_role: BigInt[] = [];
    while (roles.length != 0) {
      let ele = roles.pop();
      if (ele != BigInt.fromI32(Role.BANNER_ADMIN)) new_role.push(ele);
    }
    verifyAddress.roles = new_role;
    verifyAddress.save();

    let verify = Verify.load(event.address.toHex());
    let bannerAdmins = verify.bannerAdmins;
    let new_bannerAdmins: string[] = [];
    while (bannerAdmins.length != 0) {
      let ele = bannerAdmins.pop();
      if (ele != verifyAddress.id) new_bannerAdmins.push(ele);
    }
    verify.bannerAdmins = new_bannerAdmins;
    verify.save();
  } else if (event.params.role.toHex() == APPROVER) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );

    let roles = verifyAddress.roles;
    let new_role: BigInt[] = [];
    while (roles.length != 0) {
      let ele = roles.pop();
      if (ele != BigInt.fromI32(Role.APPROVER)) new_role.push(ele);
    }
    verifyAddress.roles = new_role;
    verifyAddress.save();

    let verify = Verify.load(event.address.toHex());
    let approvers = verify.approvers;
    let new_approvers: string[] = [];
    while (approvers.length != 0) {
      let ele = approvers.pop();
      if (ele != verifyAddress.id) new_approvers.push(ele);
    }
    verify.approvers = new_approvers;
    verify.save();
  } else if (event.params.role.toHex() == REMOVER) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );

    let roles = verifyAddress.roles;
    let new_role: BigInt[] = [];
    while (roles.length != 0) {
      let ele = roles.pop();
      if (ele != BigInt.fromI32(Role.REMOVER)) new_role.push(ele);
    }
    verifyAddress.roles = new_role;
    verifyAddress.save();

    let verify = Verify.load(event.address.toHex());
    let removers = verify.removers;
    let new_removers: string[] = [];
    while (removers.length != 0) {
      let ele = removers.pop();
      if (ele != verifyAddress.id) new_removers.push(ele);
    }
    verify.removers = new_removers;
    verify.save();
  } else if (event.params.role.toHex() == BANNER) {
    let verifyAddress = getVerifyAddress(
      event.address.toHex(),
      event.params.account.toHex()
    );

    let roles = verifyAddress.roles;
    let new_role: BigInt[] = [];
    while (roles.length != 0) {
      let ele = roles.pop();
      if (ele != BigInt.fromI32(Role.BANNER)) new_role.push(ele);
    }
    verifyAddress.roles = new_role;
    verifyAddress.save();

    let verify = Verify.load(event.address.toHex());
    let banners = verify.banners;
    let new_banners: string[] = [];
    while (banners.length != 0) {
      let ele = banners.pop();
      if (ele != verifyAddress.id) new_banners.push(ele);
    }
    verify.banners = new_banners;
    verify.save();
  }
}

function getVerifyAddress(
  verifyContract: string,
  account: string
): VerifyAddress {
  let verifyAddress = VerifyAddress.load(verifyContract + " - " + account);
  if (verifyAddress == null) {
    verifyAddress = new VerifyAddress(verifyContract + " - " + account);
    verifyAddress.verifyContract = verifyContract;
    verifyAddress.address = Address.fromString(account);
    verifyAddress.status = Status.NONE;
    verifyAddress.requestStatus = RequestStatus.NONE;
    verifyAddress.roles = [];
    verifyAddress.events = [];

    let verify = Verify.load(verifyContract);
    let verifyAddresses = verify.verifyAddresses;
    verifyAddresses.push(verifyAddress.id);
    verify.verifyAddresses = verifyAddresses;
    verify.save();
  }
  return verifyAddress as VerifyAddress;
}
