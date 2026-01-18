import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';
import { readUrlMappingFile } from './url-mapping.js';

export interface ParsedFrontMatter {
    frontMatter: Record<string, unknown>;
    content: string;
    architecturePath?: string;
    urlMappingPath?: string;
    urlToLocalPathMapping?: Map<string, string>;
}

const RESERVED_KEYS = new Set([
    'architecture',
    'url-to-local-file-mapping'
]);

export function parseFrontMatterFromContent(
    content: string,
    basePath?: string
): ParsedFrontMatter {
    const emptyResult: ParsedFrontMatter = {
        frontMatter: {},
        content,
        architecturePath: undefined,
        urlToLocalPathMapping: undefined
    };

    if (!hasFrontMatterDelimiter(content)) {
        return emptyResult;
    }

    const endLineIndex = findClosingDelimiterIndex(content);
    if (endLineIndex === -1) {
        return emptyResult;
    }

    const lines = content.split(/\r?\n/);
    const frontMatterYaml = lines.slice(1, endLineIndex).join('\n');
    const templateContent = lines.slice(endLineIndex + 1).join('\n');

    try {
        const frontMatter = yaml.parse(frontMatterYaml) || {};
        const architecturePath = resolveArchitecturePath(frontMatter.architecture, basePath);
        const { path: urlMappingPath, map: urlToLocalPathMapping } = resolveUrlMapping(frontMatter, basePath);

        return {
            frontMatter,
            content: templateContent,
            architecturePath,
            urlMappingPath,
            urlToLocalPathMapping
        };
    } catch {
        return emptyResult;
    }
}

function hasFrontMatterDelimiter(content: string): boolean {
    return content.startsWith('---\n') || content.startsWith('---\r\n');
}

function findClosingDelimiterIndex(content: string): number {
    const lines = content.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            return i;
        }
    }
    return -1;
}

function resolveArchitecturePath(architecture: string | undefined, basePath?: string): string | undefined {
    if (!architecture) {
        return undefined;
    }
    if (basePath && !path.isAbsolute(architecture)) {
        return path.resolve(basePath, architecture);
    }
    return architecture;
}

function resolveUrlMapping(frontMatter: Record<string, unknown>, basePath?: string): { path?: string; map?: Map<string, string> } {
    const mappingKey = frontMatter.urlToLocalPathMapping || frontMatter['url-to-local-file-mapping'];
    if (!mappingKey || typeof mappingKey !== 'string') {
        return {};
    }

    let mappingPath = mappingKey;
    if (basePath && !path.isAbsolute(mappingPath)) {
        mappingPath = path.resolve(basePath, mappingPath);
    }
    return { path: mappingPath, map: readUrlMappingFile(mappingPath) };
}


export function parseFrontMatter(filePath: string): ParsedFrontMatter | null {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const basePath = path.dirname(filePath);
        return parseFrontMatterFromContent(content, basePath);
    } catch {
        return null;
    }
}

export function hasArchitectureFrontMatter(filePath: string): boolean {
    const parsed = parseFrontMatter(filePath);
    return !!parsed?.architecturePath;
}

export function replaceVariables(content: string, frontMatter: Record<string, unknown>): string {
    let result = content;
    for (const [key, value] of Object.entries(frontMatter)) {
        if (!RESERVED_KEYS.has(key) && typeof value === 'string') {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(regex, value);
        }
    }
    return result;
}

export interface FrontMatterInjectionParams {
    architecturePath: string;
    urlMappingPath?: string;
    /** Variables to inject into front-matter. Values can contain {{id}} which gets replaced with itemId */
    variables?: Record<string, string>;
    /** The item ID value to substitute for {{id}} in variable values */
    itemId?: string;
}

export function injectFrontMatter(
    content: string,
    outputPath: string,
    params: FrontMatterInjectionParams
): string {
    const outputDir = path.dirname(outputPath);
    const relativeArchPath = calculateRelativePath(outputDir, params.architecturePath);

    let relativeUrlMappingPath: string | undefined;
    if (params.urlMappingPath) {
        relativeUrlMappingPath = calculateRelativePath(outputDir, params.urlMappingPath);
    }

    const resolvedVariables = resolveVariables(params.variables, params.itemId);
    const existingFields = extractExistingFrontMatterFields(content);
    const injectLines = buildInjectionLines(
        relativeArchPath,
        relativeUrlMappingPath,
        existingFields,
        resolvedVariables
    );

    if (injectLines.length === 0) {
        return content;
    }

    return mergeFrontMatter(content, injectLines);
}

function resolveVariables(variables?: Record<string, string>, itemId?: string): Record<string, string> {
    if (!variables) return {};

    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(variables)) {
        resolved[key] = itemId ? value.replace(/\{\{id\}\}/g, itemId) : value;
    }
    return resolved;
}

function calculateRelativePath(outputDir: string, inputPath: string): string {
    const resolvedPath = path.resolve(inputPath);
    return path.relative(outputDir, resolvedPath);
}

function extractExistingFrontMatterFields(content: string): Set<string> {
    const existingFields = new Set<string>();
    const hasExistingFrontMatter = content.startsWith('---\n') || content.startsWith('---\r\n');

    if (hasExistingFrontMatter) {
        const lines = content.split(/\r?\n/);
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---') break;
            const match = lines[i].match(/^([a-zA-Z0-9_-]+):/);
            if (match) {
                existingFields.add(match[1]);
            }
        }
    }

    return existingFields;
}

function buildInjectionLines(
    relativeArchPath: string,
    relativeUrlMappingPath: string | undefined,
    existingFields: Set<string>,
    variables: Record<string, string>
): string[] {
    const lines: string[] = [];

    if (!existingFields.has('architecture')) {
        lines.push(`architecture: ${relativeArchPath}`);
    }
    if (relativeUrlMappingPath && !existingFields.has('url-to-local-file-mapping')) {
        lines.push(`url-to-local-file-mapping: ${relativeUrlMappingPath}`);
    }
    for (const [key, value] of Object.entries(variables)) {
        if (!existingFields.has(key)) {
            lines.push(`${key}: ${value}`);
        }
    }

    return lines;
}

function mergeFrontMatter(content: string, injectLines: string[]): string {
    const hasExistingFrontMatter = content.startsWith('---\n') || content.startsWith('---\r\n');

    if (hasExistingFrontMatter) {
        const lines = content.split(/\r?\n/);
        let endLineIndex = -1;

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                endLineIndex = i;
                break;
            }
        }

        if (endLineIndex > 0) {
            const newLines = [
                lines[0],
                ...injectLines,
                ...lines.slice(1)
            ];
            return newLines.join('\n');
        }
    }

    return `---\n${injectLines.join('\n')}\n---\n` + content;
}

