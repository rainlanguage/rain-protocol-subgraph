let
  pkgs = import
    (builtins.fetchTarball {
      name = "nixos-unstable-2021-10-01";
      url = "https://github.com/nixos/nixpkgs/archive/d3d2c44a26b693293e8c79da0c3e3227fc212882.tar.gz";
      sha256 = "0vi4r7sxzfdaxzlhpmdkvkn3fjg533fcwsy3yrcj5fiyqip2p3kl";
    })
    { };

  command = pkgs.writeShellScriptBin "command" ''
  '';

  hardhat-node = pkgs.writeShellScriptBin "hardhat-node" ''
    npx hardhat node
    # npx hardhat node &
    # sleep 5s
  '';

  graph-node = pkgs.writeShellScriptBin "graph-node" ''
    npm run graph-node
    # sleep 60s
  '';

  graph-test = pkgs.writeShellScriptBin "graph-test" ''
    npx hardhat test
  '';

  deploy-subgraph = pkgs.writeShellScriptBin "deploy-subgraph" ''
    ts-node scripts/index.ts
  '';

  get-contracts = pkgs.writeShellScriptBin "get-contracts" ''
    mkdir -p contracts && cp -r node_modules/@beehiveinnovation/rain-protocol/contracts .
    mkdir -p contracts/rain-statusfi && cp node_modules/@beehiveinnovation/rain-statusfi/contracts/*.sol contracts/rain-statusfi
    mkdir -p contracts/tier && cp node_modules/@vishalkale15107/rain-protocol/contracts/tier/ERC721BalanceTier*.sol contracts/tier
    mkdir -p contracts/test && cp node_modules/@vishalkale15107/rain-protocol/contracts/test/ReserveNFT.sol contracts/test
    npx hardhat compile
  '';
  
in
pkgs.stdenv.mkDerivation {
 name = "shell";
 buildInputs = [
  pkgs.yarn
  pkgs.nodejs-16_x
  pkgs.jq
  command
  hardhat-node
  graph-node
  graph-test
  deploy-subgraph
  get-contracts
 ];

 shellHook = ''
  source .env
  export PATH=$( npm bin ):$PATH
  # keep it fresh
  npm install --verbose --fetch-timeout 3000000
  get-contracts
 '';
}