let
  pkgs = import
    (builtins.fetchTarball {
      name = "nixos-unstable-2021-10-01";
      url = "https://github.com/nixos/nixpkgs/archive/fa5e153653a1b48e4a21a14b341e2e01835ba8b5.tar.gz";
      sha256 = "1yvqxrw0ila4y6mryhpf32c8ydljfmfbvijxra2dawvhcfbbm2rw";
    })
    { };

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
  pkgs.nodejs-16_x
  pkgs.jq
  command
 ];

 shellHook = ''
  export PATH=$( npm bin ):$PATH
  yarn install
  (cd rain-protocol; git checkout 5972e90bdf137423ae9cbdd0f268bf8fd126ed65;)
  mkdir -p node_modules/@beehiveinnovation;
  cp -r rain-protocol node_modules/@beehiveinnovation;
  (cd node_modules/@beehiveinnovation/rain-protocol; npm install --ignore-scripts; npm run build;)
 '';
}
