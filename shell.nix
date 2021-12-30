let
 pkgs = import <nixpkgs> {};

   graph-test = pkgs.writeShellScriptBin "graph-test" ''
    yarn deploy-local;
    npx hardhat test;
  '';

   all-graph-test = pkgs.writeShellScriptBin "all-graph-test" ''
    yarn deploy-local;
    npx hardhat test;
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
