import { expect } from "chai";
import { ethers } from "hardhat";
import { waitForSubgraphToBeSynced } from "./utils/utils";
import * as Util from "./utils/utils";
import { Tier, op, OpcodeEmissionsERC20 } from "./utils/utils";
import { concat } from "ethers/lib/utils";

import {
  subgraph,
  deployer,
  creator,
  signer1,
  emissionsERC20Factory,
} from "./1_trustQueries.test";

// Typechain factories
import { ReadWriteTier__factory } from "../typechain/factories/ReadWriteTier__factory";

// Types
import type { FetchResult } from "apollo-fetch";
import type { ContractTransaction } from "ethers";
import type { ReadWriteTier } from "../typechain/ReadWriteTier";
import type {
  EmissionsERC20,
  SnapshotEvent,
} from "../typechain/EmissionsERC20";

let emissionsERC20: EmissionsERC20,
  readWriteTier: ReadWriteTier,
  transaction: ContractTransaction;

describe("EmissionsERC20 queries test", function () {
  const claimAmount = 123;
  const allowDelegatedClaims = true;

  const vmStateConfig = {
    sources: [concat([op(OpcodeEmissionsERC20.VAL)])],
    constants: [claimAmount],
    argumentsLength: 0,
    stackLength: 1,
  };

  before("", async function () {
    readWriteTier = await new ReadWriteTier__factory(deployer).deploy();
  });

  it("should query the EmissionsERC20Factory after construction correctly", async function () {
    // Get the EmissionsERC20 implementation
    const implementation = await Util.getImplementation(emissionsERC20Factory);

    const query = `
      {
        emissionsERC20Factory (id: "${emissionsERC20Factory.address.toLowerCase()}") {
          address
          implementation
        }
      }
    `;

    const response = (await subgraph({
      query,
    })) as FetchResult;

    const data = response.data.emissionsERC20Factory;

    expect(data.address).to.equals(emissionsERC20Factory.address.toLowerCase());
    expect(data.implementation).to.equals(implementation.toLowerCase());
  });

  it("should query the EmissionsERC20 child from factory after creation", async function () {
    // ERC20 Config
    const erc20Config = {
      name: "Emissions",
      symbol: "EMS",
      distributor: signer1.address,
      initialSupply: 0,
    };

    // Creating a child
    emissionsERC20 = await Util.emissionsDeploy(
      emissionsERC20Factory,
      creator,
      {
        allowDelegatedClaims: allowDelegatedClaims,
        erc20Config: erc20Config,
        vmStateConfig: vmStateConfig,
      }
    );

    // Wait for sync
    await waitForSubgraphToBeSynced();

    const query = `
      {
        emissionsERC20Factory (id: "${emissionsERC20Factory.address.toLowerCase()}") {
          children {
            id
          }
        }
      }
    `;

    const response = (await subgraph({
      query,
    })) as FetchResult;

    const data = response.data.emissionsERC20Factory;

    expect(data.children).deep.include({
      id: emissionsERC20.address.toLowerCase(),
    });
  });

  it("should query EmissionsERC20 deploy information correclty", async function () {
    const [block, timestamp] = await Util.getTxTimeblock(
      emissionsERC20.deployTransaction
    );

    const query = `
      {
        emissionsERC20 (id: "${emissionsERC20.address.toLowerCase()}") {
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

    const response = (await subgraph({
      query,
    })) as FetchResult;
    const data = response.data.emissionsERC20;

    expect(data.address).to.equals(emissionsERC20.address.toLowerCase());

    expect(data.deployer).to.equals(creator.address.toLowerCase());

    expect(data.deployBlock).to.equals(block.toString());

    expect(data.deployTimestamp).to.equals(timestamp.toString());

    expect(data.factory.id).to.equals(
      emissionsERC20Factory.address.toLowerCase()
    );
  });

  it("should query EmissionsERC20 token information correclty", async function () {
    const query = `
      {
        emissionsERC20 (id: "${emissionsERC20.address.toLowerCase()}") {
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
    const data = response.data.emissionsERC20;

    expect(data.name).to.equals(await emissionsERC20.name());
    expect(data.symbol).to.equals(await emissionsERC20.symbol());
    expect(data.decimals).to.equals(await emissionsERC20.decimals());
    expect(data.totalSupply).to.equals(await emissionsERC20.totalSupply());
  });

  it("should query EmissionsERC20 config information correclty", async function () {
    const query = `
      {
        emissionsERC20 (id: "${emissionsERC20.address.toLowerCase()}") {
          allowDelegatedClaims
          calculateClaimStateConfig {
            id
          }
          claims {
            id
          }
        }
      }
    `;

    const response = (await subgraph({
      query,
    })) as FetchResult;
    const data = response.data.emissionsERC20;

    console.log(JSON.stringify(data, null, 2));

    expect(data.claims).to.be.empty;
    expect(data.allowDelegatedClaims).to.equals(allowDelegatedClaims);
    expect(data.calculateClaimStateConfig.id).to.equals(
      emissionsERC20.deployTransaction.hash.toLowerCase()
    );
  });

  it("should query the State config of the EmissionsERC20 correclty", async function () {
    // Get the state from initialization with Snapshot event
    const { state } = (await Util.getEventArgs(
      emissionsERC20.deployTransaction,
      "Snapshot",
      emissionsERC20
    )) as SnapshotEvent["args"];

    // Using the values form Event and converting to strings
    const stackIndexExpected = state.stackIndex.toString();
    const stackExpected = Util.arrayToString(state.stack);
    const sourcesExpected = state.sources;
    const constantsExpected = Util.arrayToString(state.constants);
    const argumentsExpected = Util.arrayToString(state.arguments);

    const query = `
      {
        state (id: "${emissionsERC20.deployTransaction.hash.toLowerCase()}") {
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

    console.log(JSON.stringify(data, null, 2));

    expect(data.stackIndex).to.equals(stackIndexExpected);
    expect(data.stack).to.equals(stackExpected);
    expect(data.sources).to.equals(sourcesExpected);
    expect(data.constants).to.equals(constantsExpected);
    expect(data.arguments).to.equals(argumentsExpected);
  });
});
