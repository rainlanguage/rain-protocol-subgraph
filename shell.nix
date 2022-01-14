let
 pkgs = import <nixpkgs> {};

   command = pkgs.writeShellScriptBin "command" ''
  '';

   hh-node = pkgs.writeShellScriptBin "hh-node" ''
    yarn hh-node &
    sleep 15s
  '';

   graph-node = pkgs.writeShellScriptBin " graph-node" ''
    yarn graph-node &
    sleep 60s
  '';

   test-graph = pkgs.writeShellScriptBin "command" ''
    yarn test
  '';

   test-graph = pkgs.writeShellScriptBin "test-graph" ''
    yarn hh-node &
    sleep 15s
    yarn graph-node &
    sleep 60s
    yarn test
  '';
  
in
pkgs.stdenv.mkDerivation {
 name = "shell";
 buildInputs = [
  pkgs.nodejs-14_x
  pkgs.jq
  command
  test-graph
 ];

 shellHook = ''
  source .env
  export PATH=$( npm bin ):$PATH
  # keep it fresh
  yarn install
 '';
}
