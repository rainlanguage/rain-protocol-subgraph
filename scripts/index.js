"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var child_process_1 = require("child_process");
var dotenv = require("dotenv");
var path = require("path");
var fs = require("fs");
var deployConfig = require("./deployConfig.json");
dotenv.config();
/**
 * Execute Child Processes
 * @param cmd Command to execute
 * @returns The command ran it
 */
var exec = function (cmd) {
    var srcDir = path.join(__dirname, "..");
    try {
        return (0, child_process_1.execSync)(cmd, { cwd: srcDir, stdio: "inherit" });
    }
    catch (e) {
        throw new Error("Failed to run command `".concat(cmd, "`"));
    }
};
/**
 * Read a file a return it as string
 * @param _path Location of the file
 * @returns The file as string
 */
var fetchFile = function (_path) {
    try {
        return fs.readFileSync(_path).toString();
    }
    catch (error) {
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
var writeFile = function (_path, file) {
    try {
        fs.writeFileSync(_path, file);
    }
    catch (error) {
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
var checkEndpoint = function (endpoint) {
    if (endpoint === "default" || "") {
        return "--node https://api.thegraph.com/deploy/";
    }
    else {
        return "--node ".concat(endpoint.slice(-1) === "/" ? endpoint : endpoint + "/");
    }
};
var checkIpfsEndpoint = function (endpoint) {
    if (endpoint === "default" || "") {
        return "";
    }
    else {
        return "--ipfs ".concat(endpoint);
    }
};
var createLabel = function (label) {
    if (label === "default" || "") {
        return "";
    }
    else {
        return "--version-label ".concat(label);
    }
};
var getDeployConfig = function (config) {
    var subgraphName = config.subgraphName;
    var configPath = config.configPath;
    var endpoint = checkEndpoint(config.endpoint);
    var ipfsEndpoint = checkIpfsEndpoint(config.ipfsEndpoint);
    var versionLabel = createLabel(config.versionLabel);
    return {
        subgraphName: subgraphName,
        configPath: configPath,
        endpoint: endpoint,
        ipfsEndpoint: ipfsEndpoint,
        versionLabel: versionLabel
    };
};
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, subgraphName, configPath, endpoint, ipfsEndpoint, versionLabel, prepareCommand;
    return __generator(this, function (_b) {
        _a = getDeployConfig(deployConfig), subgraphName = _a.subgraphName, configPath = _a.configPath, endpoint = _a.endpoint, ipfsEndpoint = _a.ipfsEndpoint, versionLabel = _a.versionLabel;
        prepareCommand = "npx mustache ".concat(configPath, " subgraph.template.yaml subgraph.yaml");
        exec(prepareCommand);
        exec("npm run generate-schema && npm run codegen && npm run build");
        // This create the graph node with the endpoint and subgraph name
        if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
            console.log("endpoint", endpoint);
            console.log("subgraphName", subgraphName);
            exec("npx graph create ".concat(endpoint, " ").concat(subgraphName));
        }
        exec("npx graph deploy ".concat(endpoint, " ").concat(ipfsEndpoint, " ").concat(subgraphName, " ").concat(versionLabel));
        return [2 /*return*/];
    });
}); };
main()
    .then(function () {
    var exit = process.exit;
    exit(0);
})["catch"](function (error) {
    console.error(error);
    var exit = process.exit;
    exit(1);
});
