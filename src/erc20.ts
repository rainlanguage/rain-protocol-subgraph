// import { ERC20, StakeERC20 } from "../generated/schema";\
import { ERC20 } from "../generated/schema";

import {
  Transfer,
  ERC20 as ERC20Contract,
} from "../generated/templates/ERC20Template/ERC20";
import { ZERO_BI } from "./utils";

export function handleTransfer(event: Transfer): void {
  let erc20 = ERC20.load(event.address.toHex());
  let erc20Contract = ERC20Contract.bind(event.address);
  // if (erc20) {
  //   let stakeContracts = erc20.stakeContracts;
  //   if (stakeContracts && stakeContracts.includes(event.params.to.toHex())) {
  //     let stakeERC20 = StakeERC20.load(event.params.to.toHex());
  //     if (stakeERC20) {
  //       let stakeContract = Stake.bind(event.params.to);
  //       stakeERC20.tokenPoolSize = erc20Contract.balanceOf(event.params.to);
  //       stakeERC20.totalSupply = stakeContract.totalSupply();

  //       if (stakeERC20.tokenPoolSize != ZERO_BI) {
  //         stakeERC20.tokenToStakeTokenRatio = stakeERC20.totalSupply.div(
  //           stakeERC20.tokenPoolSize
  //         );
  //       }

  //       if (stakeERC20.totalSupply != ZERO_BI) {
  //         stakeERC20.stakeTokenToTokenRatio = stakeERC20.tokenPoolSize.div(
  //           stakeERC20.totalSupply
  //         );
  //       }
  //       stakeERC20.save();
  //     }
  //   }
  // }
}
