import { Contract, Signer } from "ethers";

import BFactory from "@beehiveinnovation/balancer-core/artifacts/BFactory.json";
import SmartPoolManager from "@beehiveinnovation/configurable-rights-pool/artifacts/SmartPoolManager.json";
import BalancerSafeMath from "@beehiveinnovation/configurable-rights-pool/artifacts/BalancerSafeMath.json";
import RightsManager from "@beehiveinnovation/configurable-rights-pool/artifacts/RightsManager.json";
import CRPFactory from "@beehiveinnovation/configurable-rights-pool/artifacts/CRPFactory.json";

import RedeemableERC20Factory from "@beehiveinnovation/rain-protocol/artifacts/RedeemableERC20Factory.json";
import RedeemableERC20PoolFactory from "@beehiveinnovation/rain-protocol/artifacts/RedeemableERC20PoolFactory.json";
import SeedERC20Factory from "@beehiveinnovation/rain-protocol/artifacts/SeedERC20Factory.json";
import TrustFactory from "@beehiveinnovation/rain-protocol/artifacts/TrustFactory.json";
import ConfigurableRightsPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/ConfigurableRightsPool.json";
import BPoolJson from "@beehiveinnovation/configurable-rights-pool/artifacts/BPool.json";
import TrustJson from "@beehiveinnovation/rain-protocol/artifacts/Trust.json";

import type { ConfigurableRightsPool } from "@beehiveinnovation/rain-protocol//typechain/ConfigurableRightsPool";
import type { BPool } from "@beehiveinnovation/rain-protocol//typechain/BPool";
import type { RedeemableERC20Pool } from "@beehiveinnovation/rain-protocol//typechain/RedeemableERC20Pool";
import type { Trust } from "@beehiveinnovation/rain-protocol/typechain/Trust";

const { ethers } = require("hardhat");

export const eighteenZeros = "000000000000000000";
export const sixZeros = "000000";

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
  const ReedERC20PoolFactArgs = [crpFactory.address, balancerFactory.address];
  const redeemableERC20PoolFactory = await deploy(
    RedeemableERC20PoolFactory,
    signer,
    [ReedERC20PoolFactArgs]
  );

  const seedERC20Factory = await deploy(SeedERC20Factory, signer, []);

  const TrustFactoryArgs = [
    redeemableERC20Factory.address,
    redeemableERC20PoolFactory.address,
    seedERC20Factory.address,
  ];
  const trustFactory = await deploy(TrustFactory, signer, [TrustFactoryArgs]);
  return {
    redeemableERC20Factory,
    redeemableERC20PoolFactory,
    seedERC20Factory,
    trustFactory,
  };
};

export const trustDeploy = async (
  trustFactory: any,
  creator: any,
  ...args: any
) => {
  const tx = await trustFactory[
    // "createChild((address,uint256,address,uint256,uint16,uint16,uint256),(string,string,address,uint8,uint256),(address,uint256,uint256,uint256,uint256))"
    "createChild((address,uint256,address,uint256,uint16,uint16,uint256,(string,string)),((string,string),address,uint8,uint256),(address,uint256,uint256,uint256,uint256))"
  ](...args);
  const receipt = await tx.wait();

  // Getting the address, and get the contract abstraction
  const trust = new ethers.Contract(
    ethers.utils.hexZeroPad(
      ethers.utils.hexStripZeros(
        receipt.events?.filter(
          (x: any) =>
            x.event === "NewContract" &&
            ethers.utils.getAddress(x.address) ===
              ethers.utils.getAddress(trustFactory.address)
        )[0].topics[1]
      ),
      20 // address bytes length
    ),
    TrustJson.abi,
    creator
  ) as Trust;

  if (!ethers.utils.isAddress(trust.address)) {
    throw new Error(
      `invalid trust address: ${trust.address} (${trust.address.length} chars)`
    );
  }

  await trust.deployed();

  return trust;
};

export const poolContracts = async (
  signers: any,
  pool: RedeemableERC20Pool
): Promise<[ConfigurableRightsPool, BPool]> => {
  const crp = new ethers.Contract(
    await pool.crp(),
    ConfigurableRightsPoolJson.abi,
    signers[0]
  ) as ConfigurableRightsPool;
  const bPool = new ethers.Contract(
    await crp.bPool(),
    BPoolJson.abi,
    signers[0]
  ) as BPool;
  return [crp, bPool];
};

export const waitForBlock = async (blockNumber: any): Promise<any> => {
  const currentBlock = await ethers.provider.getBlockNumber();

  if (currentBlock >= blockNumber) {
    return;
  }

  console.log({
    currentBlock,
    awaitingBlock: blockNumber,
  });

  await timeout(2000);

  return await waitForBlock(blockNumber);
};

function timeout(ms: any) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
