import { program } from "commander";
import { access, constants, open, readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

export interface CLIConfig {
    calmHubUrl?: string
}

export async function loadCliConfig(): Promise<CLIConfig | null> {
    const homeDir = homedir();
    const configFilePath = join(homeDir, '.calm.json');
    try {
        const config = await readFile(configFilePath, 'utf8');
        const parsed = JSON.parse(config) as CLIConfig;
        console.log('Parsed config: ' + config)
        return parsed
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            console.log('No config file found at ' + configFilePath)
            return null
        }
        console.error(err)
    }
}