import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { AgentConfig } from '../agents/types';

/**
 * Module-level cache for loaded skill files
 * Avoids re-reading markdown files on every call
 */
const skillCache = new Map<string, string>();

/**
 * Load a single skill file
 *
 * @param skillPath - Path to skill file relative to project root (e.g., "skills/SOX.md")
 * @returns Skill file content as string
 * @throws Error if file not found
 */
export function loadSkill(skillPath: string): string {
  // Check cache first
  if (skillCache.has(skillPath)) {
    return skillCache.get(skillPath)!;
  }

  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const resolvedPath = join(process.cwd(), skillPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Skill file not found: ${resolvedPath}`);
  }

  const content = readFileSync(resolvedPath, 'utf-8');

  // Cache and return
  skillCache.set(skillPath, content);
  return content;
}

/**
 * Load multiple skill files and concatenate them
 *
 * @param skillPaths - Array of skill file paths relative to project root
 * @returns Concatenated skill content with separators
 * @throws Error if any file not found
 */
export function loadSkills(skillPaths: string[]): string {
  if (skillPaths.length === 0) {
    return '';
  }

  const skills = skillPaths.map(path => loadSkill(path));
  return skills.join('\n\n---\n\n');
}

/**
 * Load skills for a specific agent based on its configuration
 * Convenience function that reads config.spec.skills array
 *
 * @param config - Agent configuration object
 * @returns Concatenated skill content, or empty string if no skills defined
 */
export function loadSkillsForAgent(config: AgentConfig): string {
  if (!config.spec.skills || config.spec.skills.length === 0) {
    return '';
  }

  return loadSkills(config.spec.skills);
}

/**
 * Clear the skill cache
 * Useful for testing or forcing reload of skill files
 */
export function clearSkillCache(): void {
  skillCache.clear();
}
