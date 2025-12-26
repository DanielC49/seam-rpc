#!/usr/bin/env node

import { genClient } from "./gen-client.js";
import { genConfig } from "./gen-config.js";

main();

function main() {
    const args = process.argv;

    switch (args[2]) {
        case "gen-client":
            genClient();
            break;
        case "gen-config":
            genConfig();
            break;
        default:
            console.log("Commands:\n- seam-rpc gen-client <input-files> <output-folder>\n- seam-rpc gen-config [input-files] [output-folder]");
    }
}

export interface SeamConfig {
    inputFiles: string;
    outputFolder: string;
}