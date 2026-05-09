import { initLogger } from '@finos/calm-shared';
import { readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export interface CLIConfig {
    calmHubUrl?: string
    allowedRemoteHosts?: string[]
}

export function getUserConfigLocation(): string {
    const homeDir = homedir();
    return join(homeDir, '.calm.json');
}

export async function saveCliConfig(config: CLIConfig): Promise<void> {
    const configFilePath = getUserConfigLocation();
    const json = JSON.stringify(config, null, 2) + '\n';
    await writeFile(configFilePath, json, 'utf8');
}

export async function loadCliConfig(): Promise<CLIConfig | null> {
    const logger = initLogger(false, 'calm-cli');

    const configFilePath = getUserConfigLocation();
    try {
        const config = await readFile(configFilePath, 'utf8');
        const parsed = JSON.parse(config) as CLIConfig;
        logger.debug('Parsed user config: ' + config);
        return parsed;
    }
    catch (err) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
            logger.debug('No config file found at ' + configFilePath);
            return null;
        }
        logger.error('Unexpected error loading user config: ' + String(err));
        return null;
    }
}
