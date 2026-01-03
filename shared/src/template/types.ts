/* eslint-disable  @typescript-eslint/no-explicit-any */
import {CalmCore} from '@finos/calm-models/model';
import { Logger } from '../logger.js';

export interface IndexFile {
    name: string;
    transformer?: string;
    templates: TemplateEntry[];
}

export interface TemplateEntry {
    /** Path to the template file relative to the bundle directory */
    template: string;
    /** JSONPath expression to extract data from the model (e.g., 'document.nodes') */
    from: string;
    /** Output file path, supports {{variable}} substitution for repeated templates */
    output: string;
    /**
     * - 'single': One output file from template
     * - 'repeated': One output file per item in 'from' array
     * - 'copy': Copy template as-is without Handlebars processing
     */
    'output-type': 'single' | 'repeated' | 'copy';
    /** Paths to partial templates to register before rendering */
    partials?: string[];
    /** Property name on data items containing the unique identifier. Defaults to 'unique-id' */
    'id-key'?: string;
    /** Front-matter configuration for generated files */
    'front-matter'?: {
        /** Whether to inject front-matter. Defaults to true for .md/.mdx files */
        inject?: boolean;
        /** Variables to inject into front-matter and Handlebars context. Use {{id}} for the item's ID value */
        variables?: Record<string, string>;
    };
}

export interface CalmTemplateTransformer {
    getTransformedModel(architecture: CalmCore): any;
    registerTemplateHelpers(): Record<string, (...args: any[]) => any>;
}

export interface OutputContext {
    data: unknown;
    outputDir: string;
    scaffoldOnly: boolean;
    scaffoldPaths?: { architecturePath: string; urlMappingPath?: string };
}

export interface OutputStrategy {
    process(
        entry: TemplateEntry,
        context: OutputContext,
        logger: Logger
    ): void;
}

