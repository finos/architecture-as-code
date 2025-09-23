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

        // Validate bundled resources before proceeding
        await validateBundledResources(logger);

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
        'tools/documentation-creation.md'
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
            } else if (relativePath.endsWith('.md') && !content.includes('#')) {
                logger.warn(`⚠️  Bundled file may be corrupted (no markdown headers): ${relativePath}`);
                corruptedFiles.push(relativePath);
            }
        } catch (_error) {
            missingFiles.push(relativePath);
            logger.warn(`❌ Missing bundled file: ${relativePath}`);
        }
    }

    // Report validation results
    if (missingFiles.length === 0 && corruptedFiles.length === 0) {
        logger.info('✅ All bundled resources validated successfully');
    } else {
        const totalIssues = missingFiles.length + corruptedFiles.length;
        logger.warn(`⚠️  Found ${totalIssues} issue(s) with bundled resources:`);
        
        if (missingFiles.length > 0) {
            logger.warn(`   • ${missingFiles.length} missing files: ${missingFiles.join(', ')}`);
        }
        
        if (corruptedFiles.length > 0) {
            logger.warn(`   • ${corruptedFiles.length} potentially corrupted files: ${corruptedFiles.join(', ')}`);
        }
        
        logger.warn('   • Will use fallback content where possible');
        
        // If critical files are missing, warn about reduced functionality
        const criticalFiles = ['CALM.chatmode.md'];
        const missingCritical = missingFiles.filter(file => criticalFiles.some(critical => file.includes(critical)));
        
        if (missingCritical.length > 0) {
            logger.warn('⚠️  Critical files missing - AI tools may have reduced functionality');
        }
    }
}

async function createChatmodeConfig(chatmodesDir: string, logger: Logger): Promise<void> {
    const chatmodeFile = join(chatmodesDir, 'CALM.chatmode.md');
    let usedFallback = false;

    try {
        // Get the bundled chatmode config file
        const bundledConfigPath = getBundledResourcePath('CALM.chatmode.md');
        const chatmodeContent = await readFile(bundledConfigPath, 'utf8');
        
        // Validate content quality
        if (!chatmodeContent.trim()) {
            throw new Error('Bundled chatmode file is empty');
        }
        
        if (!chatmodeContent.includes('CALM') || chatmodeContent.length < 500) {
            logger.warn('Bundled chatmode file appears incomplete or corrupted');
        }

        await writeFile(chatmodeFile, chatmodeContent, 'utf8');
        logger.info('✅ Created CALM chatmode configuration from bundled resource');
    } catch (error) {
        logger.warn(`⚠️  Could not use bundled chatmode config: ${error}`);
        logger.info('📄 Using built-in fallback content...');
        
        // Fallback to inline content if bundled file not found
        const fallbackContent = getFallbackChatmodeContent();
        await writeFile(chatmodeFile, fallbackContent, 'utf8');
        usedFallback = true;
        logger.info('✅ Created CALM chatmode configuration using fallback content');
    }

    // Verify the file was created successfully
    try {
        const createdStat = await stat(chatmodeFile);
        if (createdStat.size === 0) {
            throw new Error('Created chatmode file is empty');
        }
        
        if (usedFallback) {
            logger.warn('⚠️  Note: Using fallback chatmode content. Some features may be limited.');
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
        'documentation-creation.md'
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
            
            if (!content.includes('#') || content.length < 100) {
                logger.warn(`⚠️  Tool file ${fileName} appears incomplete (${content.length} chars)`);
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
            
            // Create a minimal fallback file for critical functionality
            try {
                const fallbackContent = createFallbackToolContent(fileName);
                const targetFilePath = join(promptsDir, fileName);
                await writeFile(targetFilePath, fallbackContent, 'utf8');
                logger.info(`📄 Created minimal fallback for: ${fileName}`);
            } catch (fallbackError) {
                logger.error(`❌ Even fallback creation failed for ${fileName}: ${fallbackError}`);
            }
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

function createFallbackToolContent(fileName: string): string {
    const baseName = fileName.replace('.md', '').replace(/-/g, ' ');
    const toolName = baseName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    return `# ${toolName} Tool

⚠️  **Fallback Content** - This tool prompt is using minimal fallback content because the bundled resource could not be loaded.

## Purpose
This tool assists with ${baseName} in CALM architecture documents.

## Basic Guidelines
- Follow CALM schema validation rules
- Ensure proper JSON structure
- Use appropriate CALM terminology
- Validate against CALM 1.0 specification

## Note
For full functionality, ensure all bundled AI tool resources are properly installed.

For detailed guidance, please refer to the CALM documentation at https://calm.finos.org
`;
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