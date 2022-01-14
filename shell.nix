let
 pkgs = import <nixpkgs> {};

   command = pkgs.writeShellScriptBin "command" ''
  '';

   test-graph = pkgs.writeShellScriptBin "test-graph" ''
    yarn hh-node &
    sleep 15s
    graph-node
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
