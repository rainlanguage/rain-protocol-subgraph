import { Contract, Signer } from "ethers";

import { createApolloFetch } from "apollo-fetch";
import path from "path";
import { execSync } from "child_process";

// Balancer contracts
import BFactory from "@beehiveinnovation/balancer-core/artifacts/BFactory.json";
import SmartPoolManager from "@beehiveinnovation/configurable-rights-pool/artifacts/SmartPoolManager.json";
import BalancerSafeMath from "@beehiveinnovation/configurable-rights-pool/artifacts/BalancerSafeMath.json";
import RightsManager from "@beehiveinnovation/configurable-rights-pool/artifacts/RightsManager.json";
import CRPFactory from "@beehiveinnovation/configurable-rights-pool/artifacts/CRPFactory.json";

// // Rain protocol contracts
import RedeemableERC20Factory from "@beehiveinnovation/rain-protocol/artifacts/contracts/redeemableERC20/RedeemableERC20Factory.sol/RedeemableERC20Factory.json";
import SeedERC20Factory from "@beehiveinnovation/rain-protocol/artifacts/contracts/seed/SeedERC20Factory.sol/SeedERC20Factory.json";
import TrustFactory from "@beehiveinnovation/rain-protocol/artifacts/contracts/trust/TrustFactory.sol/TrustFactory.json";

const { ethers } = require("hardhat");

export const eighteenZeros = "000000000000000000";
export const sixZeros = "000000";
export const CREATOR_FUNDS_RELEASE_TIMEOUT_TESTING = 100;
export const MAX_RAISE_DURATION_TESTING = 100;

// Execute Child Processes
const srcDir = path.join(__dirname, "..");
export const exec = (cmd: string) => {
  try {
    return execSync(cmd, { cwd: srcDir, stdio: "inherit" });
  } catch (e) {
    throw new Error(`Failed to run command \`${cmd}\``);
  }
};

// Subgraph Management
export const fetchSubgraphs = createApolloFetch({
  uri: "http://localhost:8030/graphql",
});

export const waitForSubgraphToBeSynced = async (delay: number) =>
  new Promise<{ synced: boolean }>((resolve, reject) => {
    // Wait for 5s
    const deadline = Date.now() + 15 * 1000;

    // Function to check if the subgraph is synced
    const checkSubgraphSynced = async () => {
      try {
        const result = await fetchSubgraphs({
          query: `{
            indexingStatusForCurrentVersion(subgraphName: "vishalkale151071/rain-protocol") {
              synced
              health
              fatalError{
                message
                handler
              }
            } 
          }`,
        });
        if (result.data.indexingStatusForCurrentVersion.synced === true) {
          resolve({ synced: true });
        } else {
          throw new Error("reject or retry");
        }
      } catch (e) {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for the subgraph to sync`));
        } else {
          setTimeout(checkSubgraphSynced, delay);
        }
      }
    };

    // Periodically check whether the subgraph has synced
    setTimeout(checkSubgraphSynced, delay);
  });

// Contracts Management
export const deploy = async (
  artifact: any,
  signer: any,
  argmts: any[] | any
): Promise<Contract> => {
  const iface = new ethers.utils.Interface(artifact.abi);
  const factory = new ethers.ContractFactory(iface, artifact.bytecode, signer);
  const contract = await factory.deploy(...argmts);
  await contract.deployTransaction.wait();
  return contract;
};

export const balancerDeploy = async (
  signer: Signer
): Promise<[Contract, Contract]> => {
  const bFactory: Contract = await deploy(BFactory, signer, []);

  const smartPoolManager: Contract = await deploy(SmartPoolManager, signer, []);
  const balancerSafeMath: Contract = await deploy(BalancerSafeMath, signer, []);
  const rightsManager: Contract = await deploy(RightsManager, signer, []);

  const libs = {
    SmartPoolManager: smartPoolManager.address,
    BalancerSafeMath: balancerSafeMath.address,
    RightsManager: rightsManager.address,
  };
  const crpFactory: Contract = await deploy(
    linkBytecode(CRPFactory, libs),
    signer,
    []
  );
  return [crpFactory, bFactory];
};

const linkBytecode = (artifact: any, links: any) => {
  Object.keys(links).forEach((library_name) => {
    const library_address = links[library_name];
    const regex = new RegExp(`__${library_name}_+`, "g");
    artifact.bytecode = artifact.bytecode.replace(
      regex,
      library_address.replace("0x", "")
    );
  });
  return artifact;
};

export const factoriesDeploy = async (
  crpFactory: Contract,
  balancerFactory: Contract,
  signer: Signer
): Promise<any> => {
  const redeemableERC20Factory = await deploy(
    RedeemableERC20Factory,
    signer,
    []
  );
  await redeemableERC20Factory.deployed();

  const seedERC20Factory = await deploy(SeedERC20Factory, signer, []);
  await seedERC20Factory.deployed();

  const TrustFactoryArgs = {
    redeemableERC20Factory: redeemableERC20Factory.address,
    seedERC20Factory: seedERC20Factory.address,
    crpFactory: crpFactory.address,
    balancerFactory: balancerFactory.address,
    creatorFundsReleaseTimeout: CREATOR_FUNDS_RELEASE_TIMEOUT_TESTING,
    maxRaiseDuration: MAX_RAISE_DURATION_TESTING,
  };
  const trustFactory = await deploy(TrustFactory, signer, [TrustFactoryArgs]);
  await trustFactory.deployed();

  return {
    redeemableERC20Factory,
    seedERC20Factory,
    trustFactory,
  };
};
