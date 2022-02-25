/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { expect } from "chai";
import { ethers } from "hardhat";
import { FetchResult } from "apollo-fetch";
import { BigNumber, ContractTransaction } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { hexlify, concat } from "ethers/lib/utils";

import * as Util from "./utils/utils";
import {
  op,
  deploy,
  getTxTimeblock,
  getContractChild,
  waitForSubgraphToBeSynced,
  eighteenZeros,
  sixZeros,
  zeroAddress,
  Tier,
  VMState,
  LEVELS,
} from "./utils/utils";

// Artifacts
import reserveJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveTokenTest.sol/ReserveTokenTest.json";
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
import { ReserveTokenTest } from "@beehiveinnovation/rain-protocol/typechain/ReserveTokenTest";
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
  // Subgraph
  subgraph,
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
import { version } from "process";

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

let trust: Trust,
  reserve: ReserveTokenTest,
  reserveNFT: ReserveNFT,
  verifyTier: VerifyTier,
  verify: Verify,
  combineTier: CombineTier,
  erc721BalanceTier: ERC721BalanceTier,
  transaction: ContractTransaction; // use to save/facilite a tx

describe("Subgraph Tier Test", function () {
  // TODO: Add test to tier contracts that are not indexed by the subgraph but are present
  // in other contracts like trusts or sales

  before("Deploy fresh test contracts", async function () {
    reserve = (await deploy(reserveJson, deployer, [])) as ReserveTokenTest;
    reserveNFT = (await deploy(reserveNFTJson, deployer, [])) as ReserveNFT;
  });

  describe("VerifyTier Factory - Queries", function () {
    const APPROVER = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("APPROVER")
    );
    const REMOVER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("REMOVER"));
    const BANNER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BANNER"));

    const evidenceData = hexlify([...Buffer.from("Evidence")]);

    let verifyTier2: VerifyTier,
      signer1Id: string,
      signer2Id: string,
      adminId: string;

    before("deploy fresh test contracts", async function () {
      // Creating a new Verify Child
      verify = await Util.verifyDeploy(verifyFactory, creator, admin.address);

      // Admin grants all roles to himself. This is for testing purposes only, it SHOULD be avoided.
      await verify.connect(admin).grantRole(APPROVER, admin.address);
      await verify.connect(admin).grantRole(REMOVER, admin.address);
      await verify.connect(admin).grantRole(BANNER, admin.address);

      // Verify Address IDs
      signer1Id = `${verify.address.toLowerCase()} - ${signer1.address.toLocaleLowerCase()}`;
      signer2Id = `${verify.address.toLowerCase()} - ${signer2.address.toLocaleLowerCase()}`;
      adminId = `${verify.address.toLowerCase()} - ${admin.address.toLocaleLowerCase()}`;
    });

    it("should query VerifyTierFactory correctly after construction", async function () {
      // Get the VerifyTier implementation
      const implementation = (
        await Util.getEventArgs(
          verifyTierFactory.deployTransaction,
          "Implementation",
          verifyTierFactory
        )
      ).implementation;

      const query = `
        {
          verifyTierFactories  {
            id
            address
            implementation
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = response.data.verifyTierFactories[0];

      expect(data.id).to.equals(verifyTierFactory.address.toLowerCase());
      expect(data.address).to.equals(verifyTierFactory.address.toLowerCase());
      expect(data.implementation).to.equals(implementation.toLowerCase());
    });

    it("should query the VerifyTier child from Factory after creation", async function () {
      // Creating the VerifyTier Contract with the Verify
      verifyTier = await Util.verifyTierDeploy(
        verifyTierFactory,
        creator,
        verify.address
      );

      await waitForSubgraphToBeSynced();

      const query = `
        {
          verifyTierFactory  (id: "${verifyTierFactory.address.toLowerCase()}") {
            children {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = response.data.verifyTierFactory;

      expect(data.children).to.deep.include({
        id: verifyTier.address.toLowerCase(),
      });
    });

    it("should query the VerityTier contract correclty", async function () {
      const [deployBlock, deployTimestamp] = await getTxTimeblock(
        verifyTier.deployTransaction
      );

      const query = `
        {
          verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            id
            address
            deployer
            deployBlock
            deployTimestamp
            factory {
              address
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = response.data.verifyTier;

      expect(data.id).to.equals(verifyTier.address.toLowerCase());
      expect(data.address).to.equals(verifyTier.address.toLowerCase());
      expect(data.deployer).to.equals(creator.address.toLowerCase());

      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTimestamp.toString());
      expect(data.factory.address).to.equals(
        verifyTierFactory.address.toLowerCase()
      );
    });

    it("should query the Verify contract from VerifyTier correclty", async function () {
      const [deployBlock, deployTimestamp] = await getTxTimeblock(
        verify.deployTransaction
      );

      const query = `
        {
          verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            verifyContract {
              id
              address
              deployer
              deployBlock
              deployTimestamp
              factory {
                id
              }
              verifyAddresses {
                id
              }
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = response.data.verifyTier.verifyContract;

      expect(data.id).to.equals(verify.address.toLowerCase());
      expect(data.address).to.equals(verify.address.toLowerCase());
      expect(data.deployer).to.equals(creator.address.toLowerCase());

      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTimestamp.toString());
      expect(data.factory.id).to.equals(verifyFactory.address.toLowerCase());

      expect(data.verifyAddresses).to.be.empty;
    });

    it("should update the Verify contract in different VerifyTiers after a RequestApprove", async function () {
      // Creating the a new VerifyTier Contract with the same Verify
      verifyTier2 = await Util.verifyTierDeploy(
        verifyTierFactory,
        creator,
        verify.address
      );

      // signer1 and signer2 want to be added
      await verify.connect(signer1).add(evidenceData);
      await verify.connect(signer2).add(evidenceData);

      const signer1Expected = {
        id: signer1Id,
        requestStatus: 1,
        status: 0,
      };

      await waitForSubgraphToBeSynced();

      const query = `
        {
          verifyTier1: verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
          verifyTier2: verifyTier (id: "${verifyTier2.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataTier1 = response.data.verifyTier1.verifyContract;
      const dataTier2 = response.data.verifyTier2.verifyContract;

      // VerifyTier1
      expect(dataTier1.verifyAddresses).to.deep.include(signer1Expected);

      // VerifyTier2
      expect(dataTier2.verifyAddresses).to.deep.include(signer1Expected);
    });

    it("should update the Verify contract in different VerifyTiers after a Approve", async function () {
      // Admin approve the users
      await verify.connect(admin).approve(signer1.address, evidenceData);
      await verify.connect(admin).approve(signer2.address, evidenceData);

      const signer1Expected = {
        id: signer1Id,
        requestStatus: 0,
        status: 1,
      };

      const adminExpected = {
        id: adminId,
        requestStatus: 0,
        status: 0,
      };

      await waitForSubgraphToBeSynced();

      const query = `
        {
          verifyTier1: verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
          verifyTier2: verifyTier (id: "${verifyTier2.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataTier1 = response.data.verifyTier1.verifyContract;
      const dataTier2 = response.data.verifyTier2.verifyContract;

      // VerifyTier1
      expect(dataTier1.verifyAddresses).to.deep.include(signer1Expected);
      expect(dataTier1.verifyAddresses).to.deep.include(adminExpected);

      // VerifyTier2
      expect(dataTier2.verifyAddresses).to.deep.include(signer1Expected);
      expect(dataTier2.verifyAddresses).to.deep.include(adminExpected);
    });

    it("should update the Verify contract in different VerifyTiers after a RequestRemove", async function () {
      // signer1 requests that signer2 be removed
      await verify
        .connect(signer1)
        .requestRemove(signer2.address, evidenceData);

      const signer1Expected = {
        id: signer1Id,
        requestStatus: 0,
        status: 1,
      };

      const signer2Expected = {
        id: signer2Id,
        requestStatus: 3,
        status: 1,
      };

      await waitForSubgraphToBeSynced();

      const query = `
        {
          verifyTier1: verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
          verifyTier2: verifyTier (id: "${verifyTier2.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataTier1 = response.data.verifyTier1.verifyContract;
      const dataTier2 = response.data.verifyTier2.verifyContract;

      // VerifyTier1
      expect(dataTier1.verifyAddresses).to.deep.include(signer1Expected);
      expect(dataTier1.verifyAddresses).to.deep.include(signer2Expected);

      // VerifyTier2
      expect(dataTier2.verifyAddresses).to.deep.include(signer1Expected);
      expect(dataTier2.verifyAddresses).to.deep.include(signer2Expected);
    });

    it("should update the Verify contract in different VerifyTiers after a Remove", async function () {
      // Admin remove the signer2
      await verify.connect(admin).remove(signer2.address, evidenceData);

      const signer2Expected = {
        id: signer2Id,
        requestStatus: 0,
        status: 3,
      };

      await waitForSubgraphToBeSynced();

      const query = `
        {
          verifyTier1: verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
          verifyTier2: verifyTier (id: "${verifyTier2.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataTier1 = response.data.verifyTier1.verifyContract;
      const dataTier2 = response.data.verifyTier2.verifyContract;

      // VerifyTier1
      expect(dataTier1.verifyAddresses).to.deep.include(signer2Expected);

      // VerifyTier2
      expect(dataTier2.verifyAddresses).to.deep.include(signer2Expected);
    });

    it("should update the Verify contract in different VerifyTiers after a RequestBan", async function () {
      // Add again signer2 to request ban
      await verify.connect(signer2).add(evidenceData);
      await verify.connect(admin).approve(signer2.address, evidenceData);

      // signer1 request signer2 to be banned
      await verify.connect(signer1).requestBan(signer2.address, evidenceData);

      const signer2Expected = {
        id: signer2Id,
        requestStatus: 2,
        status: 1,
      };

      await waitForSubgraphToBeSynced();

      const query = `
        {
          verifyTier1: verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
          verifyTier2: verifyTier (id: "${verifyTier2.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataTier1 = response.data.verifyTier1.verifyContract;
      const dataTier2 = response.data.verifyTier2.verifyContract;

      // VerifyTier1
      expect(dataTier1.verifyAddresses).to.deep.include(signer2Expected);

      // VerifyTier2
      expect(dataTier2.verifyAddresses).to.deep.include(signer2Expected);
    });

    it("should update the Verify contract in different VerifyTiers after a Ban", async function () {
      // Admin ban the signer2
      await verify.connect(admin).ban(signer2.address, evidenceData);

      const signer2Expected = {
        id: signer2Id,
        requestStatus: 0,
        status: 2,
      };

      await waitForSubgraphToBeSynced();

      const query = `
        {
          verifyTier1: verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
          verifyTier2: verifyTier (id: "${verifyTier2.address.toLowerCase()}") {
            verifyContract {
              verifyAddresses {
                id
                requestStatus
                status
              }
            }
          }
        }
      `;
      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataTier1 = response.data.verifyTier1.verifyContract;
      const dataTier2 = response.data.verifyTier2.verifyContract;

      // VerifyTier1
      expect(dataTier1.verifyAddresses).to.deep.include(signer2Expected);

      // VerifyTier2
      expect(dataTier2.verifyAddresses).to.deep.include(signer2Expected);
    });

    it("should continue query if the Verify Address in VerifyTier is a non-Verify contract address", async function () {
      const nonVerifyAddress = Util.zeroAddress;

      // Creating the VerifyTier Contract with the non-Verify contract address
      verifyTier = await Util.verifyTierDeploy(
        verifyTierFactory,
        creator,
        nonVerifyAddress
      );

      await waitForSubgraphToBeSynced();

      const query = `
        {
          verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            address
            verifyContract {
              id
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
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataTier = response.data.verifyTier;
      const data = response.data.verifyTier.verifyContract;

      expect(dataTier.address).to.equals(verifyTier.address.toLowerCase());

      expect(data.id).to.equals(nonVerifyAddress.toLowerCase());
      expect(data.address).to.equals(nonVerifyAddress.toLowerCase());

      expect(data.deployBlock).to.equals("0");
      expect(data.deployTimestamp).to.equals("0");

      expect(data.deployer).to.equals(Util.zeroAddress.toLowerCase());
      expect(data.factory).to.be.null;
      expect(data.verifyAddresses).to.be.empty;
    });

    it("should query a Verify that was deployed without the factory and it is in VerifyTier", async function () {
      // Verify deployed without factory
      const verifyIndependent = (await deploy(
        verifyJson,
        deployer,
        []
      )) as Verify;

      await verifyIndependent.initialize(admin.address);

      // Creating the VerifyTier Contract with the Verify
      verifyTier = await Util.verifyTierDeploy(
        verifyTierFactory,
        creator,
        verifyIndependent.address
      );

      await waitForSubgraphToBeSynced();

      const query = `
        {
          verifyTier (id: "${verifyTier.address.toLowerCase()}") {
            address
            verifyContract {
              id
              address
              deployer
              deployBlock
              deployTimestamp
              factory {
                id
              }
              verifyAddresses {
                id
              }
            }
          }
        }
      `;

      const response = (await subgraph({
        query: query,
      })) as FetchResult;
      const dataTier = response.data.verifyTier;
      const data = response.data.verifyTier.verifyContract;

      expect(dataTier.address).to.equals(verifyTier.address.toLowerCase());

      expect(data.id).to.equals(verifyIndependent.address.toLowerCase());
      expect(data.address).to.equals(verifyIndependent.address.toLowerCase());

      // Is there any way to get this values if was deployed without the factory?
      expect(data.deployBlock).to.equals("0");
      expect(data.deployTimestamp).to.equals("0");

      expect(data.deployer).to.equals(Util.zeroAddress.toLowerCase());
      expect(data.factory).to.null;
      expect(data.verifyAddresses).to.be.empty;
    });
  });

  describe("ERC20BalanceTier Factory - Queries", function () {
    let erc20BalanceTier: ERC20BalanceTier;

    it("should query ERC20BalanceTierFactory correctly after construction", async function () {
      await waitForSubgraphToBeSynced();

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

      await waitForSubgraphToBeSynced();

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
      await waitForSubgraphToBeSynced();

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
      expect(tierData.tierValues).deep.equal(LEVELS);
      expect(tokenData.id).to.equals(reserve.address.toLowerCase());
    });

    it("should query the ERC20 token from tier contract correctly", async function () {
      await waitForSubgraphToBeSynced();

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
      await waitForSubgraphToBeSynced();

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
        erc20TransferTierFactory.address.toLowerCase()
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

      await waitForSubgraphToBeSynced();

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
      await waitForSubgraphToBeSynced();

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
        erc20TransferTierFactory.address.toLowerCase()
      );
      expect(tierData.address).to.equals(
        erc20TransferTier.address.toLowerCase()
      );
      expect(tierData.tierValues).to.eql(LEVELS);
      expect(tierData.token.id).to.equals(reserve.address.toLowerCase());
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

      await waitForSubgraphToBeSynced();

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
      expect(tierChange.startTier).to.equals(Tier.ZERO.toString());
      expect(tierChange.endTier).to.equals(Tier.FIVE.toString());
      expect(tierChange.transactionHash).to.equals(tx.hash.toLowerCase());
    });

    it("should query a level with members correctly", async function () {
      await waitForSubgraphToBeSynced();

      const Level = Tier.FIVE;

      const tierLevelQuery = `
        {
          tierLevel (id: "${erc20TransferTier.address.toLowerCase()} - ${Level}") {
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
        erc20TransferTier.address.toLocaleLowerCase()
      );
      expect(TierLevelData.tierLevel).to.equals(Level.toString());
      expect(TierLevelData.memberCount).to.equals("1");
    });

    it("should query a level without members correctly", async function () {
      await waitForSubgraphToBeSynced();

      const Level = Tier.ONE;

      const tierLevelQuery = `
        {
          tierLevel (id: "${erc20TransferTier.address.toLowerCase()} - ${Level}") {
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
        erc20TransferTier.address.toLowerCase()
      );
      expect(TierLevelData.tierLevel).to.equals(Level.toString());
      expect(TierLevelData.memberCount).to.equals("0");
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

      await waitForSubgraphToBeSynced();

      const tierChangeQuery = `
        {
          tierChange  (id: "${tx.hash.toLowerCase()} - ${tierContractAddress}") {
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
      expect(tierChangeData.startTier).to.equals(Tier.FIVE.toString());
      expect(tierChangeData.endTier).to.equals(Tier.FOUR.toString());
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
      await waitForSubgraphToBeSynced();

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

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponse.data.combineTierFactories[0];

      expect(queryResponse.data.combineTierFactories).to.have.lengthOf(1);

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

      await waitForSubgraphToBeSynced();

      const query = `
        {
          combineTierFactory (id: "${combineTierFactory.address.toLowerCase()}") {
            children {
              id
            }
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponse.data.combineTierFactory;

      expect(data.children).to.have.lengthOf(1);
      expect(data.children[0].id).to.equals(combineTier.address.toLowerCase());
    });

    it("should query the CombineTier correctly", async function () {
      await waitForSubgraphToBeSynced();

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

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponse.data.combineTier;

      expect(data.address).to.equals(combineTier.address.toLowerCase());
      expect(data.deployBlock).to.equals(transaction.blockNumber.toString());
      expect(data.deployTimestamp).to.equals(transaction.timestamp.toString());
      expect(data.deployer).to.equals(deployerExpected.toLowerCase());
      expect(data.factory.id).to.equals(
        combineTierFactory.address.toLowerCase()
      );
    });

    it("should query the correct state in CombineTier", async function () {
      await waitForSubgraphToBeSynced();

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

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponse.data.combineTier.state;

      expect(data.id).to.equals(transaction.hash.toLowerCase());
      expect(data.stackIndex).to.equals(stateExpected.stackIndex);
      expect(data.stack).to.deep.equals(stateExpected.stack.map((element: BigNumber) => parseInt(element._hex).toString() ));
      // expect(data.stack).to.eql(stateExpected.stack);
      // expect(data.sources).to.eql(stateExpected.sources);
      // expect(data.constants).to.eql(stateExpected.constans);
      // expect(data.arguments).to.eql(stateExpected.arguments);
    });

    it("should query the Snapshot correctly", async function () {
      await waitForSubgraphToBeSynced();

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

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponse.data.snapshots[0];

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
      await waitForSubgraphToBeSynced();

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

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponse.data.erc721BalanceTierFactories[0];

      expect(queryResponse.data.erc721BalanceTierFactories).to.have.lengthOf(1);

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

      await waitForSubgraphToBeSynced();

      const query = `
        {
          erc721BalanceTierFactory (id: "${erc721BalanceTierFactory.address.toLowerCase()}") {
            children {
              id
            }
          }
        }
      `;

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const data = queryResponse.data.erc721BalanceTierFactory;

      expect(data.children).to.have.lengthOf(1);
      expect(data.children[0].id).to.equals(
        erc721BalanceTier.address.toLowerCase()
      );
    });

    it("should query the ERC721BalanceTier correctly", async function () {
      await waitForSubgraphToBeSynced();

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
      // expect(data.deployBlock).to.equals(transaction.blockNumber.toString());
      // expect(data.deployTimestamp).to.equals(transaction.timestamp.toString());
      expect(data.deployer).to.equals(balanceTier721Creator);

      expect(data.factory.address).to.equals(
        erc721BalanceTierFactory.address.toLowerCase()
      );
      expect(data.tierValues).to.eql(LEVELS);
      expect(data.token.id).to.equal(reserveNFT.address.toLowerCase());
    });

    it("should query the ERC721-NFT of the ERC721BalanceTier correctly", async function () {
      await waitForSubgraphToBeSynced();

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
        reserveNFT.deployTransaction.blockNumber.toString()
      );
      expect(data.deployTimestamp).to.equals(
        reserveNFT.deployTransaction.timestamp.toString()
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

      await waitForSubgraphToBeSynced();

      const query = `
        {
          trust (id: "${trust.address.toLowerCase()}") {
            contracts {
              tier {
                __typename
                ... on UnknownTier {
                  id
                  address
                  deployer
                  factory {
                    id
                  }
                }
              }
              
            }
          }
        }
      `;
      // erc20BalanceTierIndepent

      const queryResponse = (await subgraph({
        query: query,
      })) as FetchResult;

      const tierData = queryResponse.data.trust.contracts.tier;

      console.log("tierData : ", JSON.stringify(tierData));
      expect(tierData.deployer).to.equals(zeroAddress);
      expect(tierData.address).to.equals(
        erc20BalanceTierIndepent.address.toLowerCase()
      );
      expect(tierData.__typename).to.equals("UnknownTier");
      expect(tierData.factory).to.be.null;
    });

    it("should be an UnknownTier if TierContract was deployed without the factory and exist in a Sale", async function () {
      //
    });
  });
});
