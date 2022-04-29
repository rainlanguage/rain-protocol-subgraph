import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { concat } from "ethers/lib/utils";
import * as Util from "./utils/utils";
import {
  op,
  getTxTimeblock,
  getImplementation,
  getEventArgs,
  waitForSubgraphToBeSynced,
  eighteenZeros,
  sixZeros,
  zeroAddress,
  Tier,
  VMState,
  LEVELS,
  OpcodeTier,
  OpcodeSale,
} from "./utils/utils";

// Typechain Factories
import { ReserveTokenTest__factory } from "../typechain/factories/ReserveTokenTest__factory";
import { ReserveNFT__factory } from "../typechain/factories/ReserveNFT__factory";
import { ERC20BalanceTier__factory } from "../typechain/factories/ERC20BalanceTier__factory";
import { Verify__factory } from "../typechain/factories/Verify__factory";

// Types
import type { FetchResult } from "apollo-fetch";
import type { BigNumber, ContractTransaction } from "ethers";
import type { TierChangeEvent } from "../typechain/ITier";
import type { SnapshotEvent } from "../typechain/VMState";
import type { ReserveTokenTest } from "../typechain/ReserveTokenTest";
import type { ReserveNFT } from "../typechain/ReserveNFT";
import type { Verify } from "../typechain/Verify";

import type { VerifyTier } from "../typechain/VerifyTier";
import type { ERC20BalanceTier } from "../typechain/ERC20BalanceTier";
import type { ERC20TransferTier } from "../typechain/ERC20TransferTier";
import type { CombineTier } from "../typechain/CombineTier";
import type { ERC721BalanceTier } from "../typechain/ERC721BalanceTier";

import {
  // Subgraph
  subgraph,
  // Signers
  deployer,
  creator,
  signer1,
  signer2,
  admin,
  // Contracts factories
  verifyFactory,
  verifyTierFactory,
  erc20BalanceTierFactory,
  erc20TransferTierFactory,
  combineTierFactory,
  erc721BalanceTierFactory,
  noticeBoard,
  gatedNFTFactory,
  saleFactory,
  trustFactory,
} from "./1_trustQueries.test";

let reserve: ReserveTokenTest, transaction: ContractTransaction;

describe("Subgraph Tier Test", function () {
  // before("deploy fresh test contracts", async function () {
  //   // New reserve token
  //   reserve = await new ReserveTokenTest__factory(deployer).deploy();
  // });

  describe("VerifyTier Factory - Queries", function () {
    let verify: Verify, verifyTier: VerifyTier;

    before("deploy fresh test contracts", async function () {
      // Creating a new Verify Child
      verify = await Util.verifyDeploy(verifyFactory, creator, {
        admin: admin.address,
        callback: zeroAddress,
      });

      // Admin grants all roles to himself.
      // ⚠️ NOTE: This is for testing purposes only ⚠️
      await verify.connect(admin).grantRole(Util.APPROVER, admin.address);
      await verify.connect(admin).grantRole(Util.REMOVER, admin.address);
      await verify.connect(admin).grantRole(Util.BANNER, admin.address);

      await waitForSubgraphToBeSynced();
    });

    it("should query VerifyTierFactory correctly after construction", async function () {
      // Get the VerifyTier implementation
      const implementation = await getImplementation(verifyTierFactory);

      const query = `
        {
          verifyTierFactory (id: "${verifyTierFactory.address.toLowerCase()}") {
            address
            implementation
          }
        }
      `;
      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.verifyTierFactory;

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
        query,
      })) as FetchResult;

      const data = response.data.verifyTierFactory;

      expect(data.children).deep.include({
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
        query,
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
        query,
      })) as FetchResult;

      const data = response.data.verifyTier.verifyContract;

      expect(data.id).to.equals(verify.address.toLowerCase());
      expect(data.address).to.equals(verify.address.toLowerCase());
      expect(data.deployer).to.equals(creator.address.toLowerCase());

      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTimestamp.toString());
      expect(data.factory.id).to.equals(verifyFactory.address.toLowerCase());

      // expect(data.verifyAddresses).to.be.empty;
    });

    it("should continue query if the Verify Address in VerifyTier is a non-Verify contract address", async function () {
      const nonVerifyAddress = zeroAddress;

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
        query,
      })) as FetchResult;
      const dataTier = response.data.verifyTier;
      const data = response.data.verifyTier.verifyContract;

      expect(dataTier.address).to.equals(verifyTier.address.toLowerCase());

      expect(data.id).to.equals(nonVerifyAddress.toLowerCase());
      expect(data.address).to.equals(nonVerifyAddress.toLowerCase());

      expect(data.deployBlock).to.equals("0");
      expect(data.deployTimestamp).to.equals("0");

      expect(data.deployer).to.equals(zeroAddress.toLowerCase());
      expect(data.factory).to.be.null;
      expect(data.verifyAddresses).to.be.empty;
    });

    it("should query a Verify that was deployed without the factory and it is in VerifyTier", async function () {
      // Verify deployed without factory
      const verifyIndependent = await new Verify__factory(deployer).deploy();

      await verifyIndependent.initialize({
        admin: admin.address,
        callback: zeroAddress,
      });

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
        query,
      })) as FetchResult;
      const dataTier = response.data.verifyTier;
      const data = response.data.verifyTier.verifyContract;

      expect(dataTier.address).to.equals(verifyTier.address.toLowerCase());

      expect(data.id).to.equals(verifyIndependent.address.toLowerCase());
      expect(data.address).to.equals(verifyIndependent.address.toLowerCase());

      // Is there any way to get this values if was deployed without the factory?
      expect(data.deployBlock).to.equals("0");
      expect(data.deployTimestamp).to.equals("0");

      expect(data.deployer).to.equals(zeroAddress.toLowerCase());
      expect(data.factory).to.null;
      expect(data.verifyAddresses).to.be.empty;
    });
  });

  describe("ERC20BalanceTier Factory - Queries", function () {
    let erc20BalanceTier: ERC20BalanceTier;

    before("deploy fresh test contracts", async function () {
      // Creating a new reserve token
      reserve = await new ReserveTokenTest__factory(deployer).deploy();
    });

    it("should query ERC20BalanceTierFactory correctly after construction", async function () {
      // Get the ERC20BalanceTier implementation
      const implementation = await getImplementation(erc20BalanceTierFactory);

      const query = `
        {
          erc20BalanceTierFactory  (id: "${erc20BalanceTierFactory.address.toLowerCase()}") {
            address
            implementation
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.erc20BalanceTierFactory;

      expect(data.implementation).to.equals(implementation.toLowerCase());
      expect(data.address).to.equals(
        erc20BalanceTierFactory.address.toLowerCase()
      );
    });

    it("should query the ERC20BalanceTier child from factory after creation", async function () {
      // Deploying the child
      erc20BalanceTier = await Util.erc20BalanceTierDeploy(
        erc20BalanceTierFactory,
        creator,
        {
          erc20: reserve.address,
          tierValues: LEVELS,
        }
      );

      await waitForSubgraphToBeSynced();

      const query = `
        {
          erc20BalanceTierFactory  (id: "${erc20BalanceTierFactory.address.toLowerCase()}") {
            children {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.erc20BalanceTierFactory;

      expect(data.children).deep.include({
        id: erc20BalanceTier.address.toLowerCase(),
      });
    });

    it("should query the ERC20BalanceTier correctly", async function () {
      const [deployBlock, deployTimestamp] = await getTxTimeblock(
        erc20BalanceTier.deployTransaction
      );

      const query = `
        {
          erc20BalanceTier   (id: "${erc20BalanceTier.address.toLowerCase()}") {
            address
            deployer
            deployBlock
            deployTimestamp
            token {
              id
            }
            tierValues
            factory {
              id
            }
            notices {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.erc20BalanceTier;

      expect(data.address).to.equals(erc20BalanceTier.address.toLowerCase());
      expect(data.deployer).to.equals(creator.address.toLowerCase());

      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTimestamp.toString());

      expect(data.token.id).to.equals(reserve.address.toLowerCase());
      expect(data.tierValues).to.eql(LEVELS);

      expect(data.notices).to.be.empty;
      expect(data.factory.id).to.equals(
        erc20BalanceTierFactory.address.toLowerCase()
      );
    });

    it("should query the ERC20 token used in tier contract correctly", async function () {
      const query = `
        {
          erc20 (id: "${reserve.address.toLowerCase()}") {
            name
            symbol
            decimals
            totalSupply
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.erc20;

      expect(data.name).to.equals(await reserve.name());
      expect(data.symbol).to.equals(await reserve.symbol());
      expect(data.decimals).to.equals(await reserve.decimals());
      expect(data.totalSupply).to.equals(await reserve.totalSupply());
    });

    it("should query Notice in ERC20BalanceTier correctly", async function () {
      const notices = [
        {
          subject: erc20BalanceTier.address,
          data: "0x01",
        },
      ];

      transaction = await noticeBoard.connect(signer1).createNotices(notices);

      // Waiting for sync
      await waitForSubgraphToBeSynced();

      const noticeId = `${erc20BalanceTier.address.toLowerCase()} - ${transaction.hash.toLowerCase()} - 0`;

      const query = `
        {
          erc20BalanceTier  (id: "${erc20BalanceTier.address.toLowerCase()}") {
            notices {
              id
            }
          }
          notice (id: "${noticeId}") {
            sender
            subject{
              id
            }
            data
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const dataTier = response.data.erc20BalanceTier.notices;
      const data = response.data.notice;

      expect(dataTier).deep.include({ id: noticeId });

      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.subject.id).to.equals(erc20BalanceTier.address.toLowerCase());
      expect(data.data).to.equals("0x01");
    });
  });

  describe("ERC20TransferTier Factory - Queries", function () {
    let erc20TransferTier: ERC20TransferTier;

    // Represent a counter for the members on each TierLevel. Should be used
    // after each setTier function with the correct upgrade/downgrade
    const membersCount: number[] = new Array(9).fill(0);

    before("deploy fresh test contracts", async function () {
      // Creating a new reserve token
      reserve = await new ReserveTokenTest__factory(deployer).deploy();
    });

    it("should query ERC20TransferTierFactory correctly after construction", async function () {
      // Get the ERC20TransferTier implementation
      const implementation = await getImplementation(erc20TransferTierFactory);

      const query = `
        {
          erc20TransferTierFactory (id: "${erc20TransferTierFactory.address.toLowerCase()}") {
            address
            implementation
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.erc20TransferTierFactory;

      expect(data.implementation).to.equals(implementation.toLowerCase());
      expect(data.address).to.equals(
        erc20TransferTierFactory.address.toLowerCase()
      );
    });

    it("should query the ERC20TransferTier child from factory after creation", async function () {
      erc20TransferTier = await Util.erc20TransferTierDeploy(
        erc20TransferTierFactory,
        creator,
        {
          erc20: reserve.address,
          tierValues: LEVELS,
        }
      );

      // Waiting for sync
      await waitForSubgraphToBeSynced();

      const query = `
        {
          erc20TransferTierFactory  (id: "${erc20TransferTierFactory.address.toLowerCase()}") {
            children {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.erc20TransferTierFactory;

      expect(data.children).deep.include({
        id: erc20TransferTier.address.toLowerCase(),
      });
    });

    it("should query the ERC20TransferTier correctly", async function () {
      const [deployBlock, deployTimestamp] = await getTxTimeblock(
        erc20TransferTier.deployTransaction
      );

      const query = `
        {
          erc20TransferTier   (id: "${erc20TransferTier.address.toLowerCase()}") {
            address
            deployer
            factory {
              id
            }
            token {
              id
            }
            deployBlock
            deployTimestamp
            tierValues
            tierChanges {
              id
            }
            notices {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;
      const data = response.data.erc20TransferTier;

      expect(data.address).to.equals(erc20TransferTier.address.toLowerCase());
      expect(data.deployer).to.equals(creator.address.toLowerCase());

      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTimestamp.toString());

      expect(data.tierValues).to.eql(LEVELS);

      expect(data.tierChanges).to.be.empty;
      expect(data.notices).to.be.empty;

      expect(data.token.id).to.equals(reserve.address.toLowerCase());
      expect(data.factory.id).to.equals(
        erc20TransferTierFactory.address.toLowerCase()
      );
    });

    it("should query the initial state on a TierLevels", async function () {
      const queryTier = `
        {
          erc20TransferTier (id: "${erc20TransferTier.address.toLowerCase()}") {
            tierLevels {
              id
            }
          }
        }
      `;

      const responseTier = (await subgraph({
        query: queryTier,
      })) as FetchResult;
      const dataTier = responseTier.data.erc20TransferTier;

      expect(dataTier.tierLevels).to.have.lengthOf(9); // From 0 to 8

      // Query each TierLevel (LEVEL 0 to LEVEL 8)
      for (let i = 0; i < 9; i++) {
        const level = i;
        const tierLevelId = `${erc20TransferTier.address.toLowerCase()} - ${level}`;
        const query = `
          {
            tierLevel (id: "${tierLevelId}") {
              tierLevel
              memberCount
              tierContractAddress
              tierContract {
                id
              }
            }
          }
        `;

        const response = (await subgraph({
          query,
        })) as FetchResult;
        const dataLoop = response.data.tierLevel;

        expect(dataTier.tierLevels).deep.include({ id: tierLevelId });

        expect(dataLoop.tierLevel).to.equals(level.toString());
        expect(dataLoop.memberCount).to.equals("0");
        expect(dataLoop.tierContractAddress).to.equals(
          erc20TransferTier.address.toLowerCase()
        );
        expect(dataLoop.tierContract.id).to.equals(
          erc20TransferTier.address.toLowerCase()
        );
      }
    });

    it("should query the TierChange after upgrade with setTier correctly", async function () {
      // Amount required to Level
      const desiredLevel = Tier.FIVE;
      const requiredTierFive = Util.amountToLevel(desiredLevel);

      // give to signer1 the exact amount for Tier FIVE
      await reserve.transfer(signer1.address, requiredTierFive);

      // set the tier FIVE
      await reserve
        .connect(signer1)
        .approve(erc20TransferTier.address, requiredTierFive);

      // Signer1 give tier FIVE to signer2
      transaction = await erc20TransferTier
        .connect(signer1)
        .setTier(signer2.address, desiredLevel, []);

      // Increasing the counter
      membersCount[desiredLevel]++;

      await waitForSubgraphToBeSynced();

      const { startTier, endTier } = (await getEventArgs(
        transaction,
        "TierChange",
        erc20TransferTier
      )) as TierChangeEvent["args"];

      assert(desiredLevel == endTier.toNumber(), `wrong endTier`);

      const tierChangeId = `${transaction.hash.toLowerCase()} - ${erc20TransferTier.address.toLowerCase()}`;
      const [changeBlock, changeTime] = await getTxTimeblock(transaction);

      const query = `
        {
          erc20TransferTier (id: "${erc20TransferTier.address.toLowerCase()}") {
            tierChanges {
              id
            }
          }
          tierChange (id: "${tierChangeId}") {
            sender
            account
            startTier
            endTier
            transactionHash
            changeblock
            changetimestamp
            tierContract {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const dataTier = response.data.erc20TransferTier;
      const data = response.data.tierChange;

      expect(dataTier.tierChanges).deep.include({ id: tierChangeId });

      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.account).to.equals(signer2.address.toLowerCase());
      expect(data.startTier).to.equals(startTier.toString());
      expect(data.endTier).to.equals(endTier.toString());

      expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
      expect(data.changeblock).to.equals(changeBlock.toString());
      expect(data.changetimestamp).to.equals(changeTime.toString());
      expect(data.tierContract.id).to.equals(
        erc20TransferTier.address.toLowerCase()
      );
    });

    it("should query the TierLevel after upgrade with setTier correctly", async function () {
      const { endTier } = (await getEventArgs(
        transaction,
        "TierChange",
        erc20TransferTier
      )) as TierChangeEvent["args"];

      // Convert to number since it is necessary to index
      const level = endTier.toNumber();

      const query = `
        {
          tierLevel (id: "${erc20TransferTier.address.toLowerCase()} - ${level}") {
            memberCount
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.tierLevel;

      expect(data.memberCount).to.equals(membersCount[level].toString());
    });

    it("should query the TierChange after downgrade with setTier correclty", async function () {
      const desiredLevel = Tier.FOUR;

      // Signer2 downgrade his Level
      transaction = await erc20TransferTier
        .connect(signer2)
        .setTier(signer2.address, desiredLevel, []);

      await waitForSubgraphToBeSynced();

      const { startTier, endTier } = (await getEventArgs(
        transaction,
        "TierChange",
        erc20TransferTier
      )) as TierChangeEvent["args"];

      // Fill the counter correcly
      membersCount[endTier.toNumber()]++;
      membersCount[startTier.toNumber()]--;

      assert(desiredLevel == endTier.toNumber(), `wrong endTier`);

      const query = `
        {
          tierChange  (id: "${transaction.hash.toLowerCase()} - ${erc20TransferTier.address.toLowerCase()}") {
            sender
            account
            startTier
            endTier
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.tierChange;

      expect(data.sender).to.equals(signer2.address.toLowerCase());
      expect(data.account).to.equals(signer2.address.toLowerCase());
      expect(data.startTier).to.equals(startTier.toString());
      expect(data.endTier).to.equals(endTier.toString());
    });

    it("should query the TierLevel after downgrade with setTier correctly", async function () {
      const { startTier: startLevel, endTier: endLevel } = (await getEventArgs(
        transaction,
        "TierChange",
        erc20TransferTier
      )) as TierChangeEvent["args"];

      const query = `
        {
          startLevel: tierLevel (id: "${erc20TransferTier.address.toLowerCase()} - ${startLevel}") {
            memberCount
          }
          endLevel: tierLevel (id: "${erc20TransferTier.address.toLowerCase()} - ${endLevel}") {
            memberCount
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data;

      expect(data.startLevel.memberCount).to.equals(
        membersCount[startLevel.toNumber()].toString()
      );
      expect(data.endLevel.memberCount).to.equals(
        membersCount[endLevel.toNumber()].toString()
      );
    });

    it("should query Notice in ERC20TransferTier correctly", async function () {
      const notices = [
        {
          subject: erc20TransferTier.address,
          data: "0x01",
        },
      ];

      transaction = await noticeBoard.connect(signer1).createNotices(notices);

      // Waiting for sync
      await waitForSubgraphToBeSynced();

      const noticeId = `${erc20TransferTier.address.toLowerCase()} - ${transaction.hash.toLowerCase()} - 0`;

      const query = `
        {
          erc20TransferTier   (id: "${erc20TransferTier.address.toLowerCase()}") {
            notices {
              id
            }
          }
          notice (id: "${noticeId}") {
            sender
            subject{
              id
            }
            data
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const dataTier = response.data.erc20TransferTier.notices;
      const data = response.data.notice;

      expect(dataTier).deep.include({ id: noticeId });

      expect(data.data).to.equals("0x01");
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.subject.id).to.equals(
        erc20TransferTier.address.toLowerCase()
      );
    });
  });

  describe("CombineTier Factory - Queries", function () {
    let combineTier: CombineTier;

    const sourceAlways = concat([op(OpcodeTier.ALWAYS)]);

    const stateConfigAlways: VMState = {
      sources: [sourceAlways],
      constants: [],
      stackLength: 2,
      argumentsLength: 0,
    };

    it("should query CombineTierFactory correctly", async function () {
      // Get the CombineTier implementation
      const implementation = await getImplementation(combineTierFactory);

      const query = `
        {
          combineTierFactory (id: "${combineTierFactory.address.toLowerCase()}"){
            address
            implementation
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.combineTierFactory;

      expect(data.address).to.equals(combineTierFactory.address.toLowerCase());
      expect(data.implementation).to.equals(implementation.toLowerCase());
    });

    it("should query the CombineTier child from factory after creation", async function () {
      combineTier = await Util.combineTierDeploy(
        combineTierFactory,
        creator,
        stateConfigAlways
      );

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
        query,
      })) as FetchResult;

      const data = queryResponse.data.combineTierFactory;

      expect(data.children).deep.include({
        id: combineTier.address.toLowerCase(),
      });
    });

    it("should query the CombineTier correctly", async function () {
      const [deployBlock, deployTimestamp] = await getTxTimeblock(
        combineTier.deployTransaction
      );

      const stateId = combineTier.deployTransaction.hash.toLowerCase();

      const query = `
        {
          combineTier (id: "${combineTier.address.toLowerCase()}") {
            address
            deployer
            deployBlock
            deployTimestamp
            factory {
              id
            }
            state {
              id
            }
            notices {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.combineTier;

      expect(data.address).to.equals(combineTier.address.toLowerCase());
      expect(data.deployer).to.equals(creator.address.toLowerCase());
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTimestamp.toString());

      expect(data.notices).to.be.empty;
      expect(data.state.id).to.equals(stateId);
      expect(data.factory.id).to.equals(
        combineTierFactory.address.toLowerCase()
      );
    });

    it("should query the State present on CombineTier correclty", async function () {
      const stateId = `${combineTier.deployTransaction.hash.toLowerCase()}`;

      const { state: stateExpected } = (await getEventArgs(
        combineTier.deployTransaction,
        "Snapshot",
        combineTier
      )) as SnapshotEvent["args"];

      const arrayToString = (arr: BigNumber[]): string[] => {
        return arr.map((x: BigNumber) => x.toString());
      };

      // Using the values form Event
      const stackIndexExpected = stateExpected.stackIndex.toString();
      const stackExpected = arrayToString(stateExpected.stack);
      const sourcesExpected = stateExpected.sources;
      const constantsExpected = arrayToString(stateExpected.constants);
      const argumentsExpected = arrayToString(stateExpected.arguments);

      const query = `
        {
          state (id: "${stateId}") {
            stackIndex
            stack
            sources
            constants
            arguments
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.state;

      expect(data.stackIndex).to.equals(stackIndexExpected);
      expect(data.stack).to.eql(stackExpected);
      expect(data.sources).to.eql(sourcesExpected);
      expect(data.constants).to.eql(constantsExpected);
      expect(data.arguments).to.eql(argumentsExpected);
    });

    it("should query Notice in CombineTier correctly", async function () {
      const notices = [
        {
          subject: combineTier.address,
          data: "0x01",
        },
      ];

      transaction = await noticeBoard.connect(signer1).createNotices(notices);

      // Waiting for sync
      await waitForSubgraphToBeSynced();

      const noticeId = `${combineTier.address.toLowerCase()} - ${transaction.hash.toLowerCase()} - 0`;

      const query = `
        {
          combineTier (id: "${combineTier.address.toLowerCase()}") {
            notices {
              id
            }
          }
          notice (id: "${noticeId}") {
            sender
            subject{
              id
            }
            data
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const dataTier = response.data.combineTier.notices;
      const data = response.data.notice;

      expect(dataTier).deep.include({ id: noticeId });

      expect(data.data).to.equals("0x01");
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.subject.id).to.equals(combineTier.address.toLowerCase());
    });
  });

  describe("ERC721BalanceTier Factory - Queries", function () {
    let erc721BalanceTier: ERC721BalanceTier, reserveNFT: ReserveNFT;

    before("deploy fresh test contracts", async function () {
      // Creating a new reserve token
      reserveNFT = await new ReserveNFT__factory(deployer).deploy();
    });

    it("should query ERC721BalanceTierFactory correctly", async function () {
      const implementation = await getImplementation(erc721BalanceTierFactory);

      const query = `
        {
          erc721BalanceTierFactory (id: "${erc721BalanceTierFactory.address.toLowerCase()}") {
            address
            implementation
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.erc721BalanceTierFactory;

      expect(data.implementation).to.equals(implementation.toLocaleLowerCase());
      expect(data.address).to.equals(
        erc721BalanceTierFactory.address.toLowerCase()
      );
    });

    it("should query the ERC721BalanceTier child from factory after creation", async function () {
      erc721BalanceTier = await Util.erc721BalanceTierDeploy(
        erc721BalanceTierFactory,
        creator,
        {
          erc721: reserveNFT.address,
          tierValues: LEVELS,
        }
      );

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
        query,
      })) as FetchResult;

      const data = queryResponse.data.erc721BalanceTierFactory;

      expect(data.children).deep.include({
        id: erc721BalanceTier.address.toLowerCase(),
      });
    });

    it("should query the ERC721BalanceTier correctly", async function () {
      const [deployBlock, deployTimestamp] = await getTxTimeblock(
        erc721BalanceTier.deployTransaction
      );

      const query = `
        {
          erc721BalanceTier (id: "${erc721BalanceTier.address.toLowerCase()}") {
            address
            deployer
            deployBlock
            deployTimestamp
            tierValues
            factory {
              id
            }
            token {
              id
            }
            notices {
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.erc721BalanceTier;

      expect(data.address).to.equals(erc721BalanceTier.address.toLowerCase());
      expect(data.deployer).to.equals(creator.address.toLowerCase());
      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTimestamp.toString());

      expect(data.notices).to.be.empty;
      expect(data.tierValues).to.eql(LEVELS);
      expect(data.token.id).to.equals(reserveNFT.address.toLowerCase());
      expect(data.factory.id).to.equals(
        erc721BalanceTierFactory.address.toLowerCase()
      );
    });

    it("should query the ERC721-NFT of the ERC721BalanceTier correctly", async function () {
      // On this TX is where the reference to the ERC721 token start
      const [deployBlock, deployTimestamp] = await getTxTimeblock(
        erc721BalanceTier.deployTransaction
      );

      const query = `
        {
          erc721 (id: "${reserveNFT.address.toLowerCase()}") {
            name
            symbol
            totalSupply
            deployBlock
            deployTimestamp
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.erc721;

      expect(data.name).to.equals(await reserveNFT.name());
      expect(data.symbol).to.equals(await reserveNFT.symbol());
      expect(data.totalSupply).to.equals(await reserveNFT.totalSupply());

      expect(data.deployBlock).to.equals(deployBlock.toString());
      expect(data.deployTimestamp).to.equals(deployTimestamp.toString());
    });

    it("should query Notice in CombineTier correctly", async function () {
      const notices = [
        {
          subject: erc721BalanceTier.address,
          data: "0x01",
        },
      ];

      transaction = await noticeBoard.connect(signer1).createNotices(notices);

      // Waiting for sync
      await waitForSubgraphToBeSynced();

      const noticeId = `${erc721BalanceTier.address.toLowerCase()} - ${transaction.hash.toLowerCase()} - 0`;

      const query = `
        {
          erc721BalanceTier (id: "${erc721BalanceTier.address.toLowerCase()}") {
            notices {
              id
            }
          }
          notice (id: "${noticeId}") {
            sender
            subject{
              id
            }
            data
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const dataTier = response.data.erc721BalanceTier.notices;
      const data = response.data.notice;

      expect(dataTier).deep.include({ id: noticeId });

      expect(data.data).to.equals("0x01");
      expect(data.sender).to.equals(signer1.address.toLowerCase());
      expect(data.subject.id).to.equals(
        erc721BalanceTier.address.toLowerCase()
      );
    });
  });

  describe("UnknownTiers - Queries", function () {
    // It will work with any Tier Contract deployed without any the indexed Tier Factories
    // Deploying an `ERC20BalanceTier` independient that should be Unknown in all Entities
    let tierIndependent: ERC20BalanceTier;

    before("deploy independent tier contract", async function () {
      // Creating a new reserve ERC20 token
      reserve = await new ReserveTokenTest__factory(deployer).deploy();

      // Deploy and initialize an Independent Tier
      tierIndependent = await new ERC20BalanceTier__factory(deployer).deploy();

      await tierIndependent.initialize({
        erc20: reserve.address,
        tierValues: LEVELS,
      });
    });

    it("should be UnknownTier when used in a GatedNFT contract", async function () {
      const configGated = {
        name: "TestSubgraph",
        symbol: "TESTSG",
        description: "Testing Subgraph",
        animationUrl:
          "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy",
        imageUrl:
          "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy",
        animationHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        imageHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
      };

      const gatedNFT = await Util.gatedNFTDeploy(
        gatedNFTFactory,
        creator,
        configGated,
        tierIndependent.address,
        1,
        1,
        1,
        100,
        signer1.address,
        1
      );

      await waitForSubgraphToBeSynced();

      const query = `
        {
          gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
            tier {
              __typename
              ... on UnknownTier {
                id
              }
            }
          }
          unknownTier (id: "${tierIndependent.address.toLowerCase()}") {
            address
            deployer
            deployBlock
            deployTimestamp
            factory {
              id
            }
            notices {
              id
            }
          }
        }
      `;
      const response = (await subgraph({
        query,
      })) as FetchResult;

      const dataGated = response.data.gatedNFT.tier;
      const data = response.data.unknownTier;

      expect(dataGated.id).to.equals(tierIndependent.address.toLowerCase());
      expect(dataGated.__typename).to.equals("UnknownTier");

      expect(data.factory).to.be.null;
      expect(data.notices).to.be.empty;

      expect(data.address).to.equals(tierIndependent.address.toLowerCase());
      expect(data.deployer).to.equals(zeroAddress);
      expect(data.deployBlock).to.equals("0");
      expect(data.deployTimestamp).to.equals("0");
    });

    it("should be an UnknownTier when used in a Trust contract", async function () {
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

      const trust = await Util.trustDeploy(
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
          tier: tierIndependent.address,
          minimumTier,
        },
        {
          seeder: zeroAddress,
          cooldownDuration: seederCooldownDuration,
          erc20Config: seedERC20Config,
        },
        { gasLimit: 15000000 }
      );

      await waitForSubgraphToBeSynced();

      const query = `
        {
          trust (id: "${trust.address.toLowerCase()}") {
            contracts {
              tier {
                __typename
                ... on UnknownTier {
                  id
                }
              }
              redeemableERC20 {
                tier {
                  __typename
                  ... on UnknownTier {
                    id
                  }
                }
              }
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const dataTier = response.data.trust.contracts.tier;
      const dataRedeem = response.data.trust.contracts.redeemableERC20.tier;

      expect(dataTier.__typename).to.equals("UnknownTier");
      expect(dataTier.id).to.equals(tierIndependent.address.toLowerCase());

      expect(dataRedeem.__typename).to.equals("UnknownTier");
      expect(dataRedeem.id).to.equals(tierIndependent.address.toLowerCase());
    });

    it("should be an UnknownTier when used in a SaleRedeemableERC20", async function () {
      const afterBlockNumberConfig = (blockNumber: number) => {
        return {
          sources: [
            concat([
              // (BLOCK_NUMBER blockNumberSub1 gt)
              op(OpcodeSale.BLOCK_NUMBER),
              op(OpcodeSale.VAL, 0),
              op(OpcodeSale.GREATER_THAN),
            ]),
          ],
          constants: [blockNumber - 1],
          stackLength: 3,
          argumentsLength: 0,
        };
      };

      const saleTimeout = 30;
      const startBlock = (await ethers.provider.getBlockNumber()) + 5;

      const staticPrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);
      const vBasePrice = op(OpcodeSale.VAL, 0);
      const constants = [staticPrice];
      const sources = [concat([vBasePrice])];

      // SaleConfig
      const canStartStateConfig = afterBlockNumberConfig(startBlock);
      const canEndStateConfig = afterBlockNumberConfig(
        startBlock + saleTimeout
      );
      const calculatePriceStateConfig = {
        sources,
        constants,
        stackLength: 1,
        argumentsLength: 0,
      };
      const cooldownDuration = 1;
      const minimumRaise = ethers.BigNumber.from("150000").mul(
        Util.RESERVE_ONE
      );
      const dustSize = 0;

      // SaleRedeemableERC20Config
      const redeemableERC20Config = {
        name: "Token",
        symbol: "TKN",
        distributor: zeroAddress,
        initialSupply: ethers.BigNumber.from("2000").mul(Util.ONE),
      };
      const minimumTier = Tier.ZERO;
      const distributionEndForwardingAddress = ethers.constants.AddressZero;

      const sale = await Util.saleDeploy(
        saleFactory,
        creator,
        {
          canStartStateConfig,
          canEndStateConfig,
          calculatePriceStateConfig,
          recipient: signer1.address,
          reserve: reserve.address,
          cooldownDuration,
          minimumRaise,
          dustSize,
          saleTimeout: 100,
        },
        {
          erc20Config: redeemableERC20Config,
          tier: tierIndependent.address,
          minimumTier,
          distributionEndForwardingAddress,
        }
      );

      await waitForSubgraphToBeSynced();

      const redeemableERC20Address = await sale.token();

      const query = `
        {
          redeemableERC20(id: "${redeemableERC20Address.toLowerCase()}") {
            tier {
              __typename
              id
            }
          }
        }
      `;

      const response = (await subgraph({
        query,
      })) as FetchResult;

      const data = response.data.redeemableERC20.tier;

      expect(data.__typename).to.equals("UnknownTier");
      expect(data.id).to.equals(tierIndependent.address.toLowerCase());
    });
  });
});
