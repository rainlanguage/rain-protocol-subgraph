import { expect, should } from "chai";
import { artifacts, ethers } from "hardhat";
import path from "path";
import {
  BountyConfigStruct,
  ClearEvent,
  AfterClearEvent,
  ClearStateChangeStruct,
  DepositConfigStruct,
  DepositEvent,
  OrderBook,
  OrderConfigStruct,
  OrderDeadEvent,
  OrderLiveEvent,
  WithdrawConfigStruct,
  WithdrawEvent,
} from "../typechain/OrderBook";
import {
  eighteenZeros,
  fetchFile,
  getEventArgs,
  waitForSubgraphToBeSynced,
} from "./utils/utils";
import { ReserveTokenTest__factory } from "../typechain/factories/ReserveTokenTest__factory";
import { ReserveTokenTest } from "../typechain/ReserveTokenTest";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { subgraph } from "./1_initQueries.test.";
import { FetchResult } from "apollo-fetch";
import { ContractTransaction } from "ethers";

export let orderBook: OrderBook;
export let reserveToken: ReserveTokenTest;

export let deployer: SignerWithAddress, depositor1: SignerWithAddress;

export const vaultId = 1;
export const amount = ethers.BigNumber.from(1 + eighteenZeros);

describe.only("Orderbook test", () => {
  let depositTx: ContractTransaction;
  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    depositor1 = signers[1];

    const pathExampleConfig = path.resolve(
      __dirname,
      "../config/localhost.json"
    );
    const config = JSON.parse(fetchFile(pathExampleConfig));

    orderBook = (await ethers.getContractAt(
      (
        await artifacts.readArtifact("OrderBook")
      ).abi,
      config.OrderBook
    )) as OrderBook;

    reserveToken = await new ReserveTokenTest__factory(deployer).deploy();
  });

  it("Should get contract from config and deploy testToken", async () => {
    expect(orderBook.address).to.be.not.null;
    expect(reserveToken.address).to.be.not.null;
  });

  it("Should create vaultDeposit entity correctly", async () => {
    await reserveToken.connect(deployer).transfer(depositor1.address, amount);
    await reserveToken.connect(depositor1).approve(orderBook.address, amount);

    const depositConfig: DepositConfigStruct = {
      token: reserveToken.address,
      vaultId: vaultId,
      amount: amount,
    };

    depositTx = await orderBook.connect(depositor1).deposit(depositConfig);

    const { sender: Depositor, config: DepositConfig } = (await getEventArgs(
      depositTx,
      "Deposit",
      orderBook
    )) as DepositEvent["args"];

    await waitForSubgraphToBeSynced();
    const query = `
      {
        vaultDeposit(id: "${depositTx.hash}"){
          id
          sender
          vaultId
          vault {
            id
          }
          amount
          token {
            id
          }
          tokenVault {
            id
          }
        }
      }
    `;

    const response = (await subgraph({ query })) as FetchResult;
    const vaultDeposit = response.data.vaultDeposit;

    expect(Depositor).to.be.equals(depositor1.address);
    expect(vaultDeposit.id).to.be.equals(depositTx.hash);

    expect(vaultDeposit.sender).to.equals(depositor1.address.toLowerCase());
    expect(vaultDeposit.vaultId).to.be.equal(vaultId.toString());
    expect(vaultDeposit.vault.id).to.equals(
      `${vaultId}-${depositor1.address.toLowerCase()}`.toLowerCase()
    );
    expect(vaultDeposit.amount).to.equals(amount.toString());
    expect(vaultDeposit.token.id).to.equals(reserveToken.address.toLowerCase());
    expect(vaultDeposit.tokenVault.id).to.equals(
      `${vaultId}-${
        depositor1.address
      }-${reserveToken.address.toLowerCase()}`.toLowerCase()
    );
  });

  it("Should create vault entity correctly", async () => {
    const query = `
      {
        vault(id: "${vaultId}-${depositor1.address.toLowerCase()}"){
          id
          tokenVaults{
            id
          }
          deposits{
            id
          }
          withdraws{
            id
          }
        }
      }
    `;

    const resposne = (await subgraph({ query })) as FetchResult;
    const vault = resposne.data.vault;

    expect(vault.tokenVaults).to.be.lengthOf(1);
    expect(vault.deposits).to.be.lengthOf(1);
    expect(vault.withdraws).to.be.lengthOf(0);

    expect(vault.tokenVaults).to.deep.include({
      id: `${vaultId}-${
        depositor1.address
      }-${reserveToken.address.toLowerCase()}`.toLowerCase(),
    });

    expect(vault.deposits).to.deep.include({
      id: depositTx.hash,
    });
  });

  it("Should create ERC20 Token entity", async () => {
    const query = `
      {
        erc20(id: "${reserveToken.address.toLowerCase()}"){
          id
          name
          symbol
          decimals
          totalSupply
        }
      }
    `;

    const response = (await subgraph({ query })) as FetchResult;
    const erc20 = response.data.erc20;

    expect(erc20.id).to.equals(reserveToken.address.toLowerCase());
    expect(erc20.name).to.equals(await reserveToken.name());
    expect(erc20.symbol).to.equals(await reserveToken.symbol());
    expect(erc20.decimals).to.equals(await await reserveToken.decimals());
    expect(erc20.totalSupply).to.equals(
      (await reserveToken.totalSupply()).toString()
    );
  });
});
