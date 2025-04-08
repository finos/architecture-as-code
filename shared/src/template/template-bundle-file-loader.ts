import fs from 'fs';
import path from 'path';
import { IndexFile } from './types.js';
import { initLogger } from '../logger.js';


export class TemplateBundleFileLoader {
    private readonly templateBundlePath: string;
    private readonly config: IndexFile;
    private readonly templateFiles: Record<string, string>;
    private static logger = initLogger(process.env.DEBUG === 'true', TemplateBundleFileLoader.name);

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
