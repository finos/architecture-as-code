import fs from 'fs';
import path from 'path';
import { IndexFile, TemplateEntry } from './types.js';
import { initLogger, Logger } from '../logger.js';
import { parseFrontMatterFromContent, replaceVariables } from './front-matter.js';


export interface ITemplateBundleLoader {
    getConfig(): IndexFile;
    getTemplateFiles(): Record<string, string>;
}

export class SelfProvidedTemplateLoader implements ITemplateBundleLoader {
    private readonly config: IndexFile;
    private readonly templateFiles: Record<string, string>;

    constructor(templatePath: string, outputPath: string) {
        const templateName = path.basename(templatePath);
        const templateDir = path.dirname(templatePath);

        const isDir = !path.extname(outputPath) || (
            fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()
        );

        const outputFile = isDir
            ? 'output.md'
            : path.basename(outputPath);

        let templateContent = fs.readFileSync(templatePath, 'utf8');
        const parsed = parseFrontMatterFromContent(templateContent, templateDir);

        if (parsed && Object.keys(parsed.frontMatter).length > 0) {
            templateContent = replaceVariables(templateContent, parsed.frontMatter);
        }

        this.templateFiles = {
            [templateName]: templateContent
        };

        this.config = {
            name: 'Self Provided Template',
            templates: [{
                template: templateName,
                from: 'document',
                output: outputFile,
                'output-type': 'single'
            }]
        };
    }

    getConfig(): IndexFile {
        return this.config;
    }

    getTemplateFiles(): Record<string, string> {
        return this.templateFiles;
    }
}

export class SelfProvidedDirectoryTemplateLoader implements ITemplateBundleLoader {
    private readonly config: IndexFile;
    private readonly templateFiles: Record<string, string> = {};

    constructor(templateDir: string) {

        const entries: TemplateEntry[] = [];

        const loadFilesRecursively = (dir: string, relativePath: string = '') => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const relPath = relativePath ? path.join(relativePath, item) : item;

                if (fs.statSync(fullPath).isDirectory()) {
                    loadFilesRecursively(fullPath, relPath);
                } else {
                    let templateContent = fs.readFileSync(fullPath, 'utf8');
                    const templateFileDir = path.dirname(fullPath);
                    const parsed = parseFrontMatterFromContent(templateContent, templateFileDir);

                    const frontMatterVariables: Record<string, string> = {};
                    if (parsed && Object.keys(parsed.frontMatter).length > 0) {
                        templateContent = replaceVariables(templateContent, parsed.frontMatter);
                        for (const [key, value] of Object.entries(parsed.frontMatter)) {
                            if (typeof value === 'string') {
                                frontMatterVariables[key] = value;
                            }
                        }
                    }

                    this.templateFiles[relPath] = templateContent;

                    const entry: TemplateEntry = {
                        template: relPath,
                        from: 'document',
                        output: relPath,
                        'output-type': 'single'
                    };

                    if (Object.keys(frontMatterVariables).length > 0) {
                        entry['front-matter'] = { variables: frontMatterVariables };
                    }

                    entries.push(entry);
                }
            }
        };

        loadFilesRecursively(templateDir);

        this.config = {
            name: 'Self Provided Template Directory',
            templates: entries
        };
    }

    getConfig(): IndexFile {
        return this.config;
    }

    getTemplateFiles(): Record<string, string> {
        return this.templateFiles;
    }
}

export class TemplateBundleFileLoader implements ITemplateBundleLoader {
    private readonly templateBundlePath: string;
    private readonly config: IndexFile;
    private readonly templateFiles: Record<string, string>;
    private static _logger: Logger | undefined;

    private static get logger(): Logger {
        if (!this._logger) {
            this._logger = initLogger(process.env.DEBUG === 'true', TemplateBundleFileLoader.name);
        }
        return this._logger;
    }

    constructor(templateBundlePath: string) {
        this.templateBundlePath = templateBundlePath;
        this.config = this.loadConfig();
        this.templateFiles = this.loadTemplateFiles();
    }

    private loadConfig(): IndexFile {
        const logger = TemplateBundleFileLoader.logger;
        const indexFilePath = path.join(this.templateBundlePath, 'index.json');

        if (!fs.existsSync(indexFilePath)) {
            logger.error(`❌ index.json not found: ${indexFilePath}`);
            throw new Error(`index.json not found in template bundle: ${indexFilePath}`);
        }

        try {
            logger.info(`📥 Loading index.json from ${indexFilePath}`);
            const rawConfig = JSON.parse(fs.readFileSync(indexFilePath, 'utf8'));

            if (!rawConfig.name || !Array.isArray(rawConfig.templates)) {
                logger.error('❌ Invalid index.json format: Missing required fields');
                throw new Error('Invalid index.json format: Missing required fields');
            }

            logger.info(`✅ Successfully loaded template bundle: ${rawConfig.name}`);
            return rawConfig as IndexFile;
        } catch (error) {
            logger.error(`❌ Error reading index.json: ${error.message}`);
            throw new Error(`Failed to parse index.json: ${error.message}`);
        }
    }

    private loadTemplateFiles(): Record<string, string> {
        const logger = TemplateBundleFileLoader.logger;
        const templates: Record<string, string> = {};
        const templateDir = this.templateBundlePath;

        logger.info(`📂 Loading template files from: ${templateDir}`);

        const templateFiles = fs.readdirSync(templateDir).filter(file => file.includes('.'));

        for (const file of templateFiles) {
            const filePath = path.join(templateDir, file);
            templates[file] = fs.readFileSync(filePath, 'utf8');
            logger.debug(`✅ Loaded template file: ${file}`);
        }

        logger.info(`🎯 Total Templates Loaded: ${Object.keys(templates).length}`);
        return templates;
    }

    public getConfig(): IndexFile {
        return this.config;
    }

    public getTemplateFiles(): Record<string, string> {
        return this.templateFiles;
    }

}
