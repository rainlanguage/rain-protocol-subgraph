import { ethers } from "hardhat";
import * as path from "path";

import * as Util from "./utils/utils";
import { waitForSubgraphToBeSynced } from "./utils/utils";

// Typechain Factories
import { NoticeBoard__factory } from "../typechain/factories/NoticeBoard__factory";
import { EmissionsERC20Factory__factory } from "../typechain/factories/EmissionsERC20Factory__factory";
import { VerifyFactory__factory } from "../typechain/factories/VerifyFactory__factory";
import { ERC20BalanceTierFactory__factory } from "../typechain/factories/ERC20BalanceTierFactory__factory";
import { ERC20TransferTierFactory__factory } from "../typechain/factories/ERC20TransferTierFactory__factory";
import { CombineTierFactory__factory } from "../typechain/factories/CombineTierFactory__factory";
import { VerifyTierFactory__factory } from "../typechain/factories/VerifyTierFactory__factory";
import { ERC721BalanceTierFactory__factory } from "../typechain/factories/ERC721BalanceTierFactory__factory";
import { SaleFactory__factory } from "../typechain/factories/SaleFactory__factory";
import { GatedNFTFactory__factory } from "../typechain/factories/GatedNFTFactory__factory";
import { RedeemableERC20ClaimEscrow__factory } from "../typechain/factories/RedeemableERC20ClaimEscrow__factory";
import { RedeemableERC20Factory__factory } from "../typechain/factories/RedeemableERC20Factory__factory";

// Types
import type { ApolloFetch } from "apollo-fetch";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import type { NoticeBoard } from "../typechain/NoticeBoard";
import type { EmissionsERC20Factory } from "../typechain/EmissionsERC20Factory";
import type { RedeemableERC20Factory } from "../typechain/RedeemableERC20Factory";
import type { ERC20BalanceTierFactory } from "../typechain/ERC20BalanceTierFactory";
import type { ERC20TransferTierFactory } from "../typechain/ERC20TransferTierFactory";
import type { CombineTierFactory } from "../typechain/CombineTierFactory";
import type { VerifyTierFactory } from "../typechain/VerifyTierFactory";
import type { ERC721BalanceTierFactory } from "../typechain/ERC721BalanceTierFactory";
import type { VerifyFactory } from "../typechain/VerifyFactory";
import type { SaleFactory } from "../typechain/SaleFactory";
import type { GatedNFTFactory } from "../typechain/GatedNFTFactory";
import type { RedeemableERC20ClaimEscrow } from "../typechain/RedeemableERC20ClaimEscrow";

const subgraphName = "beehive-innovation/rain-protocol-test";

// Export Factories
export let subgraph: ApolloFetch,
  noticeBoard: NoticeBoard,
  emissionsERC20Factory: EmissionsERC20Factory,
  redeemableERC20Factory: RedeemableERC20Factory,
  verifyFactory: VerifyFactory,
  verifyTierFactory: VerifyTierFactory,
  erc20BalanceTierFactory: ERC20BalanceTierFactory,
  erc20TransferTierFactory: ERC20TransferTierFactory,
  combineTierFactory: CombineTierFactory,
  erc721BalanceTierFactory: ERC721BalanceTierFactory,
  saleFactory: SaleFactory,
  saleFactory2: SaleFactory,
  gatedNFTFactory: GatedNFTFactory,
  redeemableERC20ClaimEscrow: RedeemableERC20ClaimEscrow;

// Export signers
export let deployer: SignerWithAddress,
  creator: SignerWithAddress,
  seeder1: SignerWithAddress,
  seeder2: SignerWithAddress,
  signer1: SignerWithAddress,
  signer2: SignerWithAddress,
  recipient: SignerWithAddress,
  feeRecipient: SignerWithAddress,
  admin: SignerWithAddress;

before("Deployment contracts and subgraph", async function () {
  const signers = await ethers.getSigners();

  // Signers (to avoid fetch again)
  deployer = signers[0]; // deployer is NOT creator
  creator = signers[1];
  seeder1 = signers[2];
  seeder2 = signers[3];
  signer1 = signers[4];
  signer2 = signers[5];
  recipient = signers[6];
  feeRecipient = signers[7];
  admin = signers[9];

  // Deploying NoticeBoard contract
  noticeBoard = await new NoticeBoard__factory(deployer).deploy();

  // Deploying EmissionsERC20Factory contract
  emissionsERC20Factory = await new EmissionsERC20Factory__factory(
    deployer
  ).deploy();

  // Deploying RedeemableERC20Factory contract
  redeemableERC20Factory = await new RedeemableERC20Factory__factory(
    deployer
  ).deploy();

  // Deploying VerifyFactory contract
  verifyFactory = await new VerifyFactory__factory(deployer).deploy();

  // Deploying Tiers Factories
  // -  ERC20BalanceTierFactory
  erc20BalanceTierFactory = await new ERC20BalanceTierFactory__factory(
    deployer
  ).deploy();

  // - ERC20TransferTierFactory
  erc20TransferTierFactory = await new ERC20TransferTierFactory__factory(
    deployer
  ).deploy();

  // - CombineTierFactory
  combineTierFactory = await new CombineTierFactory__factory(deployer).deploy();

  verifyTierFactory = await new VerifyTierFactory__factory(deployer).deploy();

  // - ERC721BalanceTierFactory
  erc721BalanceTierFactory = await new ERC721BalanceTierFactory__factory(
    deployer
  ).deploy();

  // Deploying SaleFactory contract
  saleFactory = await new SaleFactory__factory(deployer).deploy({
    maximumSaleTimeout: 10000,
    maximumCooldownDuration: 1000,
    redeemableERC20Factory: redeemableERC20Factory.address,
  });
  // Deploying SaleFactory contract
  saleFactory2 = await new SaleFactory__factory(deployer).deploy({
    maximumSaleTimeout: 100000,
    maximumCooldownDuration: 1000,
    redeemableERC20Factory: redeemableERC20Factory.address,
  });

  // Deploying GatedNFTFactory contract
  gatedNFTFactory = await new GatedNFTFactory__factory(deployer).deploy();

  // Deploying RedeemableERC20ClaimEscrow contract
  redeemableERC20ClaimEscrow = await new RedeemableERC20ClaimEscrow__factory(
    deployer
  ).deploy();

  // Saving data in JSON
  const pathExampleConfig = path.resolve(__dirname, "../config/example.json");
  const config = JSON.parse(Util.fetchFile(pathExampleConfig));

  config.network = "localhost";

  // Saving addresses and individuals blocks to index
  config.NoticeBoard = noticeBoard.address;
  config.NoticeBoardBlock = noticeBoard.deployTransaction.blockNumber;

  config.EmissionsERC20Factory = emissionsERC20Factory.address;
  config.EmissionsERC20FactoryBlock =
    emissionsERC20Factory.deployTransaction.blockNumber;

  config.VerifyFactory = verifyFactory.address;
  config.VerifyFactoryBlock = verifyFactory.deployTransaction.blockNumber;

  config.ERC20BalanceTierFactory = erc20BalanceTierFactory.address;
  config.ERC20BalanceTierFactoryBlock =
    erc20BalanceTierFactory.deployTransaction.blockNumber;

  config.ERC20TransferTierFactory = erc20TransferTierFactory.address;
  config.ERC20TransferTierFactoryBlock =
    erc20TransferTierFactory.deployTransaction.blockNumber;

  config.CombineTierFactory = combineTierFactory.address;
  config.CombineTierFactoryBlock =
    combineTierFactory.deployTransaction.blockNumber;

  config.VerifyTierFactory = verifyTierFactory.address;
  config.VerifyTierFactoryBlock =
    verifyTierFactory.deployTransaction.blockNumber;

  config.ERC721BalanceTierFactory = erc721BalanceTierFactory.address;
  config.ERC721BalanceTierFactoryBlock =
    erc721BalanceTierFactory.deployTransaction.blockNumber;

  config.SaleFactory = saleFactory.address;
  config.SaleFactoryBlock = saleFactory.deployTransaction.blockNumber;

  config.SaleFactory2 = saleFactory2.address;
  config.SaleFactoryBlock2 = saleFactory2.deployTransaction.blockNumber;

  config.GatedNFTFactory = gatedNFTFactory.address;
  config.GatedNFTFactoryBlock = gatedNFTFactory.deployTransaction.blockNumber;

  config.RedeemableERC20ClaimEscrow = redeemableERC20ClaimEscrow.address;
  config.RedeemableERC20ClaimEscrowBlock =
    redeemableERC20ClaimEscrow.deployTransaction.blockNumber;

  // Write address and block to configuration contracts file
  const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
  Util.writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

  // Setting all to localhost to test locally
  const configPath = "config/localhost.json";
  const endpoint = "http://localhost:8020/";
  const ipfsEndpoint = "http://localhost:5001";
  const versionLabel = "test-v2.0.0";

  Util.exec(
    `npm run deploy-subgraph -- --config ${configPath} --subgraphName ${subgraphName} --endpoint ${endpoint} --ipfsEndpoint ${ipfsEndpoint} --versionLabel ${versionLabel}`
  );

  subgraph = Util.fetchSubgraph(subgraphName);

  // Wait for sync
  await waitForSubgraphToBeSynced(1000);
});

// TODO: Rewrite Redeemable Test
