/* eslint-disable node/no-missing-import */
/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */

import { expect } from "chai";
import { ethers } from "hardhat";
import { ApolloFetch, FetchResult } from "apollo-fetch";
import { BigNumber, ContractTransaction } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { hexlify, concat } from "ethers/lib/utils";
import * as path from "path";

import * as Util from "./utils/utils";
import {
  op,
  deploy,
  getContract,
  getContractChild,
  waitForSubgraphToBeSynced,
  eighteenZeros,
  sixZeros,
  zeroAddress,
  Tier,
  VMState,
} from "./utils/utils";

// Artifacts
import reserveToken from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveToken.sol/ReserveToken.json";
import reserveNFTJson from "@vishalkale15107/rain-protocol/artifacts/contracts/test/ReserveNFT.sol/ReserveNFT.json";
import trustFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/trust/TrustFactory.sol/TrustFactory.json";
import erc20BalanceTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20BalanceTierFactory.sol/ERC20BalanceTierFactory.json";
import erc20TransferTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20TransferTierFactory.sol/ERC20TransferTierFactory.json";
import combineTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/CombineTierFactory.sol/CombineTierFactory.json";
import verifyTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/VerifyTierFactory.sol/VerifyTierFactory.json";
import verifyFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/verify/VerifyFactory.sol/VerifyFactory.json";

import erc20BalanceTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20BalanceTier.sol/ERC20BalanceTier.json";
import erc20TransferTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20TransferTier.sol/ERC20TransferTier.json";
import combineTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/CombineTier.sol/CombineTier.json";
import verifyTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/VerifyTier.sol/VerifyTier.json";
import verifyJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/verify/Verify.sol/Verify.json";

// Types
import { ReserveToken } from "@beehiveinnovation/rain-protocol/typechain/ReserveToken";
import { ReserveNFT } from "@vishalkale15107/rain-protocol/typechain/ReserveNFT";
import { BFactory } from "@beehiveinnovation/rain-protocol/typechain/BFactory";
import { CRPFactory } from "@beehiveinnovation/rain-protocol/typechain/CRPFactory";
import { TrustFactory } from "@beehiveinnovation/rain-protocol/typechain/TrustFactory";
import { ERC20BalanceTierFactory } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTierFactory";
import { ERC20TransferTierFactory } from "@beehiveinnovation/rain-protocol/typechain/ERC20TransferTierFactory";
import { CombineTierFactory } from "@beehiveinnovation/rain-protocol/typechain/CombineTierFactory";
import { VerifyTierFactory } from "@beehiveinnovation/rain-protocol/typechain/VerifyTierFactory";
import { VerifyFactory } from "@beehiveinnovation/rain-protocol/typechain/VerifyFactory";

import { Trust } from "@beehiveinnovation/rain-protocol/typechain/Trust";
import { ERC20BalanceTier } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTier";
import { ERC20TransferTier } from "@beehiveinnovation/rain-protocol/typechain/ERC20TransferTier";
import { CombineTier } from "@beehiveinnovation/rain-protocol/typechain/CombineTier";
import { VerifyTier } from "@beehiveinnovation/rain-protocol/typechain/VerifyTier";
import { Verify } from "@beehiveinnovation/rain-protocol/typechain/Verify";

// Should update path after a new commit
import erc721BalanceTierFactoryJson from "@vishalkale15107/rain-protocol/artifacts/contracts/tier/ERC721BalanceTierFactory.sol/ERC721BalanceTierFactory.json";
import erc721BalanceTierJson from "@vishalkale15107/rain-protocol/artifacts/contracts/tier/ERC721BalanceTier.sol/ERC721BalanceTier.json";
import { ERC721BalanceTierFactory } from "@vishalkale15107/rain-protocol/typechain/ERC721BalanceTierFactory";
import { ERC721BalanceTier } from "@vishalkale15107/rain-protocol/typechain/ERC721BalanceTier";

import {
  getContracts,
  getFactories,
  getTrust,
  NOTICE_QUERY,
  QUERY,
} from "./utils/queries";

import {
  // Signers
  deployer,
  creator,
  seeder1,
  seeder2,
  signer1,
  signer2,
  admin,
  // Contracts factories
  trustFactory,
  verifyFactory,
  verifyTierFactory,
  erc20BalanceTierFactory,
  erc20TransferTierFactory,
  combineTierFactory,
  erc721BalanceTierFactory,
} from "./1_trustQueries.test";

const enum Status {
  Nil,
  Added,
  Approved,
  Banned,
}

const enum Opcode {
  END,
  VAL,
  DUP,
  ZIPMAP,
  BLOCK_NUMBER,
  BLOCK_TIMESTAMP,
  REPORT,
  NEVER,
  ALWAYS,
  DIFF,
  UPDATE_BLOCKS_FOR_TIER_RANGE,
  SELECT_LTE,
  ACCOUNT,
}

const LEVELS = Array.from(Array(8).keys()).map((value) =>
  ethers.BigNumber.from(++value + eighteenZeros).toString()
); // [1,2,3,4,5,6,7,8]

let subgraph: ApolloFetch,
  trust: Trust,
  reserve: ReserveToken,
  reserveNFT: ReserveNFT,
  verifyTier: VerifyTier,
  verify: Verify,
  combineTier: CombineTier,
  erc721BalanceTier: ERC721BalanceTier,
  transaction: ContractTransaction; // use to save/facilite a tx

describe("Subgraph Tier Test", function () {
  // TODO: Add test to tier contracts that are not indexed by the subgraph but are present
  // in other contracts like trusts or sales

  before("connecting and deploy fresh contracts", async function () {
    reserve = (await deploy(reserveToken, deployer, [])) as ReserveToken;
    reserveNFT = (await deploy(reserveNFTJson, deployer, [])) as ReserveNFT;

    const localInfoPath = path.resolve(__dirname, "./utils/local_Info.json");
    const localInfoJson = JSON.parse(Util.fetchFile(localInfoPath));

    // Connecting to the subgraph
    subgraph = Util.fetchSubgraph(
      localInfoJson.subgraphUser,
      localInfoJson.subgraphName
    );
  });

  describe("Verify Factory - Queries", function async() {
    const evidenceEmpty = hexlify([...Buffer.from("")]);
    const evidenceAdd = hexlify([...Buffer.from("Evidence for add")]);
    const evidenceApprove = hexlify([...Buffer.from("Evidence for approve")]);
    const evidenceBan = hexlify([...Buffer.from("Evidence for ban")]);

    it("should query VerifyFactory correctly after construction", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);
      const query = `
        {
          verifyFactory (id: "${verifyFactory.address.toLowerCase()}") {
            address
            children {
              id
            }
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const factoryData = queryResponse.data.verifyFactory;

      expect(factoryData.address).to.equals(
        verifyFactory.address.toLowerCase()
      );
      expect(factoryData.children).to.be.empty;
    });

    it("should query the Verify child from factory after creation", async function () {
      const verifyCreator = await verifyFactory.signer.getAddress();

      const tx = await verifyFactory.createChildTyped(admin.address);

      verify = (await getContractChild(
        tx,
        verifyFactory,
        verifyJson
      )) as Verify;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          verifyFactory (id: "${verifyFactory.address.toLowerCase()}") {
            children {
              id
              deployer
            }
          }
        }
      `;

      const queryVerifyFactoryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const factoryData = queryVerifyFactoryResponse.data.verifyFactory;
      const verifyData = factoryData.children[0];

      expect(factoryData.children).to.have.lengthOf(1);
      expect(verifyData.id).to.equals(verify.address.toLowerCase());
      expect(verifyData.deployer).to.equals(verifyCreator.toLowerCase());
    });

    it("should query a Verify event after a RequestApprove ", async function () {
      const tx = await verify.connect(signer1).add(evidenceAdd);

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const verifyEventQuery = `
        {
          verifyEvent (id: "${verify.address.toLowerCase()}-${tx.hash.toLowerCase()}") {
            transactionHash
            verifyContract
            sender
            account
            data
          }
          verifyRequestApprove (id: "${verify.address.toLowerCase()}-${tx.hash.toLowerCase()}") {
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const verifyEventQueryResponse = (await subgraph({
        query: verifyEventQuery,
      })) as FetchResult;

      const verifyEventData = verifyEventQueryResponse.data.verifyEvent;
      const verifyRequestApproveData =
        verifyEventQueryResponse.data.verifyRequestApprove;

      // VerifyEvent
      expect(verifyEventData.verifyContract).to.equals(
        verify.address.toLowerCase()
      );
      expect(verifyEventData.transactionHash).to.equals(tx.hash.toLowerCase());
      expect(verifyEventData.sender).to.equals(signer1.address.toLowerCase());
      expect(verifyEventData.account).to.equals(signer1.address.toLowerCase());
      expect(verifyEventData.data).to.equals(evidenceAdd);

      // VerifyRequestApprove
      expect(verifyRequestApproveData.transactionHash).to.equals(
        tx.hash.toLowerCase()
      );
      expect(verifyRequestApproveData.sender).to.equals(
        signer1.address.toLowerCase()
      );
      expect(verifyRequestApproveData.account).to.equals(
        signer1.address.toLowerCase()
      );
      expect(verifyRequestApproveData.data).to.equals(evidenceAdd);
    });

    it("should query the verifyAddresses after RequestApprove from Verify contract correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const verifyQuery = `
        {
          verify (id: "${verify.address.toLowerCase()}") {
            verifyAddresses
          }
        }
      `;

      const verifyQueryResponse = (await subgraph({
        query: verifyQuery,
      })) as FetchResult;

      const verifyData = verifyQueryResponse.data.verify;

      expect(verifyData.verifyAddresses).to.be.empty;
    });

    it("should query the correct Verify event after two Approves", async function () {
      const tx = await verify
        .connect(admin)
        .approve(signer1.address, evidenceApprove);

      // Second account to approve
      await verify.connect(signer2).add(evidenceAdd);
      await verify.connect(admin).approve(signer2.address, evidenceApprove);

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const verifyApproveQuery = `
        {
          verifyApproves {
            id
          }
          verifyApprove (id: "${verify.address.toLowerCase()}-${tx.hash.toLowerCase()}") {
            transactionHash
            verifyContract
            sender
            account
            data
          }
        }
      `;

      const verifyApproveQueryResponse = (await subgraph({
        query: verifyApproveQuery,
      })) as FetchResult;

      const verifyApproveData = verifyApproveQueryResponse.data.verifyApprove;
      const verifyApprovesData = verifyApproveQueryResponse.data.verifyApproves;

      expect(verifyApprovesData).to.have.lengthOf(2);
      expect(verifyApproveData.transactionHash).to.equals(
        tx.hash.toLowerCase()
      );
      expect(verifyApproveData.sender).to.equals(admin.address.toLowerCase());
      expect(verifyApproveData.account).to.equals(
        signer1.address.toLowerCase()
      );
      expect(verifyApproveData.data).to.equals(evidenceApprove);
    });

    it("should update the verifyAddresses after Approves", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const addresses = [signer1.address, signer2.address];

      const verifyQuery = `
        {
          verify (id: "${verify.address.toLowerCase()}") {
            verifyAddresses
          }
        }
      `;

      const verifyQueryResponse = (await subgraph({
        query: verifyQuery,
      })) as FetchResult;

      const verifyData = verifyQueryResponse.data.verify;

      expect(verifyData.verifyAddresses).to.have.lengthOf(2);
      expect(verifyData.verifyAddresses).to.have.members(addresses);
    });

    it("should query the Verify events after ban", async function () {
      const txRequestBan = await verify
        .connect(signer1)
        .requestBan(signer2.address, evidenceBan);
      const txBan = await verify
        .connect(signer1)
        .ban(signer2.address, evidenceBan);

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const verifyEventsQuery = `
        {
          verifyRequestBan (id: "${verify.address.toLowerCase()}-${txRequestBan.hash.toLowerCase()}") {
            sender
            account
            data
          }
          verifyBan (id: "${verify.address.toLowerCase()}-${txBan.hash.toLowerCase()}") {
            sender
            account
            data
          }
        }
      `;

      const verifyEventsQueryResponse = (await subgraph({
        query: verifyEventsQuery,
      })) as FetchResult;

      const requestBanData = verifyEventsQueryResponse.data.VerifyRequestBan;
      const banData = verifyEventsQueryResponse.data.VerifyBan;

      // verifyRequestBan
      expect(requestBanData.sender).to.equals(signer1.address.toLowerCase());
      expect(requestBanData.account).to.equals(signer2.address.toLowerCase());
      expect(requestBanData.data).to.equals(evidenceBan);

      // verifyBan
      expect(banData.sender).to.equals(signer1.address.toLowerCase());
      expect(banData.account).to.equals(signer2.address.toLowerCase());
      expect(banData.data).to.equals(evidenceBan);
    });

    it("should query the Verify events after remove", async function () {
      const txRequestRemove = await verify
        .connect(signer1)
        .requestRemove(signer1.address, evidenceEmpty);
      const txRemove = await verify
        .connect(signer1)
        .remove(signer1.address, evidenceEmpty);

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const verifyEventsQuery = `
        {
          VerifyRequestRemove (id: "${verify.address.toLowerCase()}-${txRequestRemove.hash.toLowerCase()}") {
            sender
            account
            data
          }
          VerifyRemove (id: "${verify.address.toLowerCase()}-${txRemove.hash.toLowerCase()}") {
            sender
            account
            data
          }
        }
      `;

      const verifyEventsQueryResponse = (await subgraph({
        query: verifyEventsQuery,
      })) as FetchResult;

      const requestRemoveData =
        verifyEventsQueryResponse.data.VerifyRequestRemove;
      const RemoveData = verifyEventsQueryResponse.data.VerifyRemove;

      // verifyRequestBan
      expect(requestRemoveData.sender).to.equals(signer1.address.toLowerCase());
      expect(requestRemoveData.account).to.equals(
        signer1.address.toLowerCase()
      );
      expect(requestRemoveData.data).to.equals(evidenceEmpty);

      // verifyBan
      expect(RemoveData.sender).to.equals(signer1.address.toLowerCase());
      expect(RemoveData.account).to.equals(signer1.address.toLowerCase());
      expect(RemoveData.data).to.equals(evidenceEmpty);
    });

    it("should update the verifyAddresses after remove/ban", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const verifyQuery = `
        {
          verify (id: "${verify.address.toLowerCase()}") {
            verifyAddresses
          }
        }
      `;

      const verifyQueryResponse = (await subgraph({
        query: verifyQuery,
      })) as FetchResult;

      const verifyData = verifyQueryResponse.data.verify;

      expect(verifyData.verifyAddresses).to.have.lengthOf(0);
    });
  });

  describe("VerifyTier Factory - Queries", function () {
    it("should query VerifyTierFactory correctly after construction", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          verifyTierFactory (id: "${verifyTierFactory.address.toLowerCase()}") {
            address
            children {
              id
            }
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const factoryData = queryResponse.data.verifyTierFactory;

      expect(factoryData.address).to.equals(
        verifyTierFactory.address.toLowerCase()
      );
      expect(factoryData.children).to.be.empty;
    });

    it("should query the VerifyTier child from factory after creation", async function () {
      const verifyTierCreator = await verifyTierFactory.signer.getAddress();

      // Creating new Verify
      const txVerify = await verifyFactory.createChildTyped(admin.address);

      verify = (await getContractChild(
        txVerify,
        verifyFactory,
        verifyJson
      )) as Verify;

      // Creating the VerifyTier Contract with a Verify Contract
      const txVerifyTier = await verifyTierFactory.createChildTyped(
        verify.address
      );

      verifyTier = (await getContractChild(
        txVerifyTier,
        verifyTierFactory,
        verifyTierJson
      )) as VerifyTier;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          verifyTierFactory  (id: "${verifyTierFactory.address.toLowerCase()}") {
            address
            children {
              id
              deployer
            }
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const factoryData = queryResponse.data.verifyFactory;
      const verifyTierData = factoryData.children[0];

      expect(factoryData.children).to.have.lengthOf(1);
      expect(verifyTierData.id).to.equals(verifyTier.address.toLowerCase());
      expect(verifyTierData.deployer).to.equals(
        await verifyTierCreator.toLowerCase()
      );
    });

    it("should query the VerifyContract from VerifyTier correclty", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            verifyContract {
              id
              factory
              verifyAddresses
            }
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const verifyData = queryResponse.data.verifyTier.verifyContract;

      expect(verifyData.id).to.equals(verify.address.toLowerCase());
      expect(verifyData.factory).to.equals(verifyFactory.address.toLowerCase());
      expect(verifyData.verifyAddresses).to.be.empty;
    });

    it("should query a Verify that was deployed without the factory and present in VerifyTier", async function () {
      // Verify deployed without factory
      const verifyIndependent = (await deploy(
        verifyJson,
        deployer,
        []
      )) as Verify;

      await verifyIndependent.initialize(admin.address);

      const tx = await verifyTierFactory.createChildTyped(
        verifyIndependent.address
      );

      const verifyTier2 = (await getContractChild(
        tx,
        verifyTierFactory,
        verifyTierJson
      )) as VerifyTier;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const verifyTiersQuery = `
        {
          verifyTierFactory  (id: "${verifyTierFactory.address.toLowerCase()}") {
            children {
              id
            }
          }
          verifyTier (id: "${verifyTier2.address.toLowerCase()}") {
            address
            verifyContract {
              address
            }
          }
        }
      `;

      const verifyTiersQueryResponse = (await subgraph({
        query: verifyTiersQuery,
      })) as FetchResult;

      const verifyTierFactoryData =
        verifyTiersQueryResponse.data.verifyTierFactory;
      const verifyTierData = verifyTiersQueryResponse.data.verifyTier;

      expect(verifyTierFactoryData.children).to.have.lengthOf(2);
      expect(verifyTierData.address).to.equals(
        verifyTier2.address.toLowerCase()
      );
      // confirm this
      expect(verifyTierData.verifyContract).to.equals(
        verifyIndependent.address.toLowerCase()
      );
    });
  });

  describe("ERC20BalanceTier Factory - Queries", function () {
    let erc20BalanceTier: ERC20BalanceTier;

    it("should query ERC20BalanceTierFactory correctly after construction", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          erc20BalanceTierFactory  (id: "${erc20BalanceTierFactory.address.toLowerCase()}") {
            address
            children {
              id
            }
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const TierFactoryData = queryResponse.data.erc20BalanceTierFactory;

      expect(TierFactoryData.address).to.equals(
        erc20BalanceTierFactory.address.toLowerCase()
      );
      expect(TierFactoryData.children).to.be.empty;
    });

    it("should query the ERC20BalanceTier child from factory after creation", async function () {
      transaction = await erc20BalanceTierFactory.createChildTyped({
        erc20: reserve.address,
        tierValues: LEVELS,
      });

      erc20BalanceTier = (await getContractChild(
        transaction,
        erc20BalanceTierFactory,
        erc20BalanceTierJson
      )) as ERC20BalanceTier;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          erc20BalanceTierFactory  (id: "${erc20BalanceTierFactory.address.toLowerCase()}") {
            address
            children {
              id
            }
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const factoryData = queryResponse.data.erc20BalanceTierFactory;
      const erc20BalanceTierData = factoryData.children[0];

      expect(factoryData.children).to.have.lengthOf(1);
      expect(erc20BalanceTierData.id).to.equals(
        erc20BalanceTier.address.toLowerCase()
      );
    });

    it("should query the ERC20BalanceTier correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      // The address that made the tx where BalanceTier contract was created
      const balanceTierCreator = transaction.from.toLocaleLowerCase();

      const tierQuery = `
        {
          erc20BalanceTier   (id: "${erc20BalanceTier.address.toLowerCase()}") {
            address
            deployBlock
            deployTimestamp
            deployer
            tierValues
            factory {
              address
            }
            token {
              id
            }
          }
        }
      `;

      const queryTierresponse = (await subgraph({
        query: tierQuery,
      })) as FetchResult;
      const tierData = queryTierresponse.data.erc20BalanceTier;
      const tokenData = tierData.token;

      expect(tierData.factory.address).to.equals(
        erc20BalanceTierFactory.address.toLowerCase()
      );
      expect(tierData.address).to.equals(
        erc20BalanceTier.address.toLowerCase()
      );
      expect(tierData.tierValues).to.eql(LEVELS);
      expect(tokenData.name).to.equals(reserve.address.toLowerCase());
    });

    it("should query the ERC20 token from tier contract correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const tierQuery = `
        {
          erc20BalanceTier   (id: "${erc20BalanceTier.address.toLowerCase()}") {
            address
            tierValues
            factory {
              address
            }
            token {
              symbol
              totalSupply
              decimals
              name
            }
          }
        }
      `;

      const queryTierresponse = (await subgraph({
        query: tierQuery,
      })) as FetchResult;
      const tierData = queryTierresponse.data.erc20BalanceTier;
      const tokenData = tierData.token;

      expect(tierData.factory.address).to.equals(
        erc20BalanceTierFactory.address.toLowerCase()
      );
      expect(tierData.address).to.equals(
        erc20BalanceTier.address.toLowerCase()
      );
      expect(tierData.tierValues).to.eql(LEVELS);

      expect(tokenData.name).to.equals(await reserve.name());
      expect(tokenData.symbol).to.equals(await reserve.symbol());
      expect(tokenData.decimals).to.equals(await reserve.decimals());
      expect(tokenData.totalSupply).to.equals(await reserve.totalSupply());
    });
  });

  describe("ERC20TransferTier Factory - Queries", function () {
    let erc20TransferTier: ERC20TransferTier;

    it("should query ERC20TransferTierFactory correctly after construction", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const tierFactoriesQuery = `
        {
          tierFactory  (id: "${erc20TransferTierFactory.address.toLowerCase()}") {
            address
            children {
              id
            }
          }
        }
      `;

      const queryTierFactoriesresponse = (await subgraph({
        query: tierFactoriesQuery,
      })) as FetchResult;

      const TierFactoryData = queryTierFactoriesresponse.data.tierFactory;

      expect(TierFactoryData.address).to.equals(
        erc20BalanceTierFactory.address.toLowerCase()
      );

      expect(TierFactoryData.children).to.be.empty;
    });

    it("should query the ERC20TransferTier child from factory after creation", async function () {
      const tierCreator = erc20TransferTierFactory.signer;
      const tx = await erc20TransferTierFactory.createChildTyped({
        erc20: reserve.address,
        tierValues: LEVELS,
      });

      erc20TransferTier = (await getContractChild(
        tx,
        erc20TransferTierFactory,
        erc20TransferTierJson
      )) as ERC20TransferTier;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const tierFactoryQuery = `
        {
          tierFactory  (id: "${erc20TransferTierFactory.address.toLowerCase()}") {
            address
            children {
              id
              deployer
            }
          }
        }
      `;

      const queryTierFactoryResponse = (await subgraph({
        query: tierFactoryQuery,
      })) as FetchResult;

      const TierFactoryData = queryTierFactoryResponse.data.tierFactory;
      const erc20TransferTierData = TierFactoryData.children[0];

      expect(TierFactoryData.children).to.have.lengthOf(1);
      expect(erc20TransferTierData.id).to.equals(
        erc20TransferTier.address.toLowerCase()
      );
      expect(erc20TransferTierData.deployer).to.equals(
        (await tierCreator.getAddress()).toLowerCase()
      );
    });

    it("should query the ERC20TransferTier correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const tierQuery = `
        {
          erc20TransferTier   (id: "${erc20TransferTier.address.toLowerCase()}") {
            address
            tierValues
            factory {
              address
            }
            token {
              id
            }
          }
        }
      `;

      const queryTierResponse = (await subgraph({
        query: tierQuery,
      })) as FetchResult;
      const tierData = queryTierResponse.data.erc20TransferTier;

      expect(tierData.factory.address).to.equals(
        erc20BalanceTierFactory.address.toLowerCase()
      );
      expect(tierData.address).to.equals(
        erc20TransferTier.address.toLowerCase()
      );
      expect(tierData.tierValues).to.eql(LEVELS);
      expect(tierData.token.name).to.equals(reserve.address.toLowerCase());
    });

    it("should query the Tier Change after upgrade with setTier correctly", async function () {
      const requiredTierFive = LEVELS[4];

      const signers = await ethers.getSigners();
      const beneficiator = signers[8];
      const beneficiary = signers[9];

      // give to signer1 the exact amount for Tier FIVE
      await reserve.transfer(beneficiator.address, requiredTierFive);

      // set the tier FIVE
      await reserve
        .connect(beneficiator)
        .approve(erc20TransferTier.address, requiredTierFive);

      const tx = await erc20TransferTier
        .connect(beneficiator)
        .setTier(beneficiary.address, Tier.FIVE, []);

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const TierContractQuery = `
        {
          erc20TransferTier (id: "${erc20TransferTier.address.toLowerCase()}") {
            address
            tierChanges {
              transactionHash
              sender
              account
              startTier
              endTier
            }
          }
        }
      `;

      const queryTierFactoriesresponse = (await subgraph({
        query: TierContractQuery,
      })) as FetchResult;

      const TierContractData =
        queryTierFactoriesresponse.data.erc20TransferTier;
      const tierChange =
        queryTierFactoriesresponse.data.erc20TransferTier.tierChanges[0];

      expect(TierContractData.address).to.equals(
        erc20TransferTier.address.toLowerCase()
      );
      expect(TierContractData.tierChanges).to.have.lengthOf(1);
      expect(tierChange.sender).to.equals(beneficiator.address.toLowerCase());
      expect(tierChange.account).to.equals(beneficiary.address.toLowerCase());
      expect(tierChange.startTier).to.equals(Tier.ZERO);
      expect(tierChange.endTier).to.equals(Tier.FIVE);
      expect(tierChange.transactionHash).to.equals(tx.hash.toLowerCase());
    });

    it("should query a level with members correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const Level = Tier.FIVE;

      const tierLevelQuery = `
        {
          tierLevel (id: "${erc20TransferTier.address.toLowerCase()}-${Level}") {
            tierLevel
            tierContractAddress
            memberCount
          }
        }
      `;

      const tierLevelQueryResponse = (await subgraph({
        query: tierLevelQuery,
      })) as FetchResult;

      const TierLevelData = tierLevelQueryResponse.data.tierLevel;

      expect(TierLevelData.tierContractAddress).to.equals(
        erc20TransferTier.address.toLocaleLowerCase
      );
      expect(TierLevelData.tierLevel).to.equals(Level);
      expect(TierLevelData.memberCount).to.equals(1);
    });

    it("should query a level without members correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const Level = Tier.ONE;

      const tierLevelQuery = `
        {
          tierLevel (id: "${erc20TransferTier.address.toLowerCase()}-${Level}") {
            tierLevel
            tierContractAddress
            memberCount
          }
        }
      `;

      const tierLevelQueryResponse = (await subgraph({
        query: tierLevelQuery,
      })) as FetchResult;

      const TierLevelData = tierLevelQueryResponse.data.tierLevel;

      expect(TierLevelData.tierContractAddress).to.be.null;
      expect(TierLevelData.tierLevel).to.be.null;
      expect(TierLevelData.memberCount).to.be.null;
      /**
       * Im not sure if this entity will be null until it is created with TierChange event.
       * If that it is the case, will be null
       * else, the address and level should be query correclty and the memberCount will be 0
       */

      // expect(TierLevelData.tierContractAddress).to.equals(
      //   erc20TransferTier.address.toLocaleLowerCase
      // );
      // expect(TierLevelData.tierLevel).to.equals(Level);
      // expect(TierLevelData.memberCount).to.equals(0);
    });

    it("should query the Tier change after downgrade with setTier correclty", async function () {
      const tierContractAddress = erc20TransferTier.address.toLowerCase();

      const signers = await ethers.getSigners();
      const tierOwner = signers[9];

      const tx = await erc20TransferTier
        .connect(tierOwner)
        .setTier(tierOwner.address, Tier.FOUR, []);

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const tierChangeQuery = `
        {
          tierChange  (id: "${tx.hash.toLowerCase()}-${tierContractAddress}") {
            transactionHash
            sender
            account
            startTier
            endTier
          }
        }
      `;

      const queryTierFactoriesresponse = (await subgraph({
        query: tierChangeQuery,
      })) as FetchResult;

      const tierChangeData = queryTierFactoriesresponse.data.tierChange;

      expect(tierChangeData.transactionHash).to.equals(tx.hash.toLowerCase());
      expect(tierChangeData.sender).to.equals(tierOwner.address.toLowerCase());
      expect(tierChangeData.account).to.equals(tierOwner.address.toLowerCase());
      expect(tierChangeData.startTier).to.equals(Tier.FIVE);
      expect(tierChangeData.endTier).to.equals(Tier.FOUR);
    });
  });

  describe("CombineTier Factory - Queries", function () {
    const sourceAlways = concat([op(Opcode.ALWAYS)]);

    const stateConfigAlways: VMState = {
      sources: [sourceAlways],
      constants: [],
      stackLength: 2,
      argumentsLength: 0,
    };

    it("should query CombineTierFactory correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const implementation = (
        await Util.getEventArgs(
          combineTierFactory.deployTransaction,
          "Implementation",
          combineTierFactory
        )
      ).implementation;

      const query = `
        {
          combineTierFactories {
            id
            address
            implementation
            children {
              id
            }
          }
        }
      `;

      const queryResponde = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponde.data.combineTierFactories[0];

      expect(data.id).to.equals(combineTierFactory.address.toLowerCase());
      expect(data.address).to.equals(combineTierFactory.address.toLowerCase());
      expect(data.implementation).to.equals(implementation.toLocaleLowerCase());
      expect(data.children).to.be.empty;
    });

    it("should query the CombineTier child from factory after creation", async function () {
      transaction = await combineTierFactory.createChildTyped(
        stateConfigAlways
      );

      combineTier = (await getContractChild(
        transaction,
        combineTierFactory,
        combineTierJson
      )) as CombineTier;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          combineTierFactory (id: "${combineTierFactory.address.toLowerCase()}") {
            children {
              id
            }
          }
        }
      `;

      const queryResponde = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponde.data.combineTierFactory;

      expect(data.children).to.have.lengthOf(1);
      expect(data.children[0].id).to.equals(combineTier.address.toLowerCase());
    });

    it("should query the CombineTier correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(500);

      // The signer assigned to the instance
      const deployerExpected = await combineTierFactory.signer.getAddress();

      const query = `
        {
          combineTier (id: "${combineTier.address.toLowerCase()}") {
            address
            deployBlock
            deployTimestamp
            deployer
            factory {
              id
            }
          }
        }
      `;

      const queryResponde = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponde.data.combineTier;

      expect(data.address).to.equals(combineTier.address.toLowerCase());
      expect(data.deployBlock).to.equals(transaction.blockNumber);
      expect(data.deployTimestamp).to.equals(transaction.timestamp);
      expect(data.deployer).to.equals(deployerExpected.toLowerCase());
      expect(data.factory.id).to.equals(
        combineTierFactory.address.toLowerCase()
      );
    });

    it("should query the correct state in CombineTier", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(500);

      const stateExpected = (
        await Util.getEventArgs(transaction, "Snapshot", combineTier)
      ).state_;

      const query = `
        {
          combineTier (id: "${combineTier.address.toLowerCase()}") {
            state {
              id
              stackIndex
              stack
              sources
              constants
              arguments
            }
          }
        }
      `;

      const queryResponde = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponde.data.combineTier.state;

      expect(data.id).to.equals(transaction.hash.toLowerCase());
      expect(data.stackIndex).to.equals(stateExpected.stackIndex);
      expect(data.stack).to.eql(stateExpected.stack);
      expect(data.sources).to.eql(stateExpected.sources);
      expect(data.constants).to.eql(stateExpected.constans);
      expect(data.arguments).to.eql(stateExpected.arguments);
    });

    it("should query the Snapshot correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(500);

      const eventArgs = await Util.getEventArgs(
        transaction,
        "Snapshot",
        combineTier
      );

      const stateSourcesExpected = eventArgs.state_.sources;
      const pointerExpected = eventArgs.pointer;
      // The address that made the tx where the contract was created
      const combineTierCreator = transaction.from.toLocaleLowerCase();

      const query = `
        {
          snapshots {
            id
            sender
            pointer
            state {
              id
              sources
            }
          }
        }
      `;

      const queryResponde = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponde.data.snapshots[0];

      expect(data.sender).to.equal(combineTierCreator);
      expect(data.pointer).to.equal(pointerExpected);

      // Checking the State
      expect(data.state.id).to.equal(transaction.hash.toLocaleLowerCase());
      expect(data.state.sources).to.eql(stateSourcesExpected);

      // We don't know the random part in the Snapshot ID here
      // Could be: `address (where the event was emitted) - randomPart` (?)
      expect(data.id).to.include(combineTier.address.toLocaleLowerCase());
    });
  });

  describe("ERC721BalanceTier Factory - Queries", function () {
    it("should query ERC721BalanceTierFactory correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const implementation = (
        await Util.getEventArgs(
          erc721BalanceTierFactory.deployTransaction,
          "Implementation",
          erc721BalanceTierFactory
        )
      ).implementation;

      const query = `
        {
          erc721BalanceTierFactories {
            id
            address
            implementation
            children {
              id
            }
          }
        }
      `;

      const queryResponde = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponde.data.erc721BalanceTierFactories[0];

      expect(data.id).to.equals(erc721BalanceTierFactory.address.toLowerCase());
      expect(data.address).to.equals(
        erc721BalanceTierFactory.address.toLowerCase()
      );
      expect(data.implementation).to.equals(implementation.toLocaleLowerCase());
      expect(data.children).to.be.empty;
    });

    it("should query the ERC721BalanceTier child from factory after creation", async function () {
      transaction = await erc721BalanceTierFactory.createChildTyped({
        erc721: reserveNFT.address,
        tierValues: LEVELS,
      });

      erc721BalanceTier = (await getContractChild(
        transaction,
        erc721BalanceTierFactory,
        erc721BalanceTierJson
      )) as ERC721BalanceTier;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          erc721BalanceTierFactory (id: "${erc721BalanceTierFactory.address.toLowerCase()}") {
            children {
              id
            }
          }
        }
      `;

      const queryResponde = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponde.data.erc721BalanceTierFactory;

      expect(data.children).to.have.lengthOf(1);
      expect(data.children[0].id).to.equals(
        erc721BalanceTier.address.toLowerCase()
      );
    });

    it("should query the ERC721BalanceTier correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(500);

      // The address that made the tx where BalanceTier contract was created
      const balanceTier721Creator = transaction.from.toLocaleLowerCase();

      const query = `
        {
          erc721BalanceTier (id: "${erc721BalanceTier.address.toLowerCase()}") {
            address
            deployBlock
            deployTimestamp
            deployer
            factory {
              address
            }
            tierValues
            token {
              id
            }
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponse.data.erc721BalanceTier;

      expect(data.address).to.equals(erc721BalanceTier.address.toLowerCase());
      expect(data.deployBlock).to.equals(transaction.blockNumber);
      expect(data.deployTimestamp).to.equals(transaction.timestamp);
      expect(data.deployer).to.equals(balanceTier721Creator);

      expect(data.factory.address).to.equals(
        erc721BalanceTierFactory.address.toLowerCase()
      );
      expect(data.tierValues).to.eql(LEVELS);
      expect(data.token.id).to.equal(reserveNFT.address.toLowerCase());
    });

    it("should query the ERC721-NFT of the ERC721BalanceTier correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(500);

      const query = `
        {
          erc721 (id: "${reserveNFT.address.toLowerCase()}") {
            symbol
            totalSupply
            name
            deployBlock
            deployTimestamp
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponse.data.erc721;

      expect(data.symbol).to.equals(await reserveNFT.symbol());
      expect(data.totalSupply).to.equals(await reserveNFT.totalSupply());
      expect(data.name).to.equals(await reserveNFT.name());
      expect(data.deployBlock).to.equals(
        reserveNFT.deployTransaction.blockNumber
      );
      expect(data.deployTimestamp).to.equals(
        reserveNFT.deployTransaction.timestamp
      );
    });
  });

  describe("UnknownTiers - Queries", function () {
    // All are contracts "independents" - deployed without the factory indexed
    let verify: Verify,
      verifyTier: VerifyTier,
      erc20BalanceTierIndepent: ERC20BalanceTier,
      erc20TransferTierIndepent: ERC20TransferTier,
      combineTier: CombineTier;

    let deployer: SignerWithAddress, creator: SignerWithAddress;

    before("deploy Independent TierContracts", async function () {
      const signers = await ethers.getSigners();
      deployer = signers[0];
      creator = signers[1];

      // Deploy and initialize an ERC20BalanceTierIndependent
      erc20BalanceTierIndepent = (await deploy(
        erc20BalanceTierJson,
        deployer,
        []
      )) as ERC20BalanceTier;

      await erc20BalanceTierIndepent.initialize({
        erc20: reserve.address,
        tierValues: LEVELS,
      });

      // Deploy and initialize an ERC20BalanceTierIndependent
      erc20TransferTierIndepent = (await deploy(
        erc20TransferTierJson,
        deployer,
        []
      )) as ERC20TransferTier;

      await erc20TransferTierIndepent.initialize({
        erc20: reserve.address,
        tierValues: LEVELS,
      });
    });

    it("should be an UnknownTier if TierContract was deployed without the factory and exist in a Trust", async function () {
      // Properties of this trust
      const reserveInit = ethers.BigNumber.from("2000" + sixZeros);
      const redeemInit = ethers.BigNumber.from("2000" + sixZeros);
      const totalTokenSupply = ethers.BigNumber.from("2000" + eighteenZeros);
      const initialValuation = ethers.BigNumber.from("20000" + sixZeros);
      const minimumCreatorRaise = ethers.BigNumber.from("100" + sixZeros);
      const minimumTradingDuration = 20;

      const redeemableERC20Config = {
        name: "Token",
        symbol: "TKN",
        distributor: zeroAddress,
        initialSupply: totalTokenSupply,
      };
      // - Seeder props
      const seederFee = ethers.BigNumber.from("100" + sixZeros);
      const seederUnits = 10;
      const seederCooldownDuration = 1;
      const seedPrice = reserveInit.div(10);
      const minSeedUnits = 0;
      const seeder1Units = 4;
      const seeder2Units = 6;
      const seedERC20Config = {
        name: "SeedToken",
        symbol: "SDT",
        distributor: zeroAddress,
        initialSupply: seederUnits,
      };

      const successLevel = redeemInit
        .add(minimumCreatorRaise)
        .add(seederFee)
        .add(reserveInit);

      const minimumTier = Tier.TWO;

      trust = (await Util.trustDeploy(
        trustFactory,
        creator,
        {
          creator: creator.address,
          minimumCreatorRaise,
          seederFee,
          redeemInit,
          reserve: reserve.address,
          reserveInit,
          initialValuation,
          finalValuation: successLevel,
          minimumTradingDuration,
        },
        {
          erc20Config: redeemableERC20Config,
          tier: erc20BalanceTierIndepent.address,
          minimumTier,
        },
        {
          seeder: zeroAddress,
          cooldownDuration: seederCooldownDuration,
          erc20Config: seedERC20Config,
        },
        { gasLimit: 15000000 }
      )) as Trust;

      await trust.deployed();

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          trust (id: "${trust.address.toLowerCase()}") {
            contracts {
              tier
            }
          }
          ERC721BalanceTier 
          unknownTier (id: "${erc20BalanceTierIndepent.address.toLowerCase()}") {
            address
            deployer
            factory
          }
        }
      `;
      // erc20BalanceTierIndepent

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const tierData = queryResponse.data.erc20BalanceTier;
      const tokenData = tierData.token;
    });

    it("should be an UnknownTier if TierContract was deployed without the factory and exist in a Sale", async function () {});
  });
});
