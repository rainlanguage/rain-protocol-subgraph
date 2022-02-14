/* eslint-disable node/no-missing-import */
/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */

import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractTransaction, Signer } from "ethers";
import { ApolloFetch, FetchResult } from "apollo-fetch";
import * as path from "path";
import * as Util from "./utils/utils";
import { deploy, waitForSubgraphToBeSynced } from "./utils/utils";

import reserveToken from "@beehiveinnovation/rain-protocol/artifacts/contracts/test/ReserveTokenTest.sol/ReserveTokenTest.json";
import readWriteTierJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/tier/ReadWriteTier.sol/ReadWriteTier.json";
import redeemableERC20ClaimEscrowJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/escrow/RedeemableERC20ClaimEscrow.sol/RedeemableERC20ClaimEscrow.json";
import bPoolFeeEscrowJson from "@beehiveinnovation/rain-protocol/artifacts/contracts/escrow/BPoolFeeEscrow.sol/BPoolFeeEscrow.json";

import { ReserveTokenTest } from "@beehiveinnovation/rain-protocol/typechain/ReserveTokenTest";
import { ReadWriteTier } from "@beehiveinnovation/rain-protocol/typechain/ReadWriteTier";
import { RedeemableERC20ClaimEscrow } from "@beehiveinnovation/rain-protocol/typechain/RedeemableERC20ClaimEscrow";
import { BPoolFeeEscrow } from "@beehiveinnovation/rain-protocol/typechain/BPoolFeeEscrow";

import {
  deployer,
  signer1,
  signer2,
  trustFactory,
  redeemableERC20ClaimEscrow,
} from "./1_trustQueries.test";

let subgraph: ApolloFetch,
  reserve: ReserveTokenTest,
  tier: ReadWriteTier,
  transaction: ContractTransaction; // use to save/facilite a tx;

describe("Subgraph RedeemableERC20ClaimEscrow test", function () {
  before("creating and connecting", async function () {
    const localInfoPath = path.resolve(__dirname, "./utils/local_Info.json");
    const localInfoJson = JSON.parse(Util.fetchFile(localInfoPath));

    reserve = (await deploy(reserveToken, deployer, [])) as ReserveTokenTest;
    tier = (await deploy(readWriteTierJson, deployer, [])) as ReadWriteTier;

    // Connecting to the subgraph
    subgraph = Util.fetchSubgraph(
      localInfoJson.subgraphUser,
      localInfoJson.subgraphName
    );
  });

  it("should query GatedNFTFactory correctly after construction", async function () {
    await Util.delay(Util.wait);
    await waitForSubgraphToBeSynced(1000);

    const query = `
      {
        redeemableERC20ClaimEscrows {
            id
            address
            pendingDeposits {
              id
            }
            deposits {
              id
            }
            undeposits {
              id
            }
            withdraws {
              id
            }
            pendingDepositorTokens {
              id
            }
            supplyTokenDeposits {
              id
            }
            depositors {
              id
            }
            withdrawers {
              id
            }
        }
      }
    `;

    const queryResponse = (await subgraph({
      query: query,
    })) as FetchResult;

    const data = queryResponse.data.redeemableERC20ClaimEscrows[0];

    expect(queryResponse.data.redeemableERC20ClaimEscrows).to.have.lengthOf(1);

    expect(data.id).to.equals(redeemableERC20ClaimEscrow.address.toLowerCase());
    expect(data.address).to.equals(
      redeemableERC20ClaimEscrow.address.toLowerCase()
    );
  });
});
