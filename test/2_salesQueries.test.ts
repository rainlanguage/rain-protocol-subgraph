// import { expect, assert } from "chai";
// import { ethers } from "hardhat";
// import { ContractTransaction } from "ethers";
// import { FetchResult } from "apollo-fetch";
// import { concat } from "ethers/lib/utils";

// import * as Util from "./utils/utils";
// import {
//   op,
//   deploy,
//   waitForSubgraphToBeSynced,
//   Tier,
//   LEVELS,
//   OpcodeSale,
//   VMState,
// } from "./utils/utils";

// import reserveTokenJson from "../artifacts/contracts/test/ReserveTokenTest.sol/ReserveTokenTest.json";
// import redeemableTokenJson from "../artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json";

// import { ReserveTokenTest } from "@beehiveinnovation/rain-protocol/typechain/ReserveTokenTest";
// import { ERC20BalanceTier } from "@beehiveinnovation/rain-protocol/typechain/ERC20BalanceTier";
// import { RedeemableERC20 } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20";
// import type {
//   BuyEvent,
//   RefundEvent,
//   Sale,
// } from "@beehiveinnovation/rain-protocol/typechain/Sale";

// import {
//   // Subgraph fetch
//   subgraph,
//   // Signers
//   deployer,
//   creator,
//   signer1,
//   recipient,
//   // Factories
//   saleFactory,
//   feeRecipient,
//   erc20BalanceTierFactory,
//   redeemableERC20Factory,
//   noticeBoard,
// } from "./1_trustQueries.test";

// enum Status {
//   PENDING,
//   ACTIVE,
//   SUCCESS,
//   FAIL,
// }

// const afterBlockNumberConfig = (blockNumber: number) => {
//   return {
//     sources: [
//       concat([
//         // (BLOCK_NUMBER blockNumberSub1 gt)
//         op(OpcodeSale.BLOCK_NUMBER),
//         op(OpcodeSale.VAL, 0),
//         op(OpcodeSale.GREATER_THAN),
//       ]),
//     ],
//     constants: [blockNumber - 1],
//     stackLength: 3,
//     argumentsLength: 0,
//   };
// };

// let reserve: ReserveTokenTest,
//   erc20BalanceTier: ERC20BalanceTier,
//   sale: Sale,
//   redeemableERC20Contract: RedeemableERC20,
//   transaction: ContractTransaction, // Use to save the tx between statements
//   transactionAux: ContractTransaction;

// describe("Sales queries test", function () {
//   before("getting the factory", async function () {
//     reserve = (await deploy(
//       reserveTokenJson,
//       deployer,
//       []
//     )) as ReserveTokenTest;

//     // Deploying a new Tier Contract
//     erc20BalanceTier = await Util.erc20BalanceTierDeploy(
//       erc20BalanceTierFactory,
//       creator,
//       {
//         erc20: reserve.address,
//         tierValues: LEVELS,
//       }
//     );
//   });

//   it("should query the saleFactory after construction correctly", async function () {
//     // Get the Sale implementation
//     const implementation = (
//       await Util.getEventArgs(
//         saleFactory.deployTransaction,
//         "Implementation",
//         saleFactory
//       )
//     ).implementation;

//     const query = `
//       {
//         saleFactory (id: "${saleFactory.address.toLowerCase()}") {
//           address
//           implementation
//           redeemableERC20Factory
//         }
//       }
//     `;

//     const response = (await subgraph({
//       query,
//     })) as FetchResult;

//     const data = response.data.saleFactory;

//     expect(data.address).to.equals(saleFactory.address.toLowerCase());
//     expect(data.implementation).to.equals(implementation.toLowerCase());
//     expect(data.redeemableERC20Factory).to.equals(
//       redeemableERC20Factory.address.toLowerCase()
//     );
//   });

//   describe("Success sale", function () {
//     const saleTimeout = 30;
//     const minimumRaise = ethers.BigNumber.from("150000").mul(Util.RESERVE_ONE);

//     const totalTokenSupply = ethers.BigNumber.from("2000").mul(Util.ONE);
//     const redeemableERC20Config = {
//       name: "Token",
//       symbol: "TKN",
//       distributor: Util.zeroAddress,
//       initialSupply: totalTokenSupply,
//     };

//     const staticPrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);

//     const constants = [staticPrice];
//     const vBasePrice = op(OpcodeSale.VAL, 0);

//     const sources = [concat([vBasePrice])];

//     let startBlock: number,
//       canStartStateConfig: VMState,
//       canEndStateConfig: VMState;

//     const calculatePriceStateConfig = {
//       sources,
//       constants,
//       stackLength: 1,
//       argumentsLength: 0,
//     };
//     const cooldownDuration = 1;
//     const dustSize = 0;

//     const minimumTier = Tier.ZERO;
//     const distributionEndForwardingAddress = ethers.constants.AddressZero;

//     const fee = ethers.BigNumber.from("1").mul(Util.RESERVE_ONE);

//     // Test aux
//     let totalRaisedExpected = ethers.BigNumber.from("0"),
//       totalFeesExpected = ethers.BigNumber.from("0"),
//       feeRecipientTotalFees = ethers.BigNumber.from("0");

//     before("creating the sale child", async function () {
//       // 5 blocks from now
//       startBlock = (await ethers.provider.getBlockNumber()) + 5;

//       canStartStateConfig = afterBlockNumberConfig(startBlock);
//       canEndStateConfig = afterBlockNumberConfig(startBlock + saleTimeout);

//       sale = await Util.saleDeploy(
//         saleFactory,
//         creator,
//         {
//           canStartStateConfig: canStartStateConfig,
//           canEndStateConfig: canEndStateConfig,
//           calculatePriceStateConfig: calculatePriceStateConfig,
//           recipient: recipient.address,
//           reserve: reserve.address,
//           cooldownDuration: cooldownDuration,
//           minimumRaise,
//           dustSize: dustSize,
//         },
//         {
//           erc20Config: redeemableERC20Config,
//           tier: erc20BalanceTier.address,
//           minimumTier: minimumTier,
//           distributionEndForwardingAddress: distributionEndForwardingAddress,
//         }
//       );

//       // Creating the instance for contracts
//       redeemableERC20Contract = (await Util.getContractChild(
//         sale.deployTransaction,
//         redeemableERC20Factory,
//         redeemableTokenJson
//       )) as RedeemableERC20;

//       await waitForSubgraphToBeSynced();
//     });

//     it("should query the sale child after creation", async function () {
//       const query = `
//         {
//           saleFactory (id: "${saleFactory.address.toLowerCase()}") {
//             children {
//               id
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.saleFactory;

//       expect(data.children).deep.include({ id: sale.address.toLowerCase() });
//     });

//     it("should query the Sale correctly", async function () {
//       const [deployBlock, deployTime] = await Util.getTxTimeblock(
//         sale.deployTransaction
//       );

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             address
//             deployer
//             deployBlock
//             deployTimestamp
//             factory {
//               id
//             }
//             reserve {
//               id
//             }
//             token {
//               id
//             }
//           }
//         }
//       `;
//       const response = (await subgraph({
//         query,
//       })) as FetchResult;
//       const data = response.data.sale;

//       expect(data.address).to.equals(sale.address.toLowerCase());
//       expect(data.deployer).to.equals(creator.address.toLowerCase());
//       expect(data.deployBlock).to.equals(deployBlock.toString());
//       expect(data.deployTimestamp).to.equals(deployTime.toString());

//       expect(data.factory.id).to.equals(saleFactory.address.toLowerCase());
//       expect(data.reserve.id).to.equals(reserve.address.toLowerCase());
//       expect(data.token.id).to.equals(
//         redeemableERC20Contract.address.toLowerCase()
//       );
//     });

//     it("should query the initial properties of the Sale correctly", async function () {
//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             recipient
//             cooldownDuration
//             minimumRaise
//             dustSize
//             unitsAvailable
//             totalRaised
//             percentRaised
//             totalFees
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.sale;

//       expect(data.recipient).to.equals(recipient.address.toLowerCase());
//       expect(data.cooldownDuration).to.equals(cooldownDuration.toString());
//       expect(data.minimumRaise).to.equals(minimumRaise.toString());
//       expect(data.dustSize).to.equals(dustSize.toString());
//       expect(data.unitsAvailable).to.equals(totalTokenSupply.toString());

//       expect(data.totalRaised).to.equals("0");
//       expect(data.percentRaised).to.equals("0");
//       expect(data.totalFees).to.equals("0");
//     });

//     it("should query the Sale the initial status values", async function () {
//       const query = `
//       {
//         sale (id: "${sale.address.toLowerCase()}") {
//           saleStatus
//           startEvent {
//             id
//           }
//           endEvent {
//             id
//           }
//           buys {
//             id
//           }
//           refunds {
//             id
//           }
//           saleTransactions {
//             id
//           }
//           notices {
//             id
//           }
//           saleFeeRecipients {
//             id
//           }
//         }
//       }
//     `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;
//       const data = response.data.sale;

//       expect(data.saleStatus).to.equals(Status.PENDING);

//       expect(data.startEvent).to.be.null;
//       expect(data.endEvent).to.be.null;

//       expect(data.buys).to.be.empty;
//       expect(data.refunds).to.be.empty;
//       expect(data.saleTransactions).to.be.empty;
//       expect(data.notices).to.be.empty;
//       expect(data.saleFeeRecipients).to.be.empty;
//     });

//     it("should query the State configs after Sale creation", async function () {
//       // Converting the configs
//       const startConfigExpected = Util.convertConfig(canStartStateConfig);
//       const endConfigExpected = Util.convertConfig(canEndStateConfig);
//       const priceConfigExpected = Util.convertConfig(calculatePriceStateConfig);

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             canStartStateConfig {
//               sources
//               constants
//               stackLength
//               argumentsLength
//             }
//             canEndStateConfig {
//               sources
//               constants
//               stackLength
//               argumentsLength
//             }
//             calculatePriceStateConfig {
//               sources
//               constants
//               stackLength
//               argumentsLength
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const startData = response.data.sale.canStartStateConfig;
//       const endData = response.data.sale.canEndStateConfig;
//       const priceData = response.data.sale.calculatePriceStateConfig;

//       expect(startData.sources).to.eql(startConfigExpected.sources);
//       expect(startData.constants).to.eql(startConfigExpected.constants);
//       expect(startData.stackLength).to.equals(startConfigExpected.stackLength);
//       expect(startData.argumentsLength).to.equals(
//         startConfigExpected.argumentsLength
//       );

//       expect(endData.sources).to.eql(endConfigExpected.sources);
//       expect(endData.constants).to.eql(endConfigExpected.constants);
//       expect(endData.stackLength).to.equals(endConfigExpected.stackLength);
//       expect(endData.argumentsLength).to.equals(
//         endConfigExpected.argumentsLength
//       );

//       expect(priceData.sources).to.eql(priceConfigExpected.sources);
//       expect(priceData.constants).to.eql(priceConfigExpected.constants);
//       expect(priceData.stackLength).to.equals(priceConfigExpected.stackLength);
//       expect(priceData.argumentsLength).to.equals(
//         priceConfigExpected.argumentsLength
//       );
//     });

//     it("should query the RedeemableERC20 entity", async function () {
//       const [deployBlock, deployTime] = await Util.getTxTimeblock(
//         redeemableERC20Contract.deployTransaction
//       );

//       const treasuryAssetId = `${redeemableERC20Contract.address.toLowerCase()} - ${reserve.address.toLowerCase()}`;

//       const query = `
//         {
//           redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
//             deployer
//             admin
//             factory
//             redeems {
//               id
//             }
//             treasuryAssets {
//               id
//             }
//             tier {
//               id
//             }
//             minimumTier
//             name
//             symbol
//             totalSupply
//             deployBlock
//             deployTimestamp
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query: query,
//       })) as FetchResult;

//       const data = response.data.redeemableERC20;

//       expect(data.deployer).to.equals(creator.address.toLowerCase());
//       expect(data.admin).to.equals(sale.address.toLowerCase());
//       expect(data.factory).to.equals(
//         redeemableERC20Factory.address.toLowerCase()
//       );

//       expect(data.redeems).to.be.empty;
//       expect(data.treasuryAssets).to.deep.include({ id: treasuryAssetId });
//       expect(data.tier.id).to.equals(erc20BalanceTier.address.toLowerCase());

//       expect(data.minimumTier).to.equals(minimumTier.toString());
//       expect(data.name).to.equals(redeemableERC20Config.name);
//       expect(data.symbol).to.equals(redeemableERC20Config.symbol);
//       expect(data.totalSupply).to.equals(redeemableERC20Config.initialSupply);

//       expect(data.deployBlock).to.equals(deployBlock.toString());
//       expect(data.deployTimestamp).to.equals(deployTime.toString());
//     });

//     it("should query the SaleRedeemableERC20 entity correctly", async function () {
//       const [deployBlock, deployTime] = await Util.getTxTimeblock(
//         redeemableERC20Contract.deployTransaction
//       );
//       const query = `
//         {
//             redeemableERC20 (id: "${redeemableERC20Contract.address.toLowerCase()}") {
//             name
//             symbol
//             decimals
//             totalSupply
//             tier {
//               id
//             }
//             minimumTier
//             deployBlock
//             deployTimestamp
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.redeemableERC20;

//       expect(data.name).to.equals(redeemableERC20Config.name);
//       expect(data.symbol).to.equals(redeemableERC20Config.symbol);
//       expect(data.decimals).to.equals(await redeemableERC20Contract.decimals());
//       expect(data.totalSupply).to.equals(redeemableERC20Config.initialSupply);

//       expect(data.tier.id).to.equals(erc20BalanceTier.address.toLowerCase());
//       expect(data.minimumTier).to.equals(minimumTier.toString());

//       expect(data.deployBlock).to.equals(deployBlock.toString());
//       expect(data.deployTimestamp).to.equals(deployTime.toString());
//     });

//     it("should query Notice in Sale correctly", async function () {
//       const notices = [
//         {
//           subject: sale.address,
//           data: "0x01",
//         },
//       ];

//       transaction = await noticeBoard.connect(signer1).createNotices(notices);

//       const noticeId = `${sale.address.toLowerCase()} - ${transaction.hash.toLowerCase()} - 0`;
//       await waitForSubgraphToBeSynced();

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             notices {
//               id
//             }
//           }
//           notice (id: "${noticeId}") {
//             sender
//             subject{
//               id
//             }
//             data
//           }
//         }
//       `;

//       const queryResponse = (await subgraph({
//         query,
//       })) as FetchResult;
//       const dataSale = queryResponse.data.sale.notices;
//       const dataNotice = queryResponse.data.notice;

//       expect(dataSale).deep.include({ id: noticeId });

//       expect(dataNotice.sender).to.equals(signer1.address.toLowerCase());
//       expect(dataNotice.subject.id).to.equals(sale.address.toLowerCase());
//       expect(dataNotice.data).to.equals("0x01");
//     });

//     it("should query the Sale after start correctly", async function () {
//       // Waiting to start the sale
//       await Util.createEmptyBlock(
//         startBlock - (await ethers.provider.getBlockNumber())
//       );

//       // Starting with signer1
//       transaction = await sale.connect(signer1).start();

//       await waitForSubgraphToBeSynced();

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             saleStatus
//             startEvent {
//               id
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.sale;

//       expect(data.saleStatus).to.equals(Status.ACTIVE);
//       expect(data.startEvent.id).to.equals(transaction.hash.toLowerCase());
//     });

//     it("should query the SaleStart after start the Sale", async function () {
//       const saleStartId = transaction.hash.toLowerCase();

//       const [deployBlock, deployTime] = await Util.getTxTimeblock(transaction);

//       // Get the sender from event
//       const { sender } = await Util.getEventArgs(transaction, "Start", sale);

//       const query = `
//         {
//           saleStart (id: "${saleStartId}") {
//             transactionHash
//             sender
//             saleContract {
//               id
//             }
//             block
//             timestamp
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.saleStart;

//       expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
//       expect(data.sender).to.equals(sender.toLowerCase());

//       expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
//       expect(data.block).to.equals(deployBlock.toString());
//       expect(data.timestamp).to.equals(deployTime.toString());
//     });

//     it("should update the Sale after buy correctly", async function () {
//       // Buy the 50% of the units availables
//       const desiredUnits = (
//         await redeemableERC20Contract.balanceOf(sale.address)
//       ).div(2);

//       const cost = staticPrice.mul(desiredUnits).div(Util.ONE);

//       // give signer1 reserve to cover cost + fee
//       await reserve.transfer(signer1.address, cost.add(fee));
//       const signer1ReserveBalance = await reserve.balanceOf(signer1.address);

//       await reserve
//         .connect(signer1)
//         .approve(sale.address, signer1ReserveBalance);

//       const buyConfig = {
//         feeRecipient: feeRecipient.address,
//         fee,
//         minimumUnits: desiredUnits,
//         desiredUnits,
//         maximumPrice: staticPrice,
//       };

//       // Buying the half of units
//       transaction = await sale.connect(signer1).buy(buyConfig);

//       const { receipt } = (await Util.getEventArgs(
//         transaction,
//         "Buy",
//         sale
//       )) as BuyEvent["args"];

//       const totalInExpected = receipt.units
//         .mul(receipt.price)
//         .div(Util.ONE)
//         .add(receipt.fee);

//       // Manage the expected values
//       // Fees
//       totalFeesExpected = totalFeesExpected.add(receipt.fee);
//       feeRecipientTotalFees = feeRecipientTotalFees.add(receipt.fee);

//       // Total raised
//       totalRaisedExpected = totalRaisedExpected.add(
//         totalInExpected.sub(receipt.fee) // the fee is not consired as amount raise
//       );

//       await waitForSubgraphToBeSynced();

//       const unitsAvailableExpected = await redeemableERC20Contract.balanceOf(
//         sale.address
//       );

//       const percentRaisedExpected = totalRaisedExpected
//         .mul(100)
//         .div(minimumRaise);

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             unitsAvailable
//             totalRaised
//             percentRaised
//             totalFees
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;
//       const data = response.data.sale;

//       expect(data.unitsAvailable).to.equals(unitsAvailableExpected);
//       expect(data.totalRaised).to.equals(totalRaisedExpected);
//       expect(data.percentRaised).to.equals(percentRaisedExpected);
//       expect(data.totalFees).to.equals(totalFeesExpected);
//     });

//     it("should query the SaleBuy after buy", async function () {
//       const [buyBlock, buyTimestamp] = await Util.getTxTimeblock(transaction);

//       const saleBuyId = transaction.hash.toLowerCase();
//       const feeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;

//       const { receipt, config } = (await Util.getEventArgs(
//         transaction,
//         "Buy",
//         sale
//       )) as BuyEvent["args"];

//       const { fee: feeExpected, units, price, id: receiptId } = receipt;

//       const {
//         minimumUnits: minimumUnitsExpected,
//         desiredUnits: desiredUnitsExpected,
//         maximumPrice: maximumPriceExpected,
//       } = config;

//       const totalInExpected = units.mul(price).div(Util.ONE).add(feeExpected);

//       const saleReceiptId = `${sale.address.toLowerCase()} - ${receiptId}`;

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             buys {
//               id
//             }
//           }
//           saleBuy (id: "${saleBuyId}") {
//             transactionHash
//             sender
//             block
//             timestamp
//             saleContract {
//               id
//             }
//             saleContractAddress
//             feeRecipient {
//               id
//             }
//             feeRecipientAddress
//             totalIn
//             fee
//             minimumUnits
//             desiredUnits
//             maximumPrice
//             receipt {
//               id
//             }
//             refunded
//             refundEvent {
//               id
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const saleData = response.data.sale;
//       const data = response.data.saleBuy;

//       expect(saleData.buys).deep.include(
//         { id: saleBuyId },
//         `buy with ID ${saleBuyId} it is NOT present on the Sale`
//       );

//       expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
//       expect(data.sender).to.equals(signer1.address.toLowerCase());
//       expect(data.block).to.equals(buyBlock.toString());
//       expect(data.timestamp).to.equals(buyTimestamp.toString());

//       expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
//       expect(data.saleContractAddress).to.equals(sale.address.toLowerCase());
//       expect(data.feeRecipient.id).to.equals(feeRecipientId);
//       expect(data.feeRecipientAddress).to.equals(
//         feeRecipient.address.toLowerCase()
//       );

//       expect(data.fee).to.equals(feeExpected);
//       expect(data.minimumUnits).to.equals(minimumUnitsExpected);
//       expect(data.desiredUnits).to.equals(desiredUnitsExpected);
//       expect(data.maximumPrice).to.equals(maximumPriceExpected);
//       expect(data.totalIn).to.equals(totalInExpected);

//       expect(data.receipt.id).to.equals(saleReceiptId);
//       expect(data.refunded).to.be.false;
//       expect(data.refundEvent).to.be.null;
//     });

//     it("should query the SaleTransaction corresponding to a SaleBuy after a buy should", async function () {
//       const [saleBlock, saleTimestamp] = await Util.getTxTimeblock(transaction);

//       const saleTransactionId = transaction.hash.toLowerCase();
//       const feeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;

//       const { receipt } = (await Util.getEventArgs(
//         transaction,
//         "Buy",
//         sale
//       )) as BuyEvent["args"];

//       const saleReceiptId = `${sale.address.toLowerCase()} - ${receipt.id}`;

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             saleTransactions {
//               id
//             }
//           }
//           saleTransaction (id: "${saleTransactionId}") {
//             transactionHash
//             sender
//             block
//             timestamp
//             saleContract {
//               id
//             }
//             saleContractAddress
//             feeRecipient {
//               id
//             }
//             feeRecipientAddress
//             receipt {
//               id
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;
//       const dataSale = response.data.sale;
//       const data = response.data.saleTransaction;

//       expect(dataSale.saleTransactions).deep.include({ id: saleTransactionId });

//       expect(data.transactionHash).to.equals(saleTransactionId);
//       expect(data.sender).to.equals(signer1.address.toLowerCase());
//       expect(data.block).to.equals(saleBlock.toString());
//       expect(data.timestamp).to.equals(saleTimestamp.toString());

//       expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
//       expect(data.saleContractAddress).to.equals(sale.address.toLowerCase());
//       expect(data.feeRecipient.id).to.equals(feeRecipientId);
//       expect(data.feeRecipientAddress).to.equals(
//         feeRecipient.address.toLowerCase()
//       );

//       expect(data.receipt.id).to.equals(saleReceiptId);
//     });

//     it("should query the SaleReceipt after a buy", async function () {
//       const { receipt } = (await Util.getEventArgs(
//         transaction,
//         "Buy",
//         sale
//       )) as BuyEvent["args"];

//       const { id: receiptId, feeRecipient, fee, units, price } = receipt;

//       const saleReceiptId = `${sale.address.toLowerCase()} - ${receiptId}`;

//       const query = `
//         {
//           saleReceipt (id: "${saleReceiptId}") {
//             receiptId
//             feeRecipient
//             fee
//             units
//             price
//             saleTransaction
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;
//       const data = response.data.saleReceipt;

//       expect(data.receiptId).to.equals(receiptId);
//       expect(data.feeRecipient).to.equals(feeRecipient.toLowerCase());
//       expect(data.fee).to.equals(fee);
//       expect(data.units).to.equals(units);
//       expect(data.price).to.equals(price);
//       expect(data.saleTransaction).to.equals(transaction.hash.toLowerCase());
//     });

//     it("should query the SaleFeeRecipient after a buy", async function () {
//       const saleFeeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;
//       const saleBuyId = transaction.hash.toLowerCase();

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             saleFeeRecipients {
//               id
//             }
//           }
//           saleFeeRecipient (id: "${saleFeeRecipientId}") {
//             address
//             totalFees
//             buys {
//               id
//             }
//             refunds {
//               id
//             }
//             sale {
//               id
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;
//       const dataSale = response.data.sale;
//       const data = response.data.saleFeeRecipient;

//       expect(dataSale.saleFeeRecipients).deep.include(
//         { id: saleFeeRecipientId },
//         `sale does not include the saleFeeRecipient with ID ${saleFeeRecipientId}`
//       );

//       expect(data.address).to.equals(feeRecipient.address.toLowerCase());
//       expect(data.totalFees).to.equals(feeRecipientTotalFees);

//       expect(data.buys).deep.include({ id: saleBuyId });
//       expect(data.refunds).to.be.empty;
//       expect(data.sale.id).to.equals(sale.address.toLowerCase());
//     });

//     it("should update the Sale after a refund", async function () {
//       // Using the same receipt emitted on the last buy
//       const { receipt } = (await Util.getEventArgs(
//         transaction,
//         "Buy",
//         sale
//       )) as BuyEvent["args"];

//       // Saving the Tx to futher reference
//       transactionAux = transaction;

//       await redeemableERC20Contract
//         .connect(signer1)
//         .approve(sale.address, receipt.units);

//       transaction = await sale.connect(signer1).refund(receipt);

//       await waitForSubgraphToBeSynced();

//       // Since it is the same Receipt, we can use it again
//       const totalOutExpected = receipt.units
//         .mul(receipt.price)
//         .div(Util.ONE)
//         .add(receipt.fee);

//       // Manage the expected values
//       // Fees
//       totalFeesExpected = totalFeesExpected.sub(receipt.fee);
//       feeRecipientTotalFees = feeRecipientTotalFees.sub(receipt.fee);

//       // Total raised
//       totalRaisedExpected = totalRaisedExpected.sub(
//         totalOutExpected.sub(receipt.fee)
//       ); // the fee is not consired as amount raise

//       const unitsAvailableExpected = await redeemableERC20Contract.balanceOf(
//         sale.address
//       );

//       const percentRaisedExpected = totalRaisedExpected
//         .mul(100)
//         .div(minimumRaise);

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             unitsAvailable
//             totalRaised
//             percentRaised
//             totalFees
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.sale;

//       expect(data.unitsAvailable).to.equals(unitsAvailableExpected);
//       expect(data.totalRaised).to.equals(totalRaisedExpected);
//       expect(data.percentRaised).to.equals(percentRaisedExpected);
//       expect(data.totalFees).to.equals(totalFeesExpected);
//     });

//     it("should query the SaleRefund after refund", async function () {
//       const [refundBlock, refundTime] = await Util.getTxTimeblock(transaction);

//       const { receipt } = (await Util.getEventArgs(
//         transaction,
//         "Refund",
//         sale
//       )) as RefundEvent["args"];

//       const { id: receiptId, units, price, fee } = receipt;

//       const saleRefundId = transaction.hash.toLowerCase();
//       const feeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;
//       const saleReceiptId = `${sale.address.toLowerCase()} - ${receiptId}`;

//       const feeExpected = fee;
//       const totalOutExpected = units.mul(price).div(Util.ONE).add(fee);

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             refunds {
//               id
//             }
//           }
//           saleRefund (id: "${saleRefundId}") {
//             transactionHash
//             sender
//             block
//             timestamp
//             saleContract {
//               id
//             }
//             saleContractAddress
//             feeRecipient {
//               id
//             }
//             feeRecipientAddress
//             fee
//             totalOut
//             receipt {
//               id
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const dataSale = response.data.sale;
//       const data = response.data.saleRefund;

//       expect(dataSale.refunds).deep.include({ id: saleRefundId });

//       expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
//       expect(data.sender).to.equals(signer1.address.toLowerCase());
//       expect(data.block).to.equals(refundBlock.toString());
//       expect(data.timestamp).to.equals(refundTime.toString());

//       expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
//       expect(data.saleContractAddress).to.equals(sale.address.toLowerCase());
//       expect(data.feeRecipient.id).to.equals(feeRecipientId);
//       expect(data.feeRecipientAddress).to.equals(
//         feeRecipient.address.toLowerCase()
//       );

//       expect(data.fee).to.equals(feeExpected);
//       expect(data.totalOut).to.equals(totalOutExpected);
//       expect(data.receipt.id).to.equals(saleReceiptId);
//     });

//     it("should update the SaleBuy entity after refund", async function () {
//       // Using the tx auxiliar that contain the tx where Buy was made
//       const saleBuyId = transactionAux.hash.toLowerCase();

//       // Transaction with the refund
//       const saleRefundId = transaction.hash.toLowerCase();

//       const query = `
//         {
//           saleBuy (id: "${saleBuyId}") {
//             refunded
//             refundEvent {
//               id
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;
//       const data = response.data.saleBuy;

//       expect(data.refunded).to.be.true;
//       expect(data.refundEvent.id).to.equals(saleRefundId);
//     });

//     it("should query the SaleTransaction corresponding to a SaleRefund after a refund", async function () {
//       const [saleBlock, saleTimestamp] = await Util.getTxTimeblock(transaction);

//       const saleTransactionId = transaction.hash.toLowerCase();
//       const feeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;

//       const { receipt } = (await Util.getEventArgs(
//         transaction,
//         "Refund",
//         sale
//       )) as RefundEvent["args"];

//       const saleReceiptId = `${sale.address.toLowerCase()} - ${receipt.id}`;

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             saleTransactions {
//               id
//             }
//           }
//           saleTransaction (id: "${saleTransactionId}") {
//             transactionHash
//             sender
//             block
//             timestamp
//             saleContract {
//               id
//             }
//             saleContractAddress
//             feeRecipient {
//               id
//             }
//             feeRecipientAddress
//             receipt {
//               id
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;
//       const dataSale = response.data.sale;
//       const data = response.data.saleTransaction;

//       expect(dataSale.saleTransactions).deep.include({ id: saleTransactionId });

//       expect(data.transactionHash).to.equals(saleTransactionId);
//       expect(data.sender).to.equals(signer1.address.toLowerCase());
//       expect(data.block).to.equals(saleBlock.toString());
//       expect(data.timestamp).to.equals(saleTimestamp.toString());

//       expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
//       expect(data.saleContractAddress).to.equals(sale.address.toLowerCase());
//       expect(data.feeRecipient.id).to.equals(feeRecipientId);
//       expect(data.feeRecipientAddress).to.equals(
//         feeRecipient.address.toLowerCase()
//       );

//       expect(data.receipt.id).to.equals(saleReceiptId);
//     });

//     it("should update the SaleFeeRecipient after refund", async function () {
//       const saleFeeRecipientId = `${sale.address.toLowerCase()} - ${feeRecipient.address.toLowerCase()}`;

//       const saleRefundId = transaction.hash.toLowerCase();

//       const query = `
//         {
//           saleFeeRecipient (id: "${saleFeeRecipientId}") {
//             totalFees
//             refunds {
//               id
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;
//       const data = response.data.saleFeeRecipient;

//       expect(data.totalFees).to.equals(feeRecipientTotalFees);
//       expect(data.refunds).deep.include({ id: saleRefundId });
//     });

//     it("should update the Sale after reaching the minimum raise", async function () {
//       // Buy all the remain supply to end
//       const desiredUnits = await redeemableERC20Contract.balanceOf(
//         sale.address
//       );
//       const cost = staticPrice.mul(desiredUnits).div(Util.ONE);

//       // give signer1 reserve to cover cost + fee
//       await reserve.transfer(signer1.address, cost.add(fee));
//       const signer1ReserveBalance = await reserve.balanceOf(signer1.address);

//       await reserve
//         .connect(signer1)
//         .approve(sale.address, signer1ReserveBalance);

//       const buyConfig = {
//         feeRecipient: feeRecipient.address,
//         fee,
//         minimumUnits: desiredUnits,
//         desiredUnits,
//         maximumPrice: staticPrice,
//       };

//       transaction = await sale.connect(signer1).buy(buyConfig);

//       const { receipt } = (await Util.getEventArgs(
//         transaction,
//         "Buy",
//         sale
//       )) as BuyEvent["args"];

//       const totalInExpected = receipt.units
//         .mul(receipt.price)
//         .div(Util.ONE)
//         .add(receipt.fee);

//       // Add the fees to manage the expected value
//       totalFeesExpected = totalFeesExpected.add(receipt.fee);
//       feeRecipientTotalFees = feeRecipientTotalFees.add(receipt.fee);
//       totalRaisedExpected = totalRaisedExpected.add(
//         totalInExpected.sub(receipt.fee)
//       );

//       await waitForSubgraphToBeSynced();

//       const unitsAvailableExpected = await redeemableERC20Contract.balanceOf(
//         sale.address
//       );

//       // Since the sale reach the minimum, then will be 100%
//       const percentRaisedExpected = "100";

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             unitsAvailable
//             totalRaised
//             percentRaised
//             totalFees
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.sale;

//       expect(data.unitsAvailable).to.equals(unitsAvailableExpected);
//       expect(data.totalRaised).to.equals(totalRaisedExpected);
//       expect(data.percentRaised).to.equals(percentRaisedExpected);
//       expect(data.totalFees).to.equals(totalFeesExpected);
//     });

//     it("should update the Sale after a end the Sale", async function () {
//       // Since the minimun raise was reached, the sale automatically was ended
//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             saleStatus
//             endEvent {
//               id
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.sale;

//       expect(data.saleStatus).to.equals(Status.SUCCESS);
//       expect(data.endEvent.id).to.equals(transaction.hash.toLowerCase());
//     });

//     it("should query SaleEnd after a sale end", async function () {
//       const saleEndId = transaction.hash.toLowerCase();

//       const [endBlock, endTime] = await Util.getTxTimeblock(transaction);

//       const query = `
//         {
//           saleEnd (id: "${saleEndId}") {
//             transactionHash
//             sender
//             block
//             timestamp
//             saleContract {
//               id
//             }
//             saleStatus
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.saleEnd;

//       expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
//       expect(data.sender).to.equals(signer1.address.toLowerCase());
//       expect(data.block).to.equals(endBlock.toString());
//       expect(data.timestamp).to.equals(endTime.toString());

//       expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
//       expect(data.saleStatus).to.equals(Status.SUCCESS);
//     });
//   });

//   describe("Failed sale", function () {
//     // SaleRefund
//     const vBasePrice = op(OpcodeSale.VAL, 0);
//     const staticPrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);

//     const sources = [concat([vBasePrice])];
//     const constants = [staticPrice];

//     let startBlock: number,
//       canStartStateConfig: VMState,
//       canEndStateConfig: VMState;
//     const calculatePriceStateConfig = {
//       sources,
//       constants,
//       stackLength: 1,
//       argumentsLength: 0,
//     };
//     const cooldownDuration = 1;
//     const minimumRaise = ethers.BigNumber.from("150000").mul(Util.RESERVE_ONE);
//     const dustSize = 0;

//     const saleTimeout = 30;

//     const redeemableERC20Config = {
//       name: "Token",
//       symbol: "TKN",
//       distributor: Util.zeroAddress,
//       initialSupply: ethers.BigNumber.from("2000").mul(Util.ONE),
//     };
//     const minimumTier = Tier.ZERO;
//     const distributionEndForwardingAddress = Util.zeroAddress;

//     before("creating the sale child", async function () {
//       // 5 blocks from now
//       startBlock = (await ethers.provider.getBlockNumber()) + 5;

//       canStartStateConfig = afterBlockNumberConfig(startBlock);
//       canEndStateConfig = afterBlockNumberConfig(startBlock + saleTimeout);

//       sale = await Util.saleDeploy(
//         saleFactory,
//         creator,
//         {
//           canStartStateConfig: canStartStateConfig,
//           canEndStateConfig: canEndStateConfig,
//           calculatePriceStateConfig: calculatePriceStateConfig,
//           recipient: recipient.address,
//           reserve: reserve.address,
//           cooldownDuration: cooldownDuration,
//           minimumRaise,
//           dustSize: dustSize,
//         },
//         {
//           erc20Config: redeemableERC20Config,
//           tier: erc20BalanceTier.address,
//           minimumTier: minimumTier,
//           distributionEndForwardingAddress: distributionEndForwardingAddress,
//         }
//       );

//       // Creating the instance for contracts
//       redeemableERC20Contract = (await Util.getContractChild(
//         sale.deployTransaction,
//         redeemableERC20Factory,
//         redeemableTokenJson
//       )) as RedeemableERC20;

//       await waitForSubgraphToBeSynced();
//     });

//     it("should query the Sale as failed correctly", async function () {
//       const cantStart = await sale.canStart();
//       assert(!cantStart);

//       // wait until sale can start
//       await Util.createEmptyBlock(
//         startBlock - (await ethers.provider.getBlockNumber())
//       );

//       const canStart = await sale.canStart();
//       assert(canStart);

//       // Sale started
//       await sale.start();

//       const saleStatusActive = await sale.saleStatus();
//       assert(saleStatusActive === Status.ACTIVE);

//       const cantEnd = await sale.canEnd();
//       assert(!cantEnd);

//       // wait until sale can end
//       await Util.createEmptyBlock(
//         saleTimeout + startBlock - (await ethers.provider.getBlockNumber())
//       );

//       const canEnd = await sale.canEnd();
//       assert(canEnd);

//       // Sale ended
//       transaction = await sale.connect(signer1).end();

//       // wait for sync
//       await waitForSubgraphToBeSynced();

//       const saleEndId = transaction.hash.toLowerCase();

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             saleStatus
//             endEvent {
//               id
//             }
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.sale;

//       expect(data.saleStatus).to.equals(Status.FAIL);
//       expect(data.endEvent.id).to.equals(saleEndId);
//     });

//     it("should query the SaleEnd after a sale failing", async function () {
//       const saleEndId = transaction.hash.toLowerCase();

//       const query = `
//         {
//           saleEnd (id: "${saleEndId}") {
//             transactionHash
//             sender
//             saleContract {
//               id
//             }
//             saleStatus
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.saleEnd;

//       expect(data.transactionHash).to.equals(transaction.hash.toLowerCase());
//       expect(data.sender).to.equals(signer1.address.toLowerCase());
//       expect(data.saleContract.id).to.equals(sale.address.toLowerCase());
//       expect(data.saleStatus).to.equals(Status.FAIL);
//     });
//   });

//   describe("Sale with zero minimumRaise ", function () {
//     // distributionEndForwardingAddress need to be non zero address
//     const vBasePrice = op(OpcodeSale.VAL, 0);
//     const staticPrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);

//     const sources = [concat([vBasePrice])];
//     const constants = [staticPrice];

//     let startBlock: number,
//       canStartStateConfig: VMState,
//       canEndStateConfig: VMState;
//     const calculatePriceStateConfig = {
//       sources,
//       constants,
//       stackLength: 1,
//       argumentsLength: 0,
//     };
//     const cooldownDuration = 1;
//     const minimumRaise = ethers.BigNumber.from("0");
//     const dustSize = 0;

//     const saleTimeout = 30;

//     const redeemableERC20Config = {
//       name: "Token",
//       symbol: "TKN",
//       distributor: Util.zeroAddress,
//       initialSupply: ethers.BigNumber.from("2000").mul(Util.ONE),
//     };
//     const minimumTier = Tier.ZERO;
//     let distributionEndForwardingAddress: string;

//     before("creating the sale child", async function () {
//       // 5 blocks from now
//       startBlock = (await ethers.provider.getBlockNumber()) + 5;

//       canStartStateConfig = afterBlockNumberConfig(startBlock);
//       canEndStateConfig = afterBlockNumberConfig(startBlock + saleTimeout);

//       // Arbitrary distributionEndForwardingAddress to get the zero minimumRaise
//       distributionEndForwardingAddress = signer1.address;

//       sale = await Util.saleDeploy(
//         saleFactory,
//         creator,
//         {
//           canStartStateConfig: canStartStateConfig,
//           canEndStateConfig: canEndStateConfig,
//           calculatePriceStateConfig: calculatePriceStateConfig,
//           recipient: recipient.address,
//           reserve: reserve.address,
//           cooldownDuration: cooldownDuration,
//           minimumRaise,
//           dustSize: dustSize,
//         },
//         {
//           erc20Config: redeemableERC20Config,
//           tier: erc20BalanceTier.address,
//           minimumTier: minimumTier,
//           distributionEndForwardingAddress: distributionEndForwardingAddress,
//         }
//       );

//       // Creating the instance for contracts
//       redeemableERC20Contract = (await Util.getContractChild(
//         sale.deployTransaction,
//         redeemableERC20Factory,
//         redeemableTokenJson
//       )) as RedeemableERC20;

//       await waitForSubgraphToBeSynced();
//     });

//     it("should query as full percent raised a Sale with zero minimumRaise", async function () {
//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             percentRaised
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;

//       const data = response.data.sale;

//       expect(data.percentRaised).to.equals("100");
//     });

//     it("should query as full percent raised a Sale with zero minimumRaise after a buy", async function () {
//       // wait until sale can start
//       await Util.createEmptyBlock(
//         startBlock - (await ethers.provider.getBlockNumber())
//       );

//       // Sale started
//       await sale.start();

//       const saleStatusActive = await sale.saleStatus();
//       assert(saleStatusActive === Status.ACTIVE);

//       // Buy the 50% of the units availables
//       const desiredUnits = (
//         await redeemableERC20Contract.balanceOf(sale.address)
//       ).div(2);

//       const cost = staticPrice.mul(desiredUnits).div(Util.ONE);
//       const fee = ethers.BigNumber.from("1").mul(Util.RESERVE_ONE);

//       // give signer1 reserve to cover cost + fee
//       await reserve.transfer(signer1.address, cost.add(fee));
//       const signer1ReserveBalance = await reserve.balanceOf(signer1.address);

//       await reserve
//         .connect(signer1)
//         .approve(sale.address, signer1ReserveBalance);

//       const buyConfig = {
//         feeRecipient: feeRecipient.address,
//         fee,
//         minimumUnits: desiredUnits,
//         desiredUnits,
//         maximumPrice: staticPrice,
//       };

//       // Buying the half of units
//       transaction = await sale.connect(signer1).buy(buyConfig);

//       await waitForSubgraphToBeSynced();

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             percentRaised
//           }
//         }
//       `;

//       const response = (await subgraph({
//         query,
//       })) as FetchResult;
//       const data = response.data.sale;

//       expect(data.percentRaised).to.equals("100");
//     });
//   });

//   describe("Sale with a non-ERC20 token as reserve", function () {
//     // The subgraph must not crash with non-ERC20 token / address as reserve
//     const vBasePrice = op(OpcodeSale.VAL, 0);
//     const staticPrice = ethers.BigNumber.from("75").mul(Util.RESERVE_ONE);

//     const sources = [concat([vBasePrice])];
//     const constants = [staticPrice];

//     let startBlock: number,
//       canStartStateConfig: VMState,
//       canEndStateConfig: VMState;
//     const calculatePriceStateConfig = {
//       sources,
//       constants,
//       stackLength: 1,
//       argumentsLength: 0,
//     };
//     const cooldownDuration = 1;
//     const minimumRaise = ethers.BigNumber.from("150000").mul(Util.RESERVE_ONE);
//     const dustSize = 0;

//     const saleTimeout = 30;

//     const redeemableERC20Config = {
//       name: "Token",
//       symbol: "TKN",
//       distributor: Util.zeroAddress,
//       initialSupply: ethers.BigNumber.from("2000").mul(Util.ONE),
//     };
//     const minimumTier = Tier.ZERO;
//     const distributionEndForwardingAddress = Util.zeroAddress;

//     let nonErc20: string;

//     before("creating the sale child", async function () {
//       // 5 blocks from now
//       startBlock = (await ethers.provider.getBlockNumber()) + 5;

//       canStartStateConfig = afterBlockNumberConfig(startBlock);
//       canEndStateConfig = afterBlockNumberConfig(startBlock + saleTimeout);

//       // It could be an non-ERC20 address
//       nonErc20 = signer1.address;

//       sale = await Util.saleDeploy(
//         saleFactory,
//         creator,
//         {
//           canStartStateConfig: canStartStateConfig,
//           canEndStateConfig: canEndStateConfig,
//           calculatePriceStateConfig: calculatePriceStateConfig,
//           recipient: recipient.address,
//           reserve: nonErc20,
//           cooldownDuration: cooldownDuration,
//           minimumRaise,
//           dustSize: dustSize,
//         },
//         {
//           erc20Config: redeemableERC20Config,
//           tier: erc20BalanceTier.address,
//           minimumTier: minimumTier,
//           distributionEndForwardingAddress: distributionEndForwardingAddress,
//         }
//       );

//       // Creating the instance for contracts
//       redeemableERC20Contract = (await Util.getContractChild(
//         sale.deployTransaction,
//         redeemableERC20Factory,
//         redeemableTokenJson
//       )) as RedeemableERC20;

//       await waitForSubgraphToBeSynced();
//     });

//     it("should query as null the reserve when is a non-ERC20 token", async function () {
//       const [blockDeploy, timeDeploy] = await Util.getTxTimeblock(
//         sale.deployTransaction
//       );

//       const query = `
//         {
//           sale (id: "${sale.address.toLowerCase()}") {
//             reserve {
//               id
//               name
//               symbol
//               decimals
//               totalSupply
//               deployBlock
//               deployTimestamp
//             }
//           }
//         }
//       `;
//       const response = (await subgraph({
//         query,
//       })) as FetchResult;
//       const data = response.data.sale.reserve;

//       expect(data.id).to.equals(nonErc20.toLowerCase());
//       expect(data.name).to.be.null;
//       expect(data.symbol).to.be.null;
//       expect(data.decimals).to.be.null;
//       expect(data.totalSupply).to.be.null;

//       expect(data.deployBlock).to.equals(blockDeploy.toString());
//       expect(data.deployTimestamp).to.equals(timeDeploy.toString());
//     });
//   });
// });
