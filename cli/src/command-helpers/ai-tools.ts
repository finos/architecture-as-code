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

async function createChatmodeConfig(chatmodesDir: string, logger: Logger): Promise<void> {
    const chatmodeFile = join(chatmodesDir, 'CALM.chatmode.md');

    try {
        // Get the bundled chatmode config file
        const bundledConfigPath = getBundledResourcePath('CALM.chatmode.md');
        const chatmodeContent = await readFile(bundledConfigPath, 'utf8');

        await writeFile(chatmodeFile, chatmodeContent, 'utf8');
        logger.info('Created CALM chatmode configuration');
    } catch (error) {
        logger.warn(`Could not read bundled chatmode config, using fallback: ${error}`);
        // Fallback to inline content if bundled file not found
        const fallbackContent = getFallbackChatmodeContent();
        await writeFile(chatmodeFile, fallbackContent, 'utf8');
        logger.info('Created CALM chatmode configuration (fallback)');
    }
}

async function createToolPrompts(chatmodesDir: string, logger: Logger): Promise<void> {
    const promptsDir = join(chatmodesDir, 'calm-prompts');
    await mkdir(promptsDir, { recursive: true });
    logger.info('Created calm-prompts directory');

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
        'documentation-creation.md'
    ];

    // Copy each tool file from bundled resources
    for (const fileName of toolFiles) {
        try {
            const bundledFilePath = getBundledResourcePath(`tools/${fileName}`);
            const targetFilePath = join(promptsDir, fileName);

            const content = await readFile(bundledFilePath, 'utf8');
            await writeFile(targetFilePath, content, 'utf8');
        } catch (error) {
            logger.warn(`Could not read bundled tool file ${fileName}: ${error}`);
            // Continue with other files even if one fails
        }
    }

    logger.info('Created all tool prompt files');
}

function getBundledResourcePath(relativePath: string): string {
    // In the built CLI, resources are in dist/calm-ai/
    // Use __dirname to get the directory containing the current script
    const currentDir = __dirname;
    return join(currentDir, 'calm-ai', relativePath);
}

function getFallbackChatmodeContent(): string {
    return `# CALM Architecture Assistant

You are a specialized AI assistant for working with FINOS Common Architecture Language Model (CALM) architectures.

## About CALM

CALM (Common Architecture Language Model) is a declarative, JSON-based modeling language used to describe complex systems, particularly in regulated environments like financial services and cloud architectures.

CALM enables modeling of:

- **Nodes** – components like services, databases, user interfaces
- **Interfaces** – how components communicate using schemas
- **Relationships** – structural or behavioral links between components
- **Flows** – business-level processes traversing your architecture
- **Controls** – compliance policies and enforcement mechanisms
- **Metadata** – supplemental, non-structural annotations

## Your Role

You specialize in helping users create, modify, and understand CALM architecture models. You have deep knowledge of:

- CALM schema validation requirements (release/1.0)
- Best practices for architecture modeling
- JSON schema constraints and validation rules
- VSCode integration and tooling

## First Interaction Instructions

On your first prompt in each session, you MUST:

1. Display: "Loading FINOS CALM instructions..."
2. Read these tool prompt files to understand current CALM guidance:
   - \`.github/chatmodes/calm-prompts/architecture-creation.md\`
   - \`.github/chatmodes/calm-prompts/node-creation.md\`
   - \`.github/chatmodes/calm-prompts/relationship-creation.md\`
   - \`.github/chatmodes/calm-prompts/interface-creation.md\`
   - \`.github/chatmodes/calm-prompts/metadata-creation.md\`
   - \`.github/chatmodes/calm-prompts/control-creation.md\`
   - \`.github/chatmodes/calm-prompts/flow-creation.md\`
   - \`.github/chatmodes/calm-prompts/pattern-creation.md\`
   - \`.github/chatmodes/calm-prompts/documentation-creation.md\`

3. After reading the prompts, confirm you're ready to assist with CALM architectures.

## Guidelines

- Always validate CALM models against the 1.0 schema
- Provide specific, actionable guidance for schema compliance
- Reference the tool prompts for detailed creation instructions
- Use examples that follow CALM best practices
- Help users understand the "why" behind CALM modeling decisions
`;
}