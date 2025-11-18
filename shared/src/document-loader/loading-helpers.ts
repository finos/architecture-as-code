import path from 'path';
import { Logger } from '../logger';
import { DocumentLoader, CALM_HUB_PROTO } from './document-loader';
import { SchemaDirectory } from '../schema-directory';

export async function loadArchitectureAndPattern(architecturePath: string, patternPath: string, docLoader: DocumentLoader, schemaDirectory: SchemaDirectory, logger: Logger): Promise<{ architecture: object, pattern: object }> {
    const architecture = await loadArchitecture(architecturePath, docLoader, logger);
    if (!architecture) {
        // we have already validated that at least one of the options is provided, so pattern must be set
        const pattern = await loadPattern(patternPath, docLoader, logger);
        return { architecture: undefined, pattern };
    }
    if (patternPath) {
        // both options set
        const pattern = await loadPattern(patternPath, docLoader, logger);
        return { architecture, pattern };
    }
    // architecture is set, but pattern is not; try to load pattern from architecture if present 
    return { architecture, pattern: await loadPatternFromArchitectureIfPresent(architecture, architecturePath, docLoader, schemaDirectory, logger) };
}

export async function loadTimeline(timelinePath: string, docLoader: DocumentLoader, schemaDirectory: SchemaDirectory, logger: Logger): Promise<{ timeline: object, pattern: object }> {
    const timeline = await docLoader.loadMissingDocument(timelinePath, 'timeline');
    logger.debug(`Loaded timeline from ${timelinePath}`);

    return { timeline, pattern: await loadPatternFromArchitectureIfPresent(timeline, timelinePath, docLoader, schemaDirectory, logger) };
}

export function resolveSchemaRef(schemaRef: string, architecturePath: string, logger: Logger): string {
    // If it's an absolute URL (http, https, file) or calm: protocol, use as-is
    if (schemaRef.startsWith('http://') || schemaRef.startsWith('https://') || schemaRef.startsWith('file://') || schemaRef.startsWith(CALM_HUB_PROTO)) {
        return schemaRef;
    }
    // If it's an absolute file path, use as-is
    if (path.isAbsolute(schemaRef)) {
        return schemaRef;
    }
    // It's a relative path - resolve it relative to the architecture file's directory
    if (architecturePath) {
        const archDir = path.dirname(path.resolve(architecturePath));
        const resolved = path.resolve(archDir, schemaRef);
        logger.debug(`Resolved relative $schema path '${schemaRef}' to: ${resolved}`);
        return resolved;
    }
    logger.warn(`Could not resolve relative $schema path '${schemaRef}' because architecturePath is missing or falsy. Returning unresolved relative path.`);
    return schemaRef;
}

export async function loadPatternFromArchitectureIfPresent(architecture: object, architecturePath: string, docLoader: DocumentLoader, schemaDirectory: SchemaDirectory, logger: Logger): Promise<object> {
    if (!architecture || !architecture['$schema']) {
        return;
    }
    const schemaRef = resolveSchemaRef(architecture['$schema'], architecturePath, logger);
    try {
        const schema = await schemaDirectory.getSchema(schemaRef);
        logger.debug(`Loaded schema from architecture: ${schemaRef}`);
        return schema;
    }
    catch (_) {
        logger.debug(`Trying to load pattern from architecture schema: ${schemaRef}`);
    }
    const pattern = await docLoader.loadMissingDocument(schemaRef, 'pattern');
    logger.debug(`Loaded pattern from architecture schema: ${schemaRef}`);
    return pattern;
}

export async function loadPattern(patternPath: string, docLoader: DocumentLoader, logger: Logger): Promise<object> {
    if (!patternPath) {
        return undefined;
    }
    const pattern = await docLoader.loadMissingDocument(patternPath, 'pattern');
    logger.debug(`Loaded pattern from ${patternPath}`);
    return pattern;
}

export async function loadArchitecture(architecturePath: string, docLoader: DocumentLoader, logger: Logger): Promise<object> {
    if (!architecturePath) {
        return undefined;
    }
    const arch = await docLoader.loadMissingDocument(architecturePath, 'architecture');
    logger.debug(`Loaded architecture from ${architecturePath}`);
    return arch;
}
