let
 pkgs = import <nixpkgs> {};

   graph-test = pkgs.writeShellScriptBin "graph-test" ''
    yarn deploy-local;
    npx hardhat test;
  '';

   all-graph-test = pkgs.writeShellScriptBin "all-graph-test" ''
      npx hardhat node &
      sleep 30s
      docker-compose -f "docker/docker-compose.yml" up &
      sleep 60s
      npx hardhat test
      yarn deploy-build:localhost
  '';
  
in
pkgs.stdenv.mkDerivation {
 name = "shell";
 buildInputs = [
  pkgs.nodejs-14_x
  pkgs.jq
  graph-test
  all-graph-test
 ];

 shellHook = ''
  source .env
  export PATH=$( npm bin ):$PATH
  # keep it fresh
  yarn install
 '';
}
