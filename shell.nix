let
  pkgs = import <nixpkgs> {};

   command = pkgs.writeShellScriptBin "command" ''
  '';

   hh-node = pkgs.writeShellScriptBin "hh-node" ''
    yarn hh-node &
    # yarn hardhat node &
    sleep 5s
  '';

   graph-node = pkgs.writeShellScriptBin "graph-node" ''
    yarn graph-node &
    # docker-compose -f docker/docker-compose.yml up &
    sleep 60s
  '';

   deploy-test = pkgs.writeShellScriptBin "deploy-test" ''
    yarn deploy-test
  '';

   test-graph = pkgs.writeShellScriptBin "test-graph" ''
    yarn test
  '';

   run-test-graph = pkgs.writeShellScriptBin "run-test-graph" ''
    hh-node
    graph-node
    test-graph
  '';
  
in
pkgs.stdenv.mkDerivation {
  name = "shell";
  buildInputs = [
    pkgs.nixpkgs-fmt
    pkgs.yarn
    pkgs.nodejs-16_x
    pkgs.jq
    command
    hh-node
    graph-node
    deploy-test
    test-graph
    run-test-graph
 ];

 shellHook = ''
  source .env
  export PATH=$( npm bin ):$PATH
  yarn install
 '';
}
