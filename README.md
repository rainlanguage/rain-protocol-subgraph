// TODO Improve this documentation
## Development setup (for contributors)

### Nix Shell

Install the nix shell if you haven't already.

```
curl -L https://nixos.org/nix/install | sh
```

Drop into a nix-shell.

```
nix-shell
```

This will install all the dependencies correctly. The first time will take a while.

### Prepare setup

You can deploy the subgraph to a existing node or locally with your own node. To prepare you should:

### Run tests

To complete the setup, you need to run the necessary local nodes (Hardhat and TheGraph). Follow the next steps: - In the actual terminal run: `yarn hardhat-node` to start the hardhat local node. - In a new terminal run: `yarn graph-node` to start the Graph Node. Should wait until the node is started (~50 seconds) - In a new terminal run: `yarn test` to deploy and run the tests.

You can see GUI of the local subgraph on: `http://localhost:8000/subgraphs/name/vishalkale151071/rain-protocol/graphql`

### Running Graph Node on an Macbook M1
  
We do not currently build native images for Macbook M1, which can lead to processes being killed due to out-of-memory errors (code 137). Based on the example `docker-compose.yml` is possible to rebuild the image for your M1 by running the following, then running `docker-compose up` as normal:
 
```
# Remove the original image
docker rmi graphprotocol/graph-node:latest

# Build the image
./docker/build.sh

# Tag the newly created image
docker tag graph-node graphprotocol/graph-node:latest
```