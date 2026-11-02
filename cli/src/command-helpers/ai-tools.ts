import { initLogger } from '@finos/calm-shared';
import { Logger } from '@finos/calm-shared';
import { mkdir, writeFile, readFile, readdir, stat } from 'fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'path';

/**
 * Per-provider configuration in calm-ai/ai-assistants/<provider>.json.
 * The only provider-specific fact is where the assistant discovers skills.
 */
interface AiAssistantConfig {
    description: string;
    skillsDirectory: string;
}

export const CALM_SKILL_NAME = 'calm';

// In the built CLI, calm-ai/ is copied next to index.js by `npm run copy-ai-tools`
const DEFAULT_BUNDLE_DIRECTORY = resolve(__dirname, 'calm-ai');

export async function setupAiTools(
    provider: string,
    targetDirectory: string,
    verbose: boolean,
    bundleDirectory: string = DEFAULT_BUNDLE_DIRECTORY
): Promise<void> {
    const logger = initLogger(verbose, 'calm-ai-tools');

    try {
        const resolvedPath = resolve(targetDirectory);
        logger.info(`Setting up the CALM skill for provider "${provider}" in: ${resolvedPath}`);

        const dirStat = await stat(resolvedPath);
        if (!dirStat.isDirectory()) {
            throw new Error(`Target path is not a directory: ${resolvedPath}`);
        }

        try {
            await stat(join(resolvedPath, '.git'));
            logger.info('Git repository detected');
        } catch {
            logger.warn('Warning: No .git directory found. This may not be a git repository.');
        }

        const config = await loadProviderConfig(provider, bundleDirectory, logger);
        logger.info(`${config.description}: skills directory ${config.skillsDirectory}`);

        const skillSource = join(bundleDirectory, 'skills', CALM_SKILL_NAME);
        const skillTarget = join(resolvedPath, config.skillsDirectory, CALM_SKILL_NAME);
        const fileCount = await installSkill(skillSource, skillTarget, logger);

        logger.info(`✅ Installed the CALM skill (${fileCount} files) in ${relative(resolvedPath, skillTarget)}`);
        logger.info('🚀 To use: open this repository in your AI assistant and ask it to use the calm skill');
    } catch (error) {
        logger.error(`❌ Failed to setup AI tools: ${error}`);
        throw error;
    }
}

async function loadProviderConfig(provider: string, bundleDirectory: string, logger: Logger): Promise<AiAssistantConfig> {
    const configPath = join(bundleDirectory, 'ai-assistants', `${provider}.json`);
    logger.debug(`Using AI provider config: ${configPath}`);

    let config: Partial<AiAssistantConfig>;
    try {
        config = JSON.parse(await readFile(configPath, 'utf8'));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load AI configuration for provider "${provider}": ${message}`);
    }

    const skillsDirectory = config.skillsDirectory;
    if (typeof skillsDirectory !== 'string' || !skillsDirectory.trim()) {
        throw new Error(`Invalid AI configuration for provider: ${provider}`);
    }
    // The config is bundled, but never let it write outside the target directory
    if (isAbsolute(skillsDirectory) || skillsDirectory.split(/[\\/]/).includes('..')) {
        throw new Error(`Unsafe skills directory in AI configuration for provider "${provider}": ${skillsDirectory}`);
    }

    return { description: config.description ?? provider, skillsDirectory };
}

/**
 * Copies SKILL.md and its supporting files. Every file is checked for content, and SKILL.md
 * must carry the frontmatter that the assistants use to discover the skill.
 */
async function installSkill(source: string, target: string, logger: Logger): Promise<number> {
    logger.debug(`Installing skill from ${source} to ${target}`);

    const entries = await readdir(source, { recursive: true, withFileTypes: true });
    const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => relative(source, join(entry.parentPath, entry.name)))
        .sort();

    if (!files.includes('SKILL.md')) {
        throw new Error(`Bundled skill is missing SKILL.md: ${source}`);
    }

    for (const file of files) {
        const content = await readFile(join(source, file), 'utf8');
        if (!content.trim()) {
            throw new Error(`Bundled skill file is empty: ${file}`);
        }
        if (file === 'SKILL.md') {
            const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1];
            if (!frontmatter || !new RegExp(`^name:\\s*${CALM_SKILL_NAME}\\s*$`, 'm').test(frontmatter)) {
                throw new Error('Bundled SKILL.md has no valid frontmatter');
            }
        }

        const targetFile = join(target, file);
        await mkdir(dirname(targetFile), { recursive: true });
        await writeFile(targetFile, content, 'utf8');
        logger.debug(`Wrote ${targetFile}`);
    }

    return files.length;
}
