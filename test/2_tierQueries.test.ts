/* eslint-disable node/no-missing-import */
/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */

import { expect } from "chai";
import { ethers } from "hardhat";
import * as Util from "./utils/utils";
import { ApolloFetch, FetchResult } from "apollo-fetch";
import * as path from "path";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type { BigNumber, BigNumberish } from "ethers";
import { hexlify } from "ethers/lib/utils";
import {
  deploy,
  waitForSubgraphToBeSynced,
  fetchSubgraph,
  exec,
  balancerDeploy,
  factoriesDeploy,
  eighteenZeros,
} from "./utils/utils";
import {
  getContracts,
  getFactories,
  getTrust,
  NOTICE_QUERY,
  QUERY,
} from "./utils/queries";

import reserveToken from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveToken.sol/ReserveToken.json";
import ERC20BalanceTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20BalanceTierFactory.sol/ERC20BalanceTierFactory.json";
import ERC20TransferTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20TransferTierFactory.sol/ERC20TransferTierFactory.json";
import CombineTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/CombineTierFactory.sol/CombineTierFactory.json";
import VerifyTierFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/VerifyTierFactory.sol/VerifyTierFactory.json";
import VerifyFactoryJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/verify/VerifyFactory.sol/VerifyFactory.json";

import ERC20BalanceTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20BalanceTier.sol/ERC20BalanceTier.json";
import ERC20TransferTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20TransferTier.sol/ERC20TransferTier.json";
import CombineTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/CombineTier.sol/CombineTier.json";
import VerifyTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/VerifyTier.sol/VerifyTier.json";
import VerifyJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/verify/Verify.sol/Verify.json";

import { ReserveToken } from "@beehiveinnovation/rain-protocol/typechain/ReserveToken";
import { ERC20BalanceTierFactory } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTierFactory";
import { ERC20TransferTierFactory } from "@beehiveinnovation/rain-protocol/typechain/ERC20TransferTierFactory";
import { CombineTierFactory } from "@beehiveinnovation/rain-protocol/typechain/CombineTierFactory";
import { VerifyTierFactory } from "@beehiveinnovation/rain-protocol/typechain/VerifyTierFactory";
import { VerifyFactory } from "@beehiveinnovation/rain-protocol/typechain/VerifyFactory";

import { Trust } from "@beehiveinnovation/rain-protocol/typechain/Trust";
import { TrustFactory } from "@beehiveinnovation/rain-protocol/typechain/TrustFactory";
import { BFactory } from "@beehiveinnovation/rain-protocol/typechain/BFactory";
import { CRPFactory } from "@beehiveinnovation/rain-protocol/typechain/CRPFactory";

import { ERC20BalanceTier } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTier";
import { ERC20TransferTier } from "@beehiveinnovation/rain-protocol/typechain/ERC20TransferTier";
import { CombineTier } from "@beehiveinnovation/rain-protocol/typechain/CombineTier";
import { VerifyTier } from "@beehiveinnovation/rain-protocol/typechain/VerifyTier";
import { Verify } from "@beehiveinnovation/rain-protocol/typechain/Verify";

enum Tier {
  ZERO,
  ONE,
  TWO,
  THREE,
  FOUR,
  FIVE,
  SIX,
  SEVEN,
  EIGHT,
}

enum Status {
  Nil,
  Added,
  Approved,
  Banned,
}

describe("Subgraph Tier Test", function () {
  const subgraphUser = "vishalkale151071";
  const subgraphName = "rain-protocol";
  // let ERC721BalanceTierFactory;
  let subgraph: ApolloFetch;
  let verifyFactory: VerifyFactory;
  let verifyTierFactory: VerifyTierFactory;
  let erc20BalanceTierFactory: ERC20BalanceTierFactory;
  let erc20TransferTierFactory: ERC20TransferTierFactory;
  let combineTierFactory: CombineTierFactory;
  let reserve: ReserveToken;
  let trustFactory: TrustFactory;
  let trust: Trust;
  let currentBlock: number;

  const LEVELS = Array.from(Array(8).keys()).map((value) =>
    ethers.BigNumber.from(++value + eighteenZeros)
  ); // [1,2,3,4,5,6,7,8]
  const LEVEL_SIZE_LINEAR = ethers.BigNumber.from(1 + eighteenZeros);

  // TODO: Add test to tier contracts that are not indexed by the subgraph but are present
  // in other contracts like trusts or sales

  before("Deploy factories", async function () {
    const signers = await ethers.getSigners();
    const deployer: SignerWithAddress = signers[0];

    reserve = (await Util.deploy(reserveToken, deployer, [])) as ReserveToken;

    // Trust factory
    const [crpFactory, bFactory] = (await Util.balancerDeploy(deployer)) as [
      CRPFactory,
      BFactory
    ];
    currentBlock = await ethers.provider.getBlockNumber();
    ({ trustFactory } = await factoriesDeploy(crpFactory, bFactory, deployer));

    // Verify factory
    const blockErc20VerifyFactory = await ethers.provider.getBlockNumber();
    verifyFactory = (await Util.deploy(
      VerifyFactoryJson,
      deployer,
      []
    )) as VerifyFactory;

    // Tiers factories
    const blockErc20BalanceTierFactory = await ethers.provider.getBlockNumber();
    erc20BalanceTierFactory = (await Util.deploy(
      ERC20BalanceTierFactoryJson,
      deployer,
      []
    )) as ERC20BalanceTierFactory;

    const blockErc20TierTierFactory = await ethers.provider.getBlockNumber();
    erc20TransferTierFactory = (await Util.deploy(
      ERC20TransferTierFactoryJson,
      deployer,
      []
    )) as ERC20TransferTierFactory;

    const blockCombineTierFactory = await ethers.provider.getBlockNumber();
    combineTierFactory = (await Util.deploy(
      CombineTierFactoryJson,
      deployer,
      []
    )) as CombineTierFactory;

    const blockVerifyTierFactory = await ethers.provider.getBlockNumber();
    verifyTierFactory = (await Util.deploy(
      VerifyTierFactoryJson,
      deployer,
      []
    )) as VerifyTierFactory;

    const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
    const configLocal = JSON.parse(Util.fetchFile(pathConfigLocal));

    // If we need index both
    configLocal.factory = trustFactory.address;
    configLocal.startBlock = currentBlock;

    // Saving addresses and individuals blocks. Idk if it is necessary, just in case
    configLocal.verifyFactory = verifyFactory.address;
    configLocal.blockErc20VerifyFactory = blockErc20VerifyFactory;

    configLocal.erc20BalanceTierFactory = erc20BalanceTierFactory.address;
    configLocal.blockErc20BalanceTierFactory = blockErc20BalanceTierFactory;

    configLocal.erc20TransferTierFactory = erc20TransferTierFactory.address;
    configLocal.blockErc20TierTierFactory = blockErc20TierTierFactory;

    configLocal.combineTierFactory = combineTierFactory.address;
    configLocal.blockCombineTierFactory = blockCombineTierFactory;

    configLocal.verifyTierFactory = verifyTierFactory.address;
    configLocal.blockVerifyTierFactory = blockVerifyTierFactory;

    Util.writeFile(pathConfigLocal, JSON.stringify(configLocal, null, 4));

    exec(`yarn deploy-build:localhost`);

    // subgraph = fetchSubgraph(subgraphUser, subgraphName);
  });

  describe("Verify Factories - queries", function () {
    let verifyTier: VerifyTier;
    let verify: Verify;
    let deployer: SignerWithAddress;
    let admin: SignerWithAddress;
    let signer1: SignerWithAddress;
    let signer2: SignerWithAddress;

    const evidenceEmpty = hexlify([...Buffer.from("")]);
    const evidenceAdd = hexlify([...Buffer.from("Evidence for add")]);
    const evidenceApprove = hexlify([...Buffer.from("Evidence for approve")]);
    const evidenceBan = hexlify([...Buffer.from("Evidence for ban")]);

    before("Declare signers", async function () {
      const signers = await ethers.getSigners();
      deployer = signers[0];
      signer1 = signers[5];
      signer2 = signers[6];
      admin = signers[9];
    });

    it("should query VerifyFactory correctly after construction", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const tierFactoryQuery = `
        {
          verifyTierFactory  (id: "${verifyFactory.address.toLowerCase()}") {
            address
            children {
              id
            }
          }
        }
      `;

      const queryTierFactoriesresponse = (await subgraph({
        query: tierFactoryQuery,
      })) as FetchResult;

      const TierFactoriesData = queryTierFactoriesresponse.data;

      expect(TierFactoriesData.verifyTierFactory.address).to.equals(
        verifyFactory.address.toLowerCase()
      );
      expect(TierFactoriesData.verifyTierFactory.children).to.be.empty;
    });

    it("should query VerifyTierFactory correctly after construction", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const tierFactoriesQuery = `
        {
          tierFactory  (id: "${verifyTierFactory.address.toLowerCase()}") {
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

      const TierFactoriesData = queryTierFactoriesresponse.data;

      expect(TierFactoriesData.tierFactory.address).to.equals(
        erc20BalanceTierFactory.address.toLowerCase()
      );
      expect(TierFactoriesData.tierFactory.children).to.be.empty;
    });

    it("should query the Verify child from factory after creation", async function () {
      const verifyCreator = verifyFactory.signer;

      const tx = await verifyFactory.createChildTyped(admin.address);

      verify = (await Util.getContractChild(
        tx,
        verifyFactory,
        VerifyJson
      )) as Verify;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const verifyFactoryQuery = `
        {
          verifyFactory (id: "${verifyFactory.address.toLowerCase()}") {
            address
            children {
              id
              deployer
            }
          }
        }
      `;

      const queryVerifyFactoryResponse = (await subgraph({
        query: verifyFactoryQuery,
      })) as FetchResult;

      const verifyFactoryData = queryVerifyFactoryResponse.data.verifyFactory;
      const verifyData = verifyFactoryData.children[0];

      expect(verifyFactoryData.children).to.have.lengthOf(1);
      expect(verifyData.id).to.equals(verify.address.toLowerCase());
      expect(verifyData.deployer).to.equals(
        (await verifyCreator.getAddress()).toLowerCase()
      );
    });

    it("should query the VerifyTier child from factory after creation", async function () {
      const verifyTierCreator = verifyTierFactory.signer;
      const tx = await verifyTierFactory.createChildTyped(verify.address);

      verifyTier = (await Util.getContractChild(
        tx,
        verifyTierFactory,
        VerifyTierJson
      )) as VerifyTier;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const verifyTierFactoryQuery = `
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

      const queryVerifyTierFactoryResponse = (await subgraph({
        query: verifyTierFactoryQuery,
      })) as FetchResult;

      const verifyTierFactoryData =
        queryVerifyTierFactoryResponse.data.verifyFactory;
      const verifyTierData = verifyTierFactoryData.children[0];

      expect(verifyTierFactoryData.children).to.have.lengthOf(1);
      expect(verifyTierData.id).to.equals(verifyTier.address.toLowerCase());
      expect(verifyTierData.deployer).to.equals(
        (await verifyTierCreator.getAddress()).toLowerCase()
      );
    });

    it("should query the VerifyContract from VerifyTier correclty", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const verifyTierQuery = `
        {
          verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            verifyContract {
              address
              verifyAddresses
            }
          }
        }
      `;

      const verifyTierQueryResponse = (await subgraph({
        query: verifyTierQuery,
      })) as FetchResult;

      const verifyData = verifyTierQueryResponse.data.verifyTier.verifyContract;

      expect(verifyData.address).to.equals(verify.address.toLowerCase());
      expect(verifyData.verifyAddresses).to.be.empty;
    });

    it("should query null if Verify is present in VerifyTier and was deployed without the factory", async function () {
      // Verify deployed without factory
      const verifyIndependent = (await Util.deploy(
        VerifyJson,
        deployer,
        []
      )) as Verify;

      await verifyIndependent.initialize(admin.address);

      const tx = await verifyTierFactory.createChildTyped(
        verifyIndependent.address
      );

      const verifyTier2 = (await Util.getContractChild(
        tx,
        verifyTierFactory,
        VerifyTierJson
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

  describe("ERC20BalanceTierFactory - queries", function () {
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
      const tierCreator = erc20BalanceTierFactory.signer;
      const tx = await erc20BalanceTierFactory.createChildTyped({
        erc20: reserve.address,
        tierValues: LEVELS,
      });

      erc20BalanceTier = (await Util.getContractChild(
        tx,
        erc20BalanceTierFactory,
        ERC20BalanceTierJson
      )) as ERC20BalanceTier;

      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const query = `
        {
          erc20BalanceTierFactory  (id: "${erc20BalanceTierFactory.address.toLowerCase()}") {
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

      const factoryData = queryResponse.data.erc20BalanceTierFactory;
      const erc20BalanceTierData = factoryData.children[0];

      expect(factoryData.children).to.have.lengthOf(1);
      expect(erc20BalanceTierData.id).to.equals(
        erc20BalanceTier.address.toLowerCase()
      );
      expect(erc20BalanceTierData.deployer).to.equals(
        (await tierCreator.getAddress()).toLowerCase()
      );
    });

    it("should query the ERC20BalanceTier correctly", async function () {
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
      console.log("tierData.tierValues");
      console.log(tierData.tierValues);
      expect(tierData.tierValues).to.eql(LEVELS);

      expect(tokenData.name).to.equals(await reserve.name());
      expect(tokenData.symbol).to.equals(await reserve.symbol());
      expect(tokenData.decimals).to.equals(await reserve.decimals());
      expect(tokenData.totalSupply).to.equals(await reserve.totalSupply());
    });
  });

  describe("ERC20TransferTierFactory - queries", function () {
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

      erc20TransferTier = (await Util.getContractChild(
        tx,
        erc20TransferTierFactory,
        ERC20TransferTierJson
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

  describe("CombineTierFactory - queries", function () {
    it("should query CombineTierFactory correctly", async function () {
      await Util.delay(Util.wait);
      await waitForSubgraphToBeSynced(1000);

      const tierFactoriesQuery = `
        {
          combineTierF: tierFactory  (id: "${combineTierFactory.address.toLowerCase()}") {
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

      const TierFactoriesData = queryTierFactoriesresponse.data;

      expect(TierFactoriesData.combineTierF.address).to.equals(
        erc20BalanceTierFactory.address.toLowerCase()
      );

      expect(TierFactoriesData.combineTierF.children).to.be.empty;
    });
  });

  describe("UnknownTier - Queries", function () {
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
      erc20BalanceTierIndepent = (await Util.deploy(
        ERC20BalanceTierJson,
        deployer,
        []
      )) as ERC20BalanceTier;

      await erc20BalanceTierIndepent.initialize({
        erc20: reserve.address,
        tierValues: LEVELS,
      });

      // Deploy and initialize an ERC20BalanceTierIndependent
      erc20TransferTierIndepent = (await Util.deploy(
        ERC20TransferTierJson,
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
      const reserveInit = ethers.BigNumber.from("2000" + Util.sixZeros);
      const redeemInit = ethers.BigNumber.from("2000" + Util.sixZeros);
      const totalTokenSupply = ethers.BigNumber.from(
        "2000" + Util.eighteenZeros
      );
      const initialValuation = ethers.BigNumber.from("20000" + Util.sixZeros);
      const minimumCreatorRaise = ethers.BigNumber.from("100" + Util.sixZeros);
      const minimumTradingDuration = 20;

      const redeemableERC20Config = {
        name: "Token",
        symbol: "TKN",
        distributor: Util.zeroAddress,
        initialSupply: totalTokenSupply,
      };
      // - Seeder props
      const seederFee = ethers.BigNumber.from("100" + Util.sixZeros);
      const seederUnits = 10;
      const seederCooldownDuration = 1;
      const seedPrice = reserveInit.div(10);
      const minSeedUnits = 0;
      const seeder1Units = 4;
      const seeder2Units = 6;
      const seedERC20Config = {
        name: "SeedToken",
        symbol: "SDT",
        distributor: Util.zeroAddress,
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
          seeder: Util.zeroAddress,
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
