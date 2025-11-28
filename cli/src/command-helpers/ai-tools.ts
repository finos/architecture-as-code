import { initLogger } from '@finos/calm-shared';
import { Logger } from '@finos/calm-shared/src/logger.js';
import { mkdir, writeFile, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';

export async function setupAiTools(targetDirectory: string, verbose: boolean): Promise<void> {
    const logger = initLogger(verbose, 'calm-ai-tools');

    try {
        const resolvedPath = resolve(targetDirectory);
        logger.info(`Setting up CALM AI tools in: ${resolvedPath}`);

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

        // Create .github/chatmodes directory if it doesn't exist
        const chatmodesDir = join(resolvedPath, '.github', 'chatmodes');
        await mkdir(chatmodesDir, { recursive: true });
        logger.info('Created .github/chatmodes directory following GitHub Copilot conventions');

        // Create chatmode configuration
        await createChatmodeConfig(chatmodesDir, logger);

        // Create tool prompt files
        await createToolPrompts(chatmodesDir, logger);

        logger.info('✅ CALM AI tools setup completed successfully!');
        logger.info('🚀 To use: Open this repository in VS Code and start a chat with the CALM chatmode');
        logger.info('📁 Files created in .github/chatmodes/ directory following GitHub Copilot conventions');

    } catch (error) {
        logger.error(`❌ Failed to setup AI tools: ${error}`);
        throw error;
    }
}

async function validateBundledResources(logger: Logger): Promise<void> {
    logger.info('🔍 Validating bundled AI tool resources...');

    const requiredFiles = [
        'CALM.chatmode.md',
        'tools/architecture-creation.md',
        'tools/node-creation.md',
        'tools/relationship-creation.md',
        'tools/interface-creation.md',
        'tools/metadata-creation.md',
        'tools/control-creation.md',
        'tools/flow-creation.md',
        'tools/pattern-creation.md',
        'tools/documentation-creation.md',
        'tools/standards-creation.md'
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
            logger.error(`❌ Missing bundled file: ${relativePath}`);
        }
    }
}

async function createChatmodeConfig(chatmodesDir: string, logger: Logger): Promise<void> {
    const chatmodeFile = join(chatmodesDir, 'CALM.chatmode.md');

    try {
        // Get the bundled chatmode config file
        const bundledConfigPath = getBundledResourcePath('CALM.chatmode.md');
        const chatmodeContent = await readFile(bundledConfigPath, 'utf8');

        // Validate content quality
        if (!chatmodeContent.trim()) {
            throw new Error('Bundled chatmode file is empty');
        }

        const MIN_CHATMODE_CONTENT_LENGTH = 500; // Minimum acceptable length for chatmode content

        if (
            !chatmodeContent.includes('CALM') ||
            chatmodeContent.length < MIN_CHATMODE_CONTENT_LENGTH
        ) {
            logger.warn(
                `Bundled chatmode file appears incomplete or corrupted (length: ${chatmodeContent.length} < ${MIN_CHATMODE_CONTENT_LENGTH})`
            );
        }

        await writeFile(chatmodeFile, chatmodeContent, 'utf8');
        logger.info('✅ Created CALM chatmode configuration from bundled resource');
    } catch (error) {
        logger.error(`⚠️  Could not load bundled chatmode config: ${error}`);
    }

    // Verify the file was created successfully
    try {
        const createdStat = await stat(chatmodeFile);
        if (createdStat.size === 0) {
            throw new Error('Created chatmode file is empty');
        }
    } catch (verifyError) {
        logger.error(`❌ Failed to verify chatmode file creation: ${verifyError}`);
        throw new Error(`Chatmode configuration setup failed: ${verifyError}`);
    }
}

async function createToolPrompts(chatmodesDir: string, logger: Logger): Promise<void> {
    const promptsDir = join(chatmodesDir, 'calm-prompts');
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
        'calm-cli-instructions.md'
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