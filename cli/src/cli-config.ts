import { initLogger } from '@finos/calm-shared';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export interface CLIConfig {
    calmHubUrl?: string
}

function getUserConfigLocation(): string {
    const homeDir = homedir();
    return join(homeDir, '.calm.json');
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
        if (err.code === 'ENOENT') {
            logger.debug('No config file found at ' + configFilePath);
            return null;
        }
        logger.error('Unexpected error loading user config: ', err);
        return null;
    }
}