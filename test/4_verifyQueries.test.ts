import { expect } from "chai";
import { ethers } from "hardhat";
import { ApolloFetch, FetchResult } from "apollo-fetch";
import { ContractTransaction } from "ethers";
import { hexlify } from "ethers/lib/utils";
import * as path from "path";

import * as Util from "./utils/utils";
import {
  waitForSubgraphToBeSynced,
  getTxTimeblock,
  createChildTyped,
} from "./utils/utils";

// Artifacts
import verifyJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/verify/Verify.sol/Verify.json";

// Types
import { Verify } from "@beehiveinnovation/rain-protocol/typechain/Verify";

import {
  // Signers
  deployer,
  signer1,
  signer2,
  admin,
  // Contracts factory
  verifyFactory,
} from "./1_trustQueries.test";

const enum RequestStatus {
  NONE,
  REQUEST_APPROVE,
  REQUEST_BAN,
  REQUEST_REMOVE,
}

const enum Status {
  NONE,
  APPROVED,
  BANNED,
  REMOVED,
}

let subgraph: ApolloFetch,
  verify: Verify,
  transaction: ContractTransaction; // use to save/facilite a tx

const evidenceEmpty = hexlify([...Buffer.from("")]);
const evidenceAdd = hexlify([...Buffer.from("Evidence for add")]);
const evidenceApprove = hexlify([...Buffer.from("Evidence for approve")]);
const evidenceBan = hexlify([...Buffer.from("Evidence for ban")]);
const evidenceRemove = hexlify([...Buffer.from("Evidence for remove")]);

describe("Subgraph Tier Test", function () {
  before("connecting and deploy fresh contracts", async function () {
    const localInfoPath = path.resolve(__dirname, "./utils/local_Info.json");
    const localInfoJson = JSON.parse(Util.fetchFile(localInfoPath));

    // Connecting to the subgraph
    subgraph = Util.fetchSubgraph(
      localInfoJson.subgraphUser,
      localInfoJson.subgraphName
    );
  });

  describe("Verify Factory - Queries", function async() {
    let eventCounter = 0;
    let eventsSigner1 = 0;
    let eventsSigner2 = 0;
    it("should query VerifyFactory correctly after construction", async function () {
      // Get the verify implementation
      const implementation = (
        await Util.getEventArgs(
          verifyFactory.deployTransaction,
          "Implementation",
          verifyFactory
        )
      ).implementation;

      const query = `
        {
          verifyFactories {
            id
            address
            implementation
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const factoriesData = queryResponse.data.verifyFactories;
      const data = factoriesData[0];

      expect(factoriesData).to.have.lengthOf(1);

      expect(data.id).to.equals(verifyFactory.address.toLocaleLowerCase());
      expect(data.address).to.equals(verifyFactory.address.toLocaleLowerCase());
      expect(data.implementation).to.equals(implementation.toLocaleLowerCase());
    });

    it("should query the Verify child from factory after creation", async function () {
      verify = (await createChildTyped(verifyFactory, verifyJson, [
        admin.address,
      ])) as Verify;

      const APPROVER = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("APPROVER")
      );
      const REMOVER = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("REMOVER")
      );
      const BANNER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BANNER"));

      // Admin grants all roles to himself. This is for testing purposes only, it SHOULD be avoided.
      await verify.connect(admin).grantRole(APPROVER, admin.address);
      await verify.connect(admin).grantRole(REMOVER, admin.address);
      await verify.connect(admin).grantRole(BANNER, admin.address);

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1200);

      const query = `
        {
          verifyFactory (id: "${verifyFactory.address.toLowerCase()}") {
            children {
              id
            }
          }
        }
      `;

      const queryVerifyFactoryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryVerifyFactoryResponse.data.verifyFactory;

      expect(data.children).to.deep.include({
        id: verify.address.toLowerCase(),
      });
    });

    it("should query the Verify contract correclty", async function () {
      // Using the deployTransaction
      const [deployBlock, deployTimestamp] = await getTxTimeblock(
        verify.deployTransaction
      );

      const query = `
        {
          verify (id: "${verify.address.toLowerCase()}") {
            address
            deployBlock
            deployTimestamp
            deployer
            factory {
              id
            }
            verifyAddresses {
              id
            }
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponse.data.verify;

      expect(data.verifyAddresses).to.be.empty;
      expect(data.address).to.equals(verify.address.toLowerCase());
      expect(data.factory.id).to.equals(verifyFactory.address.toLowerCase());

      expect(data.deployer).to.equals(deployer.address.toLowerCase());
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTimestamp.toString());
    });

    it("should query the VerifyRequestApprove after a RequestApprove ", async function () {
      // signer1 want to be added
      transaction = await verify.connect(signer1).add(evidenceAdd);

      // Increase the counter by 1
      eventCounter++;
      eventsSigner1++;
      
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1500);
      console.log(eventCounter);

      const requestId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;
      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyRequestApproves {
            id
          }
          verifyRequestApprove (id: "${requestId}"){
            block
            timestamp
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const dataApproves = queryResponse.data.verifyRequestApproves;
      const data = queryResponse.data.verifyRequestApprove;

      expect(dataApproves).to.have.lengthOf(1);
      expect(dataApproves).to.deep.include({ id: requestId });

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.account).to.equals(signer1.address.toLowerCase());
      expect(data.data).to.equals(evidenceAdd);
    });

    it("should query the VerifyEvent after a RequestApprove ", async function () {
      const verifyEventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyEvents {
            id
          }
          verifyEvent (id: "${verifyEventId}") {
            block
            transactionHash
            timestamp
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const dataArray = queryResponse.data.verifyEvents;
      const data = queryResponse.data.verifyEvent;

      expect(dataArray).to.have.lengthOf(eventCounter);
      expect(dataArray).to.deep.include({ id: verifyEventId });

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.account).to.equals(signer1.address.toLowerCase());
      expect(data.data).to.equals(evidenceAdd);
    });

    it("should query the verifyAddress after RequestApprove from the Verify contract", async function () {
      const signer1Id = `${verify.address.toLowerCase()} - ${signer1.address.toLocaleLowerCase()}`;
      const verifyEventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const query = `
        {
          verify (id: "${verify.address.toLowerCase()}") {
            verifyAddresses {
              id
              requestStatus
              status
            }
          }
          verifyAddress (id: "${signer1Id}") {
            verifyContract {
              id
            }
            address
            requestStatus
            status
            events {
              id
            }
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const dataVerifyContract = queryResponse.data.verify.verifyAddresses;
      const dataVerifyAddress = queryResponse.data.verifyAddress;

      // Expected Verify contract values
      expect(dataVerifyContract).to.deep.include({
        id: signer1Id,
        requestStatus: 1,
        status: 0,
      });
      // expect(dataVerifyContract[0].id).to.equals(signer1Id); ...

      // Expected verifyAddress
      expect(dataVerifyAddress.verifyContract.id).to.equals(
        verify.address.toLowerCase()
      );
      expect(dataVerifyAddress.address).to.equals(
        signer1.address.toLocaleLowerCase()
      );

      expect(dataVerifyAddress.requestStatus).to.equals(
        RequestStatus.REQUEST_APPROVE
      );
      expect(dataVerifyAddress.status).to.equals(Status.NONE);
      expect(dataVerifyAddress.events).to.have.lengthOf(eventsSigner1);
      expect(dataVerifyAddress.events).to.deep.include({ id: verifyEventId });
    });

    it("should query the VerifyApprove after an Approve", async function () {
      // Admin approve the signer1
      transaction = await verify
        .connect(admin)
        .approve(signer1.address, evidenceApprove);

      // Increase the counter by 1
      eventCounter++;
      eventsSigner1++;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1200);
      console.log(eventCounter);

      const approveId = `${verify.address.toLowerCase()} - ${transaction.hash.toLocaleLowerCase()}`;
      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyApproves {
            id
          }
          verifyApprove (id: "${approveId}") {
            block
            timestamp
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataApproves = response.data.verifyApproves;
      const data = response.data.verifyApprove;

      expect(dataApproves).to.have.lengthOf(1);
      expect(dataApproves).to.deep.include({ id: approveId });

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(admin.address.toLowerCase());
      expect(data.account).to.equals(signer1.address.toLowerCase());
      expect(data.data).to.equals(evidenceApprove);
    });

    it("should query the VerifyEvent after an Approve ", async function () {
      const eventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyEvents {
            id
          }
          verifyEvent (id: "${eventId}") {
            block
            timestamp
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const dataEvents = queryResponse.data.verifyEvents;
      const data = queryResponse.data.verifyEvent;

      expect(dataEvents).to.have.lengthOf(eventCounter);
      expect(dataEvents).to.deep.include({ id: eventId });

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(admin.address.toLowerCase());
      expect(data.account).to.equals(signer1.address.toLowerCase());
      expect(data.data).to.equals(evidenceApprove);
    });

    it("should update the verifyAddress after Approve", async function () {
      const signer1Id = `${verify.address.toLowerCase()} - ${signer1.address.toLocaleLowerCase()}`;
      const verifyEventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const query = `
        {
          verify (id: "${verify.address.toLowerCase()}") {
            verifyAddresses {
              id
              requestStatus
              status
            }
          }
          verifyAddress (id: "${signer1Id}") {
            requestStatus
            status
            events {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataVerifyContract = response.data.verify.verifyAddresses;
      const data = response.data.verifyAddress;

      // Expected Verify contract values
      expect(dataVerifyContract).to.deep.include({
        id: signer1Id,
        requestStatus: 0,
        status: 1,
      });

      // Expected VerifyAddress values
      expect(data.requestStatus).to.equals(RequestStatus.NONE);
      expect(data.status).to.equals(Status.APPROVED);

      expect(data.events).to.have.lengthOf(eventsSigner1);
      expect(data.events).to.deep.include({ id: verifyEventId });
    });

    it("should query the VerifyRequestRemove after a RequestRemove", async function () {
      // signer2 requestAdd and admin approve
      await verify.connect(signer2).add(evidenceEmpty);
      await verify.connect(admin).approve(signer2.address, evidenceApprove);

      // This create 2 new verifyEvents that were already called
      // Then, increase the counter by 2
      eventCounter += 2;
      eventsSigner2 += 2;

      // signer1 requests that signer2 be removed
      transaction = await verify
        .connect(signer1)
        .requestRemove(signer2.address, evidenceRemove);
      // Increase the counter by 1
      eventCounter++;

      // Both are involved
      eventsSigner1++;
      eventsSigner2++;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1500);
      console.log(eventCounter);

      const requestRemoveId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;
      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyRequestRemove (id: "${requestRemoveId}") {
            block
            timestamp
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.verifyRequestRemove;

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.account).to.equals(signer2.address.toLowerCase());
      expect(data.data).to.equals(evidenceRemove);
    });

    it("should query the VerifyEvent after a RequestRemove ", async function () {
      const eventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyEvents {
            id
          }
          verifyEvent (id: "${eventId}") {
            block
            timestamp
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const dataEvents = queryResponse.data.verifyEvents;
      const data = queryResponse.data.verifyEvent;

      expect(dataEvents).to.have.lengthOf(eventCounter);
      expect(dataEvents).to.deep.include({ id: eventId });

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.account).to.equals(signer2.address.toLowerCase());
      expect(data.data).to.equals(evidenceRemove);
    });

    it("should update the verifyAddress that has a RequestRemove", async function () {
      const signer2Id = `${verify.address.toLowerCase()} - ${signer2.address.toLowerCase()}`;
      const verifyEventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const query = `
        {
          verify (id: "${verify.address.toLowerCase()}") {
            verifyAddresses {
              id
              requestStatus
              status
            }
          }
          verifyAddress (id: "${signer2Id}") {
            requestStatus
            status
            events {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataVerifyContract = response.data.verify.verifyAddresses;
      const data = response.data.verifyAddress;

      // Expected Verify contract values
      expect(dataVerifyContract).to.deep.include({
        id: signer2Id,
        requestStatus: 3,
        status: 1,
      });

      // Expected VerifyAddress values
      expect(data.requestStatus).to.equals(RequestStatus.REQUEST_REMOVE);
      expect(data.status).to.equals(Status.APPROVED);

      expect(data.events).to.have.lengthOf(eventsSigner2); // requestApprove, Approve and requestRemove
      expect(data.events).to.deep.include({ id: verifyEventId });
    });

    it("should update the verifyAddress that call RequestRemove", async function () {
      const signer1Id = `${verify.address.toLowerCase()} - ${signer1.address.toLocaleLowerCase()}`;
      const verifyEventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1500);
      const query = `
        {
          verifyAddress (id: "${signer1Id}") {
            events {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.verifyAddress;

      // Expected VerifyAddress values
      console.log("events : ", JSON.stringify(data))
      expect(data.events).to.have.lengthOf(eventsSigner1); // requestApprove, Approve and requestRemove
      expect(data.events).to.deep.include({ id: verifyEventId });
    });

    it("should query the VerifyRemove after a Remove", async function () {
      // Admin remove the signer2
      transaction = await verify
        .connect(admin)
        .remove(signer2.address, evidenceRemove);

      // Increase the counter by 1
      eventCounter++;
      eventsSigner2++;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1200);
      console.log(eventCounter);

      const removeId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;
      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyRemove (id: "${removeId}") {
            block
            timestamp
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.verifyRemove;

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(admin.address.toLowerCase());
      expect(data.account).to.equals(signer2.address.toLowerCase());
      expect(data.data).to.equals(evidenceRemove);
    });

    it("should query the VerifyEvent after a Remove ", async function () {
      const eventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyEvents {
            id
          }
          verifyEvent (id: "${eventId}") {
            block
            timestamp
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const dataEvents = queryResponse.data.verifyEvents;
      const data = queryResponse.data.verifyEvent;

      expect(dataEvents).to.have.lengthOf(eventCounter);
      expect(dataEvents).to.deep.include({ id: eventId });

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(admin.address.toLowerCase());
      expect(data.account).to.equals(signer2.address.toLowerCase());
      expect(data.data).to.equals(evidenceRemove);
    });

    it("should update the verifyAddress that has been Remove", async function () {
      const signer2Id = `${verify.address.toLowerCase()} - ${signer2.address.toLocaleLowerCase()}`;
      const verifyEventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const query = `
        {
          verify (id: "${verify.address.toLowerCase()}") {
            verifyAddresses {
              id
              requestStatus
              status
            }
          }
          verifyAddress (id: "${signer2Id}") {
            requestStatus
            status
            events {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataVerifyContract = response.data.verify.verifyAddresses;
      const data = response.data.verifyAddress;

      // Expected Verify contract values
      expect(dataVerifyContract).to.deep.include({
        id: signer2Id,
        requestStatus: 0,
        status: 3,
      });

      expect(data.requestStatus).to.equals(RequestStatus.NONE);
      expect(data.status).to.equals(Status.REMOVED);

      expect(data.events).to.have.lengthOf(eventsSigner1);
      expect(data.events).to.deep.include({ id: verifyEventId });
    });

    it("should query the VerifyRequestBan after a RequestBan", async function () {
      // signer2 request to be added again and admin approve
      await verify.connect(signer2).add(evidenceEmpty);
      await verify.connect(admin).approve(signer2.address, evidenceEmpty);
      // Then, increase the counter by 2
      eventCounter += 2;
      eventsSigner2++;

      // signer1 request signer2 to be banned
      transaction = await verify
        .connect(signer1)
        .requestBan(signer2.address, evidenceBan);

      // Increase the counter by 1
      eventCounter++;

      // Both are involved
      eventsSigner1++;
      eventsSigner2++;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1300);
      console.log(eventCounter);

      const requestBanId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;
      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyRequestBan (id: "${requestBanId}") {
            block
            timestamp
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.verifyRequestBan;

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.account).to.equals(signer2.address.toLowerCase());
      expect(data.data).to.equals(evidenceBan);
    });

    it("should query the VerifyEvent after a RequestBan ", async function () {
      const eventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyEvents {
            id
          }
          verifyEvent (id: "${eventId}") {
            block
            timestamp
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const dataEvents = queryResponse.data.verifyEvents;
      const data = queryResponse.data.verifyEvent;

      expect(dataEvents).to.have.lengthOf(eventCounter);
      expect(dataEvents).to.deep.include({ id: eventId });

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.account).to.equals(signer2.address.toLowerCase());
      expect(data.data).to.equals(evidenceBan);
    });

    it("should update the verifyAddress that has a RequestBan", async function () {
      const signer2Id = `${verify.address.toLowerCase()} - ${signer2.address.toLocaleLowerCase()}`;
      const verifyEventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const query = `
        {
          verifyAddress (id: "${signer2Id}") {
            requestStatus
            status
            events {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.verifyAddress;

      expect(data.requestStatus).to.equals(RequestStatus.REQUEST_BAN);
      expect(data.status).to.equals(Status.APPROVED);

      expect(data.events).to.have.lengthOf(eventsSigner2);
      expect(data.events).to.deep.include({ id: verifyEventId });
    });

    it("should update the verifyAddress that call RequestBan", async function () {
      const signer1Id = `${verify.address.toLowerCase()} - ${signer1.address.toLocaleLowerCase()}`;
      const verifyEventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const query = `
        {
          verifyAddress (id: "${signer1Id}") {
            events {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.verifyAddress;

      // Expected VerifyAddress values
      expect(data.events).to.have.lengthOf(eventsSigner1);
      expect(data.events).to.deep.include({ id: verifyEventId });
    });

    it("should query the VerifyBan after a Ban", async function () {
      // Admin ban the signer2
      transaction = await verify
        .connect(admin)
        .ban(signer2.address, evidenceBan);

      // Increase the counter by 1
      eventCounter++;
      eventsSigner2++;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1200);
      console.log(eventCounter);

      const banId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;
      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyBan (id: "${banId}") {
            block
            timestamp
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const data = response.data.verifyBan;

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(admin.address.toLowerCase());
      expect(data.account).to.equals(signer2.address.toLowerCase());
      expect(data.data).to.equals(evidenceBan);
    });

    it("should query the VerifyEvent after a Ban ", async function () {
      const eventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const [eventBlock, eventTimestamp] = await getTxTimeblock(transaction);

      const query = `
        {
          verifyEvents {
            id
          }
          verifyEvent (id: "${eventId}") {
            block
            timestamp
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const dataEvents = queryResponse.data.verifyEvents;
      const data = queryResponse.data.verifyEvent;

      expect(dataEvents).to.have.lengthOf(eventCounter);
      expect(dataEvents).to.deep.include({ id: eventId });

      expect(data.block).to.equals(eventBlock.toString());
      expect(data.timestamp).to.equals(eventTimestamp.toString());
      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());

      expect(data.verifyContract).to.equals(verify.address.toLowerCase());
      expect(data.sender).to.equals(admin.address.toLowerCase());
      expect(data.account).to.equals(signer2.address.toLowerCase());
      expect(data.data).to.equals(evidenceBan);
    });

    it("should update the verifyAddress that has been Banned", async function () {
      const signer2Id = `${verify.address.toLowerCase()} - ${signer2.address.toLocaleLowerCase()}`;
      const verifyEventId = `${verify.address.toLowerCase()} - ${transaction.hash.toLowerCase()}`;

      const query = `
        {
          verify (id: "${verify.address.toLowerCase()}") {
            verifyAddresses {
              id
              requestStatus
              status
            }
          }
          verifyAddress (id: "${signer2Id}") {
            requestStatus
            status
            events {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataVerifyContract = response.data.verify.verifyAddresses;
      const data = response.data.verifyAddress;

      // Expected Verify contract values
      expect(dataVerifyContract).to.deep.include({
        id: signer2Id,
        requestStatus: 0,
        status: 2,
      });

      expect(data.requestStatus).to.equals(RequestStatus.NONE);
      expect(data.status).to.equals(Status.BANNED);

      expect(data.events).to.have.lengthOf(eventsSigner2);
      expect(data.events).to.deep.include({ id: verifyEventId });
    });
  });
});
