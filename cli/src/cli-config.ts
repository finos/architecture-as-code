import { readFile, writeFile } from 'fs/promises';
import { initLogger, AuthPlugin } from '@finos/calm-shared';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { register } from 'ts-node';
import { pathToFileURL } from 'url';

export interface CLIConfig {
    calmHubUrl?: string
    allowedRemoteHosts?: string[]
    authPluginPath?: string
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

export function resolveHomeDir(path: string): string {
    if (path.startsWith('~')) {
        return join(homedir(), path.slice(1));
    }
    return path;
}

export async function loadAuthPlugin(filename: string, debug: boolean): Promise<AuthPlugin> {
    const logger = initLogger(debug, 'auth-plugin');

    filename = resolveHomeDir(filename);
    
    if (!existsSync(filename)) {
        logger.error(`❌ Auth plugin file not found: ${filename}`);
        throw new Error(`❌ Auth plugin file not found: ${filename}`);
    }
    if (filename.endsWith('.ts')) {
        logger.info(`🔍 Loading auth plugin as TypeScript: ${filename}`);
        register({
            transpileOnly: true,
            compilerOptions: {
                target: 'es2021',
                module: 'esnext',
                moduleResolution: 'node',
                esModuleInterop: true,
                sourceMap: true,
                inlineSourceMap: true,
                inlineSources: true,
            },
        });
    } else if (filename.endsWith('.js')) {
        logger.info(`🔍 Loading auth plugin as JavaScript: ${filename}`);
    } else {
        logger.error(`❌ Auth plugin file must have .js or .ts extension: ${filename}`);
        throw new Error(`❌ Auth plugin file must have .js or .ts extension: ${filename}`);
    }

    try {
        const url = pathToFileURL(filename).href;
        const mod = await import(/* @vite-ignore */ url);
        const AuthPluginClass = mod.default;
        if (typeof AuthPluginClass !== 'function') {
            throw new Error('❌ AuthPluginClass is not a constructor. Did you forget to export default?');
        }
        return new AuthPluginClass() as AuthPlugin;
    } catch (error) {
        logger.error(`❌ Error loading auth plugin: ${error}`);
        throw new Error(`❌ Error loading auth plugin: ${error}`);
    }
}
