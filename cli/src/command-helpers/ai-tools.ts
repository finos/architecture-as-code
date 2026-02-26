import { initLogger } from '@finos/calm-shared';
import { Logger } from '@finos/calm-shared/src/logger.js';
import { mkdir, writeFile, readFile, stat } from 'fs/promises';
import { dirname, join, resolve } from 'path';

import Handlebars from 'handlebars';

/**
 * Interface for AI assistant configuration files
 */
interface AiAssistantConfig {
    description: string;
    topLevelDirectory: string;
    topLevelPromptFileName: string;
    skillPrefix: string;
    skillSuffix: string;
    frontmatter: string;
    skillPrompts: string[];
}


export async function setupAiTools(provider: string, targetDirectory: string, verbose: boolean): Promise<void> {
    const logger = initLogger(verbose, 'calm-ai-tools');

    try {
        const resolvedPath = resolve(targetDirectory);
        logger.info(`Setting up CALM AI tools for provider "${provider}" in: ${resolvedPath}`);

        // Verify target directory exists
        const dirStat = await stat(resolvedPath);
        if (!dirStat.isDirectory()) {
            throw new Error(`Target path is not a directory: ${resolvedPath}`);
        }

        // Check if it's a git repository
        const gitDir = join(resolvedPath, '.git');
        try {
            await stat(gitDir);
            logger.info('Git repository detected');
        } catch {
            logger.warn('Warning: No .git directory found. This may not be a git repository.');
        }

        // Validate bundled resources before proceeding
        await validateBundledResources(logger);

        // retrieve AI assistant configuration
        logger.debug(`__dirname: ${__dirname}`);
        const calmAIPath = resolve(__dirname, 'calm-ai');
        const valuesPath = join(calmAIPath, 'ai-assistants', `${provider}.json`);
        logger.debug(`Using AI values path: ${valuesPath}`);
        const raw = await readFile(valuesPath, 'utf8');
        const aiConfig: AiAssistantConfig = JSON.parse(raw);

        // Validate required fields
        if (!aiConfig.topLevelDirectory || !aiConfig.skillPrompts || !aiConfig.topLevelPromptFileName) {
            throw new Error(`Invalid AI configuration for provider: ${provider}`);
        }

        logger.info(`AI assistant top level directory: ${aiConfig.topLevelDirectory}`);

        // Create AI Assistant top level directory if it doesn't exist
        const assistantDir = join(resolvedPath, aiConfig.topLevelDirectory);
        await mkdir(assistantDir, { recursive: true });
        logger.debug(`Created ${aiConfig.topLevelDirectory} directory following AI Assistant ${provider} conventions`);

        // Create agent configuration
        const aiTemplatePath = join(calmAIPath, 'templates', 'CALM.chatmode_template.md');
        logger.debug(`Using AI assistant template: ${aiTemplatePath}`);

        // form top level prompt file name in the context of the agents directory
        const aiAgentFile = join(assistantDir, aiConfig.topLevelPromptFileName);
        logger.debug(`AI assistant top level AI Agent file: ${aiAgentFile}`);
        logger.debug(`AI assistant values path: ${valuesPath}`);
        await createAgentConfig(aiAgentFile, aiTemplatePath, valuesPath, logger);

        // Create tool prompt files
        await createToolPrompts(assistantDir, logger);

        logger.info('✅ CALM AI tools setup completed successfully!');
        logger.info('🚀 To use: Open this repository in your IDE and start a chat with the CALM agent');
        logger.info(`📁 Files created in ${aiConfig.topLevelDirectory} directory following ${provider} AI Assistant conventions`);

    } catch (error) {
        logger.error(`❌ Failed to setup AI tools: ${error}`);
        throw error;
    }
}

async function validateBundledResources(logger: Logger): Promise<void> {
    logger.info('🔍 Validating bundled AI tool resources...');

    const requiredFiles = [
        'ai-assistants/copilot.json',
        'ai-assistants/kiro.json',
        'ai-assistants/claude.json',
        'templates/CALM.chatmode_template.md',
        'tools/architecture-creation.md',
        'tools/node-creation.md',
        'tools/relationship-creation.md',
        'tools/interface-creation.md',
        'tools/metadata-creation.md',
        'tools/control-creation.md',
        'tools/flow-creation.md',
        'tools/pattern-creation.md',
        'tools/documentation-creation.md',
        'tools/standards-creation.md',
        'tools/calm-cli-instructions.md',
        'tools/moment-creation.md',
        'tools/timeline-creation.md',
        'tools/decorator-creation.md'
    ];

    const missingFiles: string[] = [];
    const corruptedFiles: string[] = [];

    for (const relativePath of requiredFiles) {
        try {
            const bundledPath = getBundledResourcePath(relativePath);
            const content = await readFile(bundledPath, 'utf8');

            // Basic validation - check if file has content and appears to be markdown
            if (!content.trim()) {
                corruptedFiles.push(relativePath);
                logger.warn(`⚠️  Bundled file appears empty: ${relativePath}`);
            }
        } catch (_error) {
            missingFiles.push(relativePath);
            logger.error(`❌ Missing bundled file: ${relativePath} ${_error}`);
        }
    }
}


async function createAgentConfig(agentFile: string, aiTemplatePath: string, valuesPath: string, logger: Logger): Promise<void> {
    logger.info(`Creating enhanced agent config at: ${agentFile}`);

    try {
        logger.debug(`Using AI template path: ${aiTemplatePath}`);
        const tplSource = await readFile(aiTemplatePath, 'utf-8');

        logger.debug(`Using AI values path: ${valuesPath}`);
        const rawValues = await readFile(valuesPath, 'utf-8');
        let data: AiAssistantConfig;
        try {
            data = JSON.parse(rawValues);
            // Validate required fields
            if (!data.topLevelDirectory || !data.skillPrompts) {
                throw new Error('Missing required fields in AI configuration');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(`Error parsing JSON from ${valuesPath}: ${errorMessage}`);
            throw new Error(`Failed to load AI configuration: ${errorMessage}`);
        }

        // Compile prompt template with specific AI assistant data
        const tpl = Handlebars.compile(tplSource);
        const customAiAssistantPrompt = tpl(data);


        // Ensure directory exists before writing
        await mkdir(dirname(agentFile), { recursive: true });

        // Write the compiled agent configuration to file
        await writeFile(agentFile, customAiAssistantPrompt, 'utf-8');
        logger.debug(`Wrote agent configuration to: ${agentFile}`);


        // Get the bundled agent config file
        const agentContent = await readFile(agentFile, 'utf8');

        // Validate content quality
        if (!agentContent.trim()) {
            throw new Error('Bundled agent file is empty');
        }

        const MIN_AGENT_CONTENT_LENGTH = 500; // Minimum acceptable length for agent content

        if (
            !agentContent.includes('CALM') ||
            agentContent.length < MIN_AGENT_CONTENT_LENGTH
        ) {
            logger.warn(
                `Bundled agent file appears incomplete or corrupted (length: ${agentContent.length} < ${MIN_AGENT_CONTENT_LENGTH})`
            );
        }

        logger.info('✅ Created configuration from bundled resource');
    } catch (error) {
        logger.error(`❌  Could not load bundled agent config: ${error}`);
        throw new Error(`Agent configuration setup failed: ${error}`);
    }

    // Verify the file was created successfully
    try {
        const createdStat = await stat(agentFile);
        if (createdStat.size === 0) {
            throw new Error('Created agent file is empty');
        }
    } catch (verifyError) {
        logger.error(`❌ Failed to verify agent file creation: ${verifyError}`);
        throw new Error(`Agent configuration verification failed: ${verifyError}`);
    }
}


async function createToolPrompts(assistantDir: string, logger: Logger): Promise<void> {
    const promptsDir = join(assistantDir, 'calm-prompts');
    await mkdir(promptsDir, { recursive: true });
    logger.info('📁 Created calm-prompts directory');

    // List of tool prompt files to copy
    const toolFiles = [
        'architecture-creation.md',
        'node-creation.md',
        'relationship-creation.md',
        'interface-creation.md',
        'metadata-creation.md',
        'control-creation.md',
        'flow-creation.md',
        'pattern-creation.md',
        'documentation-creation.md',
        'standards-creation.md',
        'calm-cli-instructions.md',
        'moment-creation.md',
        'timeline-creation.md',
        'decorator-creation.md'
    ];

    let successCount = 0;
    let failureCount = 0;
    const failedFiles: string[] = [];

    // Copy each tool file from bundled resources
    for (const fileName of toolFiles) {
        try {
            const bundledFilePath = getBundledResourcePath(`tools/${fileName}`);
            const targetFilePath = join(promptsDir, fileName);

            const content = await readFile(bundledFilePath, 'utf8');

            // Validate content quality
            if (!content.trim()) {
                throw new Error('File is empty');
            }

            const MIN_TOOL_FILE_LENGTH = 100; // Minimum acceptable length for a tool prompt
            if (!content.includes('#') || content.length < MIN_TOOL_FILE_LENGTH) {
                logger.warn(`⚠️  Tool file ${fileName} appears incomplete (${content.length} chars; expected >= ${MIN_TOOL_FILE_LENGTH})`);
            }

            await writeFile(targetFilePath, content, 'utf8');

            // Verify the file was written correctly
            const writtenStat = await stat(targetFilePath);
            if (writtenStat.size === 0) {
                throw new Error('Written file is empty');
            }

            successCount++;
            logger.debug(`✅ Created tool prompt: ${fileName}`);
        } catch (error) {
            failureCount++;
            failedFiles.push(fileName);
            logger.warn(`❌ Failed to create tool prompt ${fileName}: ${error}`);
        }
    }

    // Report results
    if (failureCount === 0) {
        logger.info(`✅ Successfully created all ${successCount} tool prompt files`);
    } else {
        logger.warn(`⚠️  Tool prompts summary: ${successCount} succeeded, ${failureCount} failed`);
        if (failedFiles.length > 0) {
            logger.warn(`   Failed files: ${failedFiles.join(', ')}`);
        }

        if (failureCount > toolFiles.length / 2) {
            logger.error('❌ More than half of tool prompts failed - AI functionality will be severely limited');
            throw new Error(`Tool prompt setup failed: ${failureCount}/${toolFiles.length} files failed`);
        } else {
            logger.warn('⚠️  Some tool prompts failed - AI functionality may be limited');
        }
    }
}

function getBundledResourcePath(relativePath: string): string {
    // Input validation
    if (!relativePath || typeof relativePath !== 'string') {
        throw new Error(`Invalid relative path: ${relativePath}`);
    }

    // Prevent path traversal attacks
    if (relativePath.includes('..') || relativePath.startsWith('/')) {
        throw new Error(`Unsafe path detected: ${relativePath}`);
    }

    // In the built CLI, resources are in dist/calm-ai/
    // Use __dirname to get the directory containing the current script
    const currentDir = __dirname;
    const fullPath = join(currentDir, 'calm-ai', relativePath);

    // Additional validation could be added here to check if path exists
    // but we'll let the caller handle file existence checks for better error messages

    return fullPath;
}