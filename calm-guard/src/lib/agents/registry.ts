import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { AgentConfig, agentConfigSchema } from './types';

/**
 * Module-level cache for loaded agent configurations
 * Avoids re-reading and re-parsing YAML files on every call
 */
const configCache = new Map<string, AgentConfig>();

/**
 * Load a single agent configuration from YAML file
 *
 * @param name - Agent name (without .yaml extension)
 * @returns Validated AgentConfig object
 * @throws Error if file not found or YAML is invalid
 */
export function loadAgentConfig(name: string): AgentConfig {
  // Check cache first
  if (configCache.has(name)) {
    return configCache.get(name)!;
  }

  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const path = join(process.cwd(), 'agents', `${name}.yaml`);

  if (!existsSync(path)) {
    throw new Error(`Agent config not found: ${path}`);
  }

  let rawConfig: unknown;
  try {
    const fileContent = readFileSync(path, 'utf-8');
    rawConfig = parseYaml(fileContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${path}: ${message}`);
  }

  // Validate against schema
  const result = agentConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Invalid agent config in ${path}: ${errors}`);
  }

  // Cache and return
  configCache.set(name, result.data);
  return result.data;
}

/**
 * Load all agent configurations from agents/ directory
 *
 * @returns Map of agent configurations keyed by metadata.name
 * @throws Error if any config file is invalid
 */
export function loadAllAgentConfigs(): Map<string, AgentConfig> {
  const agentsDir = join(process.cwd(), 'agents');

  if (!existsSync(agentsDir)) {
    throw new Error(`Agents directory not found: ${agentsDir}`);
  }

  const files = readdirSync(agentsDir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml'));

  const configs = new Map<string, AgentConfig>();

  for (const file of yamlFiles) {
    const name = file.replace('.yaml', '');
    const config = loadAgentConfig(name);
    configs.set(config.metadata.name, config);
  }

  return configs;
}

/**
 * Clear the config cache
 * Useful for testing or forcing reload of configurations
 */
export function clearConfigCache(): void {
  configCache.clear();
}
