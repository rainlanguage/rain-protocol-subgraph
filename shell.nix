let
 pkgs = import <nixpkgs> {};

   command = pkgs.writeShellScriptBin "command" ''
  '';

   hardhat-node = pkgs.writeShellScriptBin "hardhat-node" ''
    yarn hardhat-node &
    sleep 5s
  '';

   graph-node = pkgs.writeShellScriptBin "graph-node" ''
    yarn graph-node &
    sleep 60s
  '';

   graph-test = pkgs.writeShellScriptBin "graph-test" ''
    yarn test
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
 ];

 shellHook = ''
  source .env
  export PATH=$( npm bin ):$PATH
  # keep it fresh
  yarn install
  (cd node_modules/@beehiveinnovation/rain-protocol && [ ! -d artifacts ] && yarn install --ignore-scripts && yarn build)
  (cd node_modules/@vishalkale15107/rain-protocol && [ ! -d artifacts ] && rm -rf yarn.lock && yarn install --ignore-scripts && yarn build)
  (cd node_modules/@beehiveinnovation/rain-statusfi && [ ! -d artifacts ] && yarn install --ignore-scripts && yarn build)
 '';
}