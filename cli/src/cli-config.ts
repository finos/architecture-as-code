import { readFile, writeFile } from 'fs/promises';
import { initLogger, AuthPlugin, DirectUrlAuthPlugin } from '@finos/calm-shared';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

export interface DirectUrlAuthConfig {
    module: string
    configPath?: string
    supportedRepos: string[]
}

export interface CLIConfig {
    calmHubUrl?: string
    allowedRemoteHosts?: string[]
    authPluginPath?: string
    directUrlAuth?: DirectUrlAuthConfig
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

export async function loadCliConfig(): Promise<CLIConfig> {
    const logger = initLogger(false, 'calm-cli');

    const configFilePath = getUserConfigLocation();
    try {
        const config = await readFile(configFilePath, 'utf8');
        const parsed = JSON.parse(config) as CLIConfig;
        logger.debug('Parsed user config: ' + config);
        return mergeWithEnvVars(parsed);
    }
    catch (err) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
            logger.debug('No config file found at ' + configFilePath);
        } else {
            logger.error('Unexpected error loading user config: ' + String(err));
        }
        return mergeWithEnvVars({});
    }
}

/**
 * Merge the loaded config with environment variables, giving precedence to environment variables if they are set. This allows users to override config file values with environment variables, which can be useful for CI/CD or temporary overrides without modifying the config file.
 * @param config The config to merge with environment variables.
 * @returns The merged config.
 */
export function mergeWithEnvVars(config: CLIConfig): CLIConfig {
    return {
        calmHubUrl: process.env.CALM_HUB_URL || config.calmHubUrl,
        allowedRemoteHosts: process.env.CALM_ALLOWED_REMOTE_HOSTS ? process.env.CALM_ALLOWED_REMOTE_HOSTS.split(',') : config.allowedRemoteHosts,
        authPluginPath: process.env.CALM_AUTH_PLUGIN_PATH || config.authPluginPath,
        directUrlAuth: config.directUrlAuth,
    };
}

export function resolveHomeDir(path: string): string {
    if (path.startsWith('~')) {
        return join(homedir(), path.slice(1));
    }
    return path;
}

function isHost(value: string): boolean {
    if (!value || value !== value.trim() || value.includes('*')) {
        return false;
    }

    try {
        const url = new URL(`http://${value}`);
        return url.hostname.toLowerCase() === value.toLowerCase();
    } catch {
        return false;
    }
}

export function validateDirectUrlAuthConfig(config: unknown): asserts config is DirectUrlAuthConfig {
    if (!config || typeof config !== 'object') {
        throw new Error('directUrlAuth must be an object.');
    }

    const candidate = config as { module?: unknown; configPath?: unknown; supportedRepos?: unknown };
    if (typeof candidate.module !== 'string' || !candidate.module.trim()) {
        throw new Error('directUrlAuth.module must be a non-empty string.');
    }
    if (candidate.configPath !== undefined && (typeof candidate.configPath !== 'string' || !candidate.configPath.trim())) {
        throw new Error('directUrlAuth.configPath must be a non-empty string when specified.');
    }
    if (!Array.isArray(candidate.supportedRepos) || candidate.supportedRepos.length === 0) {
        throw new Error('directUrlAuth.supportedRepos must be a non-empty array of hostnames.');
    }
    if (!candidate.supportedRepos.every(repo => typeof repo === 'string' && isHost(repo))) {
        throw new Error('directUrlAuth.supportedRepos must contain hostnames only; URLs, ports, paths, and wildcards are not supported.');
    }
}

async function loadPluginClassInstance<T>(
    filename: string,
    debug: boolean,
    logPrefix: string,
    validationMessage: string,
    constructorArgs: unknown[]
): Promise<T> {
    const logger = initLogger(debug, logPrefix);

    filename = resolveHomeDir(filename);

    if (!existsSync(filename)) {
        logger.error(`❌ ${logPrefix} file not found: ${filename}`);
        throw new Error(`❌ ${logPrefix} file not found: ${filename}`);
    }
    if (!filename.endsWith('.js')) {
        logger.error(`❌ ${logPrefix} file must have a .js extension: ${filename}`);
        throw new Error(`❌ ${logPrefix} file must have a .js extension: ${filename}`);
    }
    logger.info(`🔍 Loading ${logPrefix}: ${filename}`);

    try {
        const url = pathToFileURL(filename).href;
        const mod = await import(/* @vite-ignore */ url);
        const PluginClass = mod.default;
        if (typeof PluginClass !== 'function') {
            throw new Error(`❌ ${logPrefix} must export a default class. Did you forget to export default?`);
        }
        const instance = new PluginClass(...constructorArgs) as T;
        const candidate = instance as { getAuthHeaders?: unknown };
        if (typeof candidate.getAuthHeaders !== 'function') {
            throw new Error(validationMessage);
        }
        return instance;
    } catch (error) {
        logger.error(`❌ Error loading ${logPrefix}: ${error}`);
        throw new Error(`❌ Error loading ${logPrefix}: ${error}`);
    }
}

export async function loadAuthPlugin(filename: string, debug: boolean): Promise<AuthPlugin> {
    return loadPluginClassInstance<AuthPlugin>(
        filename,
        debug,
        'auth plugin',
        '❌ Auth plugin class must implement getAuthHeaders(url, requestBody): Promise<Record<string, string>>',
        []
    );
}

export async function loadDirectUrlAuthPlugin(config: DirectUrlAuthConfig, debug: boolean): Promise<DirectUrlAuthPlugin> {
    validateDirectUrlAuthConfig(config);
    return loadPluginClassInstance<DirectUrlAuthPlugin>(
        config.module,
        debug,
        'direct URL auth module',
        '❌ Direct URL auth module class must implement getAuthHeaders(url, requestBody): Promise<Record<string, string>>',
        [config.configPath ? resolveHomeDir(config.configPath) : undefined]
    );
}
