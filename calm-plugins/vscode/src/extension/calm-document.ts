export const CALM_FILE_SUFFIXES = [
    '.calm.json',
    '.architecture.json',
];

const CALM_META_SCHEMA = /\/meta\/calm\.json$/;

export function isCalmFile(fsPath: string): boolean {
    return CALM_FILE_SUFFIXES.some((suffix) => fsPath.endsWith(suffix));
}

/**
 * Identifies a CALM architecture from its content, as CALM Tools 0.6.x did, so that files with
 * any name work. Patterns are JSON Schemas, so their `nodes` are under `properties`, not arrays.
 */
export function hasCalmArchitectureContent(text: string): boolean {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return false;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return false;
    }
    const document = parsed as Record<string, unknown>;
    const schema = document['$schema'];
    return (
        Array.isArray(document.nodes) ||
        Array.isArray(document.relationships) ||
        Array.isArray(document.flows) ||
        (typeof schema === 'string' && CALM_META_SCHEMA.test(schema))
    );
}

export function isCalmDocument(fsPath: string, text: string): boolean {
    return isCalmFile(fsPath) || hasCalmArchitectureContent(text);
}
