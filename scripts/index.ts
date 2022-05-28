import { execSync } from "child_process";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as deployConfig from "./deployConfig.json";

dotenv.config();

interface DeployConfig {
  configPath: string;
  subgraphName: string;
  versionLabel: string;
  endpoint: string;
  ipfsEndpoint: string;
}

/**
 * Execute Child Processes
 * @param cmd Command to execute
 * @returns The command ran it
 */
const exec = (cmd: string): string | Buffer => {
  const srcDir = path.join(__dirname, "..");
  try {
    return execSync(cmd, { cwd: srcDir, stdio: "inherit" });
  } catch (e) {
    throw new Error(`Failed to run command \`${cmd}\``);
  }
};

/**
 * Read a file a return it as string
 * @param _path Location of the file
 * @returns The file as string
 */
const fetchFile = (_path: string): string => {
  try {
    return fs.readFileSync(_path).toString();
  } catch (error) {
    console.log(error);
    return "";
  }
};

/**
 * Write a file
 * @param _path Location of the file
 * @param file The file
 */
// eslint-disable-next-line
const writeFile = (_path: string, file: any): void => {
  try {
    fs.writeFileSync(_path, file);
  } catch (error) {
    console.log(error);
  }
};

/**
 * Check the endpoint where the subgraph will be deployed. If default is used, will return TheGraph endpoint
 * `https://api.thegraph.com/deploy/`. In other case, user should check the endpoint and function just will
 * check the slash at the end of the endpoint
 * @param endpoint The desired endpoint. Set `default` is want to use the TheGraph endpoint.
 * @returns The checked endpoint
 */
const checkEndpoint = (endpoint: string): string => {
  if (endpoint === "default" || "") {
    return "--node https://api.thegraph.com/deploy/";
  } else {
    return `--node ${endpoint.slice(-1) === "/" ? endpoint : endpoint + "/"}`;
  }
};

const checkIpfsEndpoint = (endpoint: string): string => {
  if (endpoint === "default" || "") {
    return "";
  } else {
    return `--ipfs ${endpoint}`;
  }
};

const createLabel = (label: string): string => {
  if (label === "default" || "") {
    return "";
  } else {
    return `--version-label ${label}`;
  }
};

const getDeployConfig = (config: DeployConfig): DeployConfig => {
  const subgraphName = config.subgraphName;
  const configPath = config.configPath;
  const endpoint = checkEndpoint(config.endpoint);
  const ipfsEndpoint = checkIpfsEndpoint(config.ipfsEndpoint);
  const versionLabel = createLabel(config.versionLabel);
  return {
    subgraphName,
    configPath,
    endpoint,
    ipfsEndpoint,
    versionLabel,
  };
};

const main = async () => {
  const { subgraphName, configPath, endpoint, ipfsEndpoint, versionLabel } =
    getDeployConfig(deployConfig);

  // const prepareCommand = `npx mustache ${configPath} subgraph.template.yaml subgraph.yaml`;

  // exec(prepareCommand);
  exec(`npx mustache ${configPath} subgraph.template.yaml subgraph.yaml`);
  exec("npm run generate-schema && npm run codegen && npm run build");

  // This create the graph node with the endpoint and subgraph name
  if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
    exec(`npx graph create ${endpoint} ${subgraphName}`);
  }

  exec(
    `npx graph deploy ${endpoint} ${ipfsEndpoint} ${subgraphName} ${versionLabel}`
  );
};

main()
  .then(() => {
    const exit = process.exit;
    exit(0);
  })
  .catch((error) => {
    console.error(error);
    const exit = process.exit;
    exit(1);
  });
