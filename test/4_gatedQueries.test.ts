/* eslint-disable node/no-missing-import */
/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */

import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractTransaction } from "ethers";
import { ApolloFetch, FetchResult } from "apollo-fetch";
import * as path from "path";
import * as Util from "./utils/utils";
import { deploy, waitForSubgraphToBeSynced, LEVELS } from "./utils/utils";

import gatedNFTJson from "@beehiveinnovation/rain-statusfi/artifacts/contracts/GatedNFT.sol/GatedNFT.json";
import reserveToken from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveToken.sol/ReserveToken.json";
import readWriteTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ReadWriteTier.sol/ReadWriteTier.json";
import erc20BalanceTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ERC20BalanceTier.sol/ERC20BalanceTier.json";

import { GatedNFT } from "@beehiveinnovation/rain-statusfi/typechain/GatedNFT";
import { ReserveToken } from "@beehiveinnovation/rain-protocol/typechain/ReserveToken";
import { ReadWriteTier } from "@beehiveinnovation/rain-protocol/typechain/ReadWriteTier";
import { ERC20BalanceTier } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTier";

import {
  deployer,
  signer1,
  signer2,
  gatedNFTFactory,
  erc20BalanceTierFactory,
} from "./1_trustQueries.test";

let subgraph: ApolloFetch,
  reserve: ReserveToken,
  tier: ReadWriteTier,
  erc20BalanceTier: ERC20BalanceTier,
  gatedNFT: GatedNFT,
  transaction: ContractTransaction; // use to save/facilite a tx;

// Properties of the GatedNFT
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
const minimumStatus = 1;
const maxPerAddress = 1;
const transferrable = 0;
const maxMintable = 100;
let royaltyRecipient;
const royaltyBPS = 1;

describe("Subgraph GatedNFT test", function () {
  before("creating and connecting", async function () {
    const localInfoPath = path.resolve(__dirname, "./utils/local_Info.json");
    const localInfoJson = JSON.parse(Util.fetchFile(localInfoPath));

    royaltyRecipient = signer1.address;

    reserve = (await deploy(reserveToken, deployer, [])) as ReserveToken;
    tier = (await deploy(readWriteTierJson, deployer, [])) as ReadWriteTier;

    transaction = await erc20BalanceTierFactory.createChildTyped({
      erc20: reserve.address,
      tierValues: LEVELS,
    });

    erc20BalanceTier = (await Util.getContractChild(
      transaction,
      erc20BalanceTierFactory,
      erc20BalanceTierJson
    )) as ERC20BalanceTier;

    // Giving the necessary amount to signer1 for a level 2
    const level2 = LEVELS[1];
    await reserve.transfer(signer1.address, level2);

    // Connecting to the subgraph
    subgraph = Util.fetchSubgraph(
      localInfoJson.subgraphUser,
      localInfoJson.subgraphName
    );
  });

  it("should query GatedNFTFactory correctly after construction", async function () {
    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(500);

    const implementation = (
      await Util.getEventArgs(
        gatedNFTFactory.deployTransaction,
        "Implementation",
        gatedNFTFactory
      )
    ).implementation;

    const query = `
      {
        gatedNFTFactories {
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

    expect(data.id).to.equals(gatedNFTFactory.address.toLowerCase());
    expect(data.address).to.equals(gatedNFTFactory.address.toLowerCase());
    expect(data.implementation).to.equals(implementation.toLowerCase());
    expect(data.children).to.be.empty;
  });

  it("should query the GatedNFT child from factory after creation", async function () {
    transaction = await gatedNFTFactory.createChildTyped(
      configGated,
      erc20BalanceTier.address,
      minimumStatus,
      maxPerAddress,
      transferrable,
      maxMintable,
      royaltyRecipient,
      royaltyBPS
    );

    gatedNFT = (await Util.getContractChild(
      transaction,
      gatedNFTFactory,
      gatedNFTJson
    )) as GatedNFT;

    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(1000);

    const query = `
      {
        gatedNFTFactory (id: "${gatedNFTFactory.address.toLowerCase()}") {
          children {
            id
          }
        }
      }
    `;

    const queryResponse = (await subgraph({
      query: query,
    })) as FetchResult;

    const data = queryResponse.data.gatedNFTFactory;

    expect(data.children).to.have.lengthOf(1);
    expect(data.children[0].id).to.equals(gatedNFT.address.toLowerCase());
  });

  it("should query the GatedNFT correctly after creation", async function () {
    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(500);

    // The signer assigned to the instance
    const creatorExpected = await gatedNFTFactory.signer.getAddress();
    const ownerExpected = await gatedNFTFactory.signer.getAddress();

    const query = `
      {
        gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
          address
          creator
          tier {
            id
          }
          owner
          royaltyRecipientHistory
        }
      }
    `;

    const queryResponse = (await subgraph({
      query: query,
    })) as FetchResult;

    const data = queryResponse.data.gatedNFT;

    expect(data.address).to.equals(gatedNFT.address.toLowerCase());
    expect(data.creator).to.equals(creatorExpected.toLowerCase());
    expect(data.tier.id).to.equals(erc20BalanceTier.address.toLowerCase());
    expect(data.owner).to.equals(ownerExpected.toLowerCase());

    expect(data.royaltyRecipientHistory).to.be.empty;
  });

  it("should query the GatedNFT properties information correctly after creation", async function () {
    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(500);

    const query = `
      {
        gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
          name
          symbol
          description
          animationUrl
          imageUrl
          animationHash
          imageHash
        }
      }
    `;

    const queryResponse = (await subgraph({
      query: query,
    })) as FetchResult;

    const data = queryResponse.data.gatedNFT;

    expect(data.name).to.equals(configGated.name);
    expect(data.symbol).to.equals(configGated.symbol);
    expect(data.description).to.equals(configGated.description);

    expect(data.animationUrl).to.equals(configGated.animationUrl);
    expect(data.imageUrl).to.equals(configGated.imageUrl);
    expect(data.animationHash).to.equals(configGated.animationHash);
    expect(data.imageHash).to.equals(configGated.imageHash);
  });

  it("should query the GatedNFT configuration information correctly after creation", async function () {
    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(500);

    const royaltyPercentExpected = royaltyBPS / 100;
    const query = `
      {
        gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
          minimumStatus
          maxPerAddress
          transferrable
          maxMintable
          royaltyRecipient
          royaltyBPS
          royaltyPercent
        }
      }
    `;

    const queryResponse = (await subgraph({
      query: query,
    })) as FetchResult;

    const data = queryResponse.data.gatedNFT;

    expect(data.minimumStatus).to.equals(minimumStatus.toString());
    expect(data.maxPerAddress).to.equals(maxPerAddress.toString());
    expect(data.transferrable).to.equals(transferrable.toString());
    expect(data.maxMintable).to.equals(maxMintable.toString());

    expect(data.royaltyRecipient).to.equals(royaltyRecipient.toLowerCase());
    expect(data.royaltyBPS).to.equals(royaltyBPS.toString());
    expect(data.royaltyPercent).to.equals(royaltyPercentExpected.toString());
  });

  it("should query the initial owner correctly", async function () {
    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(500);

    // The signer assigned to the instance
    const senderExpected = await gatedNFTFactory.signer.getAddress();
    const newOwnerExpected = await gatedNFTFactory.signer.getAddress();
    const query = `
      {
        gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
          ownershipHistory {
            id
          }
        }
        ownershipTransferred (id: "${transaction.hash.toLowerCase()}") {
          emitter: Bytes! #contract that emitted the event
          sender: Bytes! #sender of the tx
          oldOwner: Bytes! #from event.oldOwner
          newOwner: Bytes! #from event.newOwner
          block
          timestamp
        }
      }
    `;

    const queryResponse = (await subgraph({
      query: query,
    })) as FetchResult;

    const dataGated = queryResponse.data.gatedNFT.ownershipHistory;
    const dataOwnership = queryResponse.data.gatedNFT.ownershipTransferred;

    expect(dataGated).to.have.lengthOf(1);
    expect(dataGated[0]).to.equals(transaction.hash.toLowerCase());

    expect(dataOwnership.emitter).to.equals(gatedNFT.address.toLowerCase());
    expect(dataOwnership.sender).to.equals(senderExpected.toLowerCase());

    expect(dataOwnership.oldOwner).to.equals(Util.zeroAddress.toLowerCase());
    expect(dataOwnership.newOwner).to.equals(newOwnerExpected.toLowerCase());

    expect(dataOwnership.block).to.equals(transaction.blockNumber.toString());
    expect(dataOwnership.timestamp).to.equals(transaction.timestamp.toString());
    // block
    // timestamp
  });

  it("should query correctly after an updateRoyaltyRecipient", async function () {
    // Updating the RoyaltyRecipient
    transaction = await gatedNFT
      .connect(signer1)
      .updateRoyaltyRecipient(signer2.address);

    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(1000);

    const query = `
      {
        gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
          royaltyRecipient
          royaltyRecipientHistory {
            id
          }
        }
        updatedRoyaltyRecipient (id: "${transaction.hash.toLowerCase()}") {
          nftContract {
            address
          }
          origin: Bytes! #event.transaction.from
          newRoyaltyRecipient
          block
          timestamp
        }
      }
    `;

    const queryResponse = (await subgraph({
      query: query,
    })) as FetchResult;

    const dataGate = queryResponse.data.gatedNFT;
    const dataUpdatedRoyalty = queryResponse.data.updatedRoyaltyRecipient;

    expect(dataGate.royaltyRecipient).to.equals(signer2.address.toLowerCase());
    expect(dataGate.royaltyRecipientHistory).to.have.lengthOf(1);

    expect(dataUpdatedRoyalty.origin).to.equals(signer1.address.toLowerCase());
    expect(dataUpdatedRoyalty.nftContract.address).to.equals(
      gatedNFT.address.toLowerCase()
    );
    expect(dataUpdatedRoyalty.newRoyaltyRecipient).to.equals(
      signer2.address.toLowerCase()
    );
    expect(dataUpdatedRoyalty.block).to.equals(
      transaction.blockNumber.toString()
    );
    expect(dataUpdatedRoyalty.timestamp).to.equals(
      transaction.timestamp.toString()
    );
  });

  it("should query correctly after a transferOwnership");
});
