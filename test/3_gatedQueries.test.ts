import { expect } from "chai";
import * as Util from "./utils/utils";
import { waitForSubgraphToBeSynced } from "./utils/utils";

// Typechain Factories
import { ReserveTokenTest__factory } from "../typechain/factories/ReserveTokenTest__factory";

// Types
import type { FetchResult } from "apollo-fetch";
import type { ContractTransaction } from "ethers";
import type { GatedNFT, TransferEvent } from "../typechain/GatedNFT";
import type { ReserveTokenTest } from "../typechain/ReserveTokenTest";
import type { ERC20BalanceTier } from "../typechain/ERC20BalanceTier";

import {
  // Subgraph
  subgraph,
  // Signers
  deployer,
  signer1,
  signer2,
  // Factories
  gatedNFTFactory,
  erc20BalanceTierFactory,
  noticeBoard,
} from "./1_trustQueries.test";

let reserve: ReserveTokenTest,
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
const transferrable = 1;
const maxMintable = 100;
let royaltyRecipient: string;
const royaltyBPS = 1;

describe("Subgraph GatedNFT test", function () {
  before("creating and connecting", async function () {
    royaltyRecipient = signer1.address;

    reserve = await new ReserveTokenTest__factory(deployer).deploy();

    erc20BalanceTier = await Util.erc20BalanceTierDeploy(
      erc20BalanceTierFactory,
      deployer,
      {
        erc20: reserve.address,
        tierValues: Util.LEVELS,
      }
    );

    // Giving the necessary amount to signer1 and signer2 for a level 2
    await reserve.transfer(signer1.address, Util.amountToLevel(Util.Tier.TWO));
    await reserve.transfer(signer2.address, Util.amountToLevel(Util.Tier.TWO));

    // Wait for sync
    // await waitForSubgraphToBeSynced();
  });

  it("should query GatedNFTFactory correctly after construction", async function () {
    const implementation = await Util.getImplementation(gatedNFTFactory);

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
      query,
    })) as FetchResult;

    const data = queryResponse.data.gatedNFTFactories[0];

    expect(queryResponse.data.gatedNFTFactories).to.have.lengthOf(1);

    expect(data.id).to.equals(gatedNFTFactory.address.toLowerCase());
    expect(data.address).to.equals(gatedNFTFactory.address.toLowerCase());
    expect(data.implementation).to.equals(implementation.toLowerCase());
    expect(data.children).to.be.empty;
  });

  it("should query the GatedNFT child from factory after creation", async function () {
    // Deploying the GatedNFT Child
    gatedNFT = await Util.gatedNFTDeploy(
      gatedNFTFactory,
      signer1,
      configGated,
      erc20BalanceTier.address,
      minimumStatus,
      maxPerAddress,
      transferrable,
      maxMintable,
      royaltyRecipient,
      royaltyBPS
    );

    await waitForSubgraphToBeSynced();

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
      query,
    })) as FetchResult;

    const data = queryResponse.data.gatedNFTFactory;

    expect(data.children).to.have.lengthOf(1);
    expect(data.children[0].id).to.equals(gatedNFT.address.toLowerCase());
  });

  it("should query the GatedNFT correctly after creation", async function () {
    const [deployBlock, deloyTimestamp] = await Util.getTxTimeblock(
      gatedNFT.deployTransaction
    );
    // The signer use to call the factory
    const creatorExpected = signer1.address;
    const ownerExpected = signer1.address;

    const query = `
      {
        gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
          id
          address
          creator
          owner
          tokensMinted
          royaltyRecipientHistory{
            id
          }
          gatedTokens {
            id
          }
          gatedTokenOwners {
            id
          }
          deployBlock
          deployTimestamp
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;
    const data = queryResponse.data.gatedNFT;

    expect(data.royaltyRecipientHistory).to.be.empty;
    expect(data.gatedTokens).to.be.empty;
    expect(data.gatedTokenOwners).to.be.empty;

    expect(data.tokensMinted).to.equals(await gatedNFT.totalSupply());
    expect(data.address).to.equals(gatedNFT.address.toLowerCase());
    expect(data.creator).to.equals(creatorExpected.toLowerCase());
    expect(data.owner).to.equals(ownerExpected.toLowerCase());

    expect(data.deployBlock).to.equals(deployBlock.toString());
    expect(data.deployTimestamp).to.equals(deloyTimestamp.toString());
  });

  it("should query the tier contract in GatedNFT correctly", async function () {
    const query = `
      {
        gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
          tier {
            id
            address
            deployer
            factory {
              id
            }
          }
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;

    const data = queryResponse.data.gatedNFT.tier;

    expect(data.id).to.equals(erc20BalanceTier.address.toLowerCase());
    expect(data.address).to.equals(erc20BalanceTier.address.toLowerCase());
    expect(data.deployer).to.equals(deployer.address.toLowerCase());
    expect(data.factory.id).to.equals(
      erc20BalanceTierFactory.address.toLowerCase()
    );
  });

  it("should query the GatedNFT properties information correctly after creation", async function () {
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
      query,
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
      query,
    })) as FetchResult;

    const data = queryResponse.data.gatedNFT;

    expect(data.minimumStatus).to.equals(minimumStatus.toString());
    expect(data.maxPerAddress).to.equals(maxPerAddress.toString());
    expect(data.transferrable).to.equals(transferrable);
    expect(data.maxMintable).to.equals(maxMintable.toString());

    expect(data.royaltyRecipient).to.equals(royaltyRecipient.toLowerCase());
    expect(data.royaltyBPS).to.equals(royaltyBPS.toString());
    expect(data.royaltyPercent).to.equals(royaltyPercentExpected.toString());
  });

  it("should query the initial owner correctly", async function () {
    // The signer assigned to the instance
    const senderExpected = signer1.address;
    const newOwnerExpected = signer1.address;

    const ownershipTransferId = gatedNFT.deployTransaction.hash.toLowerCase();

    const [deployBlock, deloyTimestamp] = await Util.getTxTimeblock(
      gatedNFT.deployTransaction
    );

    const query = `
      {
        gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
          ownershipHistory {
            id
          }
        }
        ownershipTransferred (id: "${ownershipTransferId}") {
          emitter
          sender
          oldOwner
          newOwner
          block
          timestamp
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;

    const dataGated = queryResponse.data.gatedNFT.ownershipHistory;
    const data = queryResponse.data.ownershipTransferred;

    expect(dataGated).deep.include({ id: ownershipTransferId });

    expect(data.emitter).to.equals(gatedNFT.address.toLowerCase());
    expect(data.sender).to.equals(senderExpected.toLowerCase());

    expect(data.oldOwner).to.equals(gatedNFTFactory.address.toLowerCase());
    expect(data.newOwner).to.equals(newOwnerExpected.toLowerCase());

    expect(data.block).to.equals(deployBlock.toString());
    expect(data.timestamp).to.equals(deloyTimestamp.toString());
  });

  it("should query correctly after an updateRoyaltyRecipient", async function () {
    // Updating the RoyaltyRecipient
    transaction = await gatedNFT
      .connect(signer1)
      .updateRoyaltyRecipient(signer2.address);

    const [deployBlock, deloyTime] = await Util.getTxTimeblock(transaction);

    await waitForSubgraphToBeSynced();

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
          origin
          newRoyaltyRecipient
          block
          timestamp
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
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
    expect(dataUpdatedRoyalty.block).to.equals(deployBlock.toString());
    expect(dataUpdatedRoyalty.timestamp).to.equals(deloyTime.toString());
  });

  it("should query correctly after a transferOwnership", async function () {
    // Call to transfer ownership
    transaction = await gatedNFT
      .connect(signer1)
      .transferOwnership(signer2.address);

    const ownershipTransferId = transaction.hash.toLowerCase();
    const [deployBlock, deloyTime] = await Util.getTxTimeblock(transaction);

    await waitForSubgraphToBeSynced();

    const query = `
      {
        gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
          owner
          ownershipHistory {
            id
          }
        }
        ownershipTransferred (id: "${ownershipTransferId}") {
          block
          timestamp
          emitter
          sender
          oldOwner
          newOwner
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;

    const dataGate = queryResponse.data.gatedNFT;
    const dataOwnership = queryResponse.data.ownershipTransferred;

    expect(dataGate.owner).to.equals(signer2.address.toLowerCase());
    expect(dataGate.ownershipHistory).to.have.lengthOf(2);
    expect(dataGate.ownershipHistory).to.deep.include({
      id: ownershipTransferId,
    });

    expect(dataOwnership.emitter).to.equals(gatedNFT.address.toLowerCase());
    expect(dataOwnership.sender).to.equals(signer1.address.toLowerCase());
    expect(dataOwnership.oldOwner).to.equals(signer1.address.toLowerCase());
    expect(dataOwnership.newOwner).to.equals(signer2.address.toLowerCase());

    expect(dataOwnership.block).to.equals(deployBlock.toString());
    expect(dataOwnership.timestamp).to.equals(deloyTime.toString());
  });

  it("should continue querying if a non-ITier address is provide as TierContract", async function () {
    // Deploying new GatedNFT Child with non-ITier address
    const gatedWrongTier = await Util.gatedNFTDeploy(
      gatedNFTFactory,
      signer1,
      configGated,
      Util.zeroAddress,
      minimumStatus,
      maxPerAddress,
      transferrable,
      maxMintable,
      royaltyRecipient,
      royaltyBPS
    );

    await waitForSubgraphToBeSynced();

    const query = `
      {
        gatedNFTFactory (id: "${gatedNFTFactory.address.toLowerCase()}") {
          children {
            id
          }
        }
        gatedNFT (id: "${gatedWrongTier.address.toLowerCase()}") {
          address
          tier {
            id
          }
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;

    const dataFactory = queryResponse.data.gatedNFTFactory;
    const dataGate = queryResponse.data.gatedNFT;

    expect(dataFactory.children).to.have.lengthOf(2);
    expect(dataFactory.children).to.deep.include({
      id: gatedWrongTier.address.toLowerCase(),
    });

    expect(dataGate.address).to.equals(gatedWrongTier.address.toLowerCase());
    expect(dataGate.tier.id).to.equals(Util.zeroAddress.toLowerCase());
  });

  it("should query Notice in GatedNFT correctly", async function () {
    const notices = [
      {
        subject: gatedNFT.address,
        data: "0x01",
      },
    ];

    transaction = await noticeBoard.connect(signer1).createNotices(notices);

    const noticeId = `${gatedNFT.address.toLowerCase()} - ${transaction.hash.toLowerCase()} - 0`;
    await waitForSubgraphToBeSynced();

    const query = `
      {
        gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
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

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;
    const dataGatedNFT = queryResponse.data.gatedNFT.notices;
    const dataNotice = queryResponse.data.notice;

    expect(dataGatedNFT).deep.include({ id: noticeId });

    expect(dataNotice.sender).to.equals(signer1.address.toLowerCase());
    expect(dataNotice.subject.id).to.equals(gatedNFT.address.toLowerCase());
    expect(dataNotice.data).to.equals("0x01");
  });

  it("should update the GatedNFT after mint", async function () {
    transaction = await gatedNFT.connect(signer1).mint(signer1.address);

    const { to, tokenId } = (await Util.getEventArgs(
      transaction,
      "Transfer",
      gatedNFT
    )) as TransferEvent["args"];

    const gatedTokenId = `${gatedNFT.address.toLowerCase()} - ${tokenId.toString()}`;
    const gatedTokenOwnerId = `${gatedNFT.address.toLowerCase()} - ${to.toLowerCase()}`;

    await waitForSubgraphToBeSynced();

    const query = `
      {
        gatedNFT (id: "${gatedNFT.address.toLowerCase()}") {
          tokensMinted
          gatedTokens {
            id
          }
          gatedTokenOwners {
            id
          }
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;
    const data = queryResponse.data.gatedNFT;

    expect(data.tokensMinted).to.equals(await gatedNFT.totalSupply());

    expect(data.gatedTokens).to.deep.include({ id: gatedTokenId });
    expect(data.gatedTokenOwners).to.deep.include({ id: gatedTokenOwnerId });
  });

  it("should query the GatedToken correctly after mint", async function () {
    const [mintBlock, mintTimestamp] = await Util.getTxTimeblock(transaction);

    const { to: owner, tokenId } = (await Util.getEventArgs(
      transaction,
      "Transfer",
      gatedNFT
    )) as TransferEvent["args"];

    const gatedTokenId = `${gatedNFT.address.toLowerCase()} - ${tokenId.toString()}`;

    const query = `
      {
        gatedToken (id: "${gatedTokenId}") {
          tokenId
          ownerAddress
          gatedNFTAddress
          transferHistory {
            id
          }
          mintBlock
          mintTimestamp
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;
    const data = queryResponse.data.gatedToken;

    expect(data.tokenId).to.equals(tokenId.toString());
    expect(data.ownerAddress).to.equals(owner.toLowerCase());
    expect(data.gatedNFTAddress).to.equals(gatedNFT.address.toLowerCase());
    expect(data.transferHistory).to.be.empty;

    expect(data.mintBlock).to.equals(mintBlock.toString());
    expect(data.mintTimestamp).to.equals(mintTimestamp.toString());
  });

  it("should query the GatedTokenOwner correctly after mint", async function () {
    const { to: owner, tokenId } = (await Util.getEventArgs(
      transaction,
      "Transfer",
      gatedNFT
    )) as TransferEvent["args"];

    const gatedTokenId = `${gatedNFT.address.toLowerCase()} - ${tokenId.toString()}`;
    const gatedTokenOwnerId = `${gatedNFT.address.toLowerCase()} - ${owner.toLowerCase()}`;

    const query = `
      {
        gatedTokenOwner (id: "${gatedTokenOwnerId}") {
          address
          tokenCount
          gatedNFTAddress
          tokens {
            id
          }
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;
    const data = queryResponse.data.gatedTokenOwner;

    expect(data.address).to.equals(owner.toLowerCase());
    expect(data.tokenCount).to.equals(
      (await gatedNFT.balanceOf(owner)).toString()
    );

    expect(data.gatedNFTAddress).to.equals(gatedNFT.address.toLowerCase());
    expect(data.tokens).to.deep.include({ id: gatedTokenId });
  });

  it("should update the GatedTokenOwner after a transfer", async function () {
    const { tokenId: idToTransfer } = (await Util.getEventArgs(
      transaction,
      "Transfer",
      gatedNFT
    )) as TransferEvent["args"];

    transaction = await gatedNFT
      .connect(signer1)
      .transferFrom(signer1.address, signer2.address, idToTransfer);

    const {
      from: oldOwner,
      to: newOwner,
      tokenId,
    } = (await Util.getEventArgs(
      transaction,
      "Transfer",
      gatedNFT
    )) as TransferEvent["args"];

    const gatedTokenId = `${gatedNFT.address.toLowerCase()} - ${tokenId.toString()}`;
    const oldTokenOwnerId = `${gatedNFT.address.toLowerCase()} - ${oldOwner.toLowerCase()}`;
    const newTokenOwnerId = `${gatedNFT.address.toLowerCase()} - ${newOwner.toLowerCase()}`;

    await waitForSubgraphToBeSynced();

    const query = `
      {
        oldOwner: gatedTokenOwner (id: "${oldTokenOwnerId}") {
          tokenCount
          tokens {
            id
          }
        }
        newOwner: gatedTokenOwner (id: "${newTokenOwnerId}") {
          tokenCount
          tokens {
            id
          }
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;
    const dataOldOwner = queryResponse.data.oldOwner;
    const dataNewOwner = queryResponse.data.newOwner;

    // Should NOT have the token
    expect(dataOldOwner.tokens).to.not.deep.include({ id: gatedTokenId });
    expect(dataOldOwner.tokenCount).to.equals(
      (await gatedNFT.balanceOf(oldOwner)).toString()
    );

    // Should have the token
    expect(dataNewOwner.tokens).to.deep.include({ id: gatedTokenId });
    expect(dataNewOwner.tokenCount).to.equals(
      (await gatedNFT.balanceOf(newOwner)).toString()
    );
  });

  it("should update the GatedToken after a transfer", async function () {
    const { to: newOwner, tokenId } = (await Util.getEventArgs(
      transaction,
      "Transfer",
      gatedNFT
    )) as TransferEvent["args"];

    const gatedTokenId = `${gatedNFT.address.toLowerCase()} - ${tokenId.toString()}`;
    const transferHistoryId = `${transaction.hash.toLowerCase()}`;

    await waitForSubgraphToBeSynced();

    const query = `
      {
        gatedToken (id: "${gatedTokenId}") {
          ownerAddress
          transferHistory {
            id
          }
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;
    const data = queryResponse.data.gatedToken;

    expect(data.ownerAddress).to.equals(newOwner.toLowerCase());
    expect(data.transferHistory).to.deep.include({ id: transferHistoryId });
  });

  it("should query the HistoricalTransfer after a transfer", async function () {
    const [eventBlock, eventTimestamp] = await Util.getTxTimeblock(transaction);
    const { from, to, tokenId } = (await Util.getEventArgs(
      transaction,
      "Transfer",
      gatedNFT
    )) as TransferEvent["args"];

    const transferHistoryId = `${transaction.hash.toLowerCase()}`;

    await waitForSubgraphToBeSynced();

    const query = `
      {
        historicalTransfer (id: "${transferHistoryId}") {
          transactionHash
          from
          to
          tokenId
          eventBlock
          eventTimestamp
        }
      }
    `;

    const queryResponse = (await subgraph({
      query,
    })) as FetchResult;
    const data = queryResponse.data.historicalTransfer;

    expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
    expect(data.from).to.equals(from.toLowerCase());
    expect(data.to).to.equals(to.toLowerCase());
    expect(data.tokenId).to.equals(tokenId.toString());

    expect(data.eventBlock).to.equals(eventBlock.toString());
    expect(data.eventTimestamp).to.equals(eventTimestamp.toString());
  });
});
