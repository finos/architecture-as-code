import { parseWithPointers, getLocationForJsonPath } from '@stoplight/json';
import { ValidationOutcome } from './validation.output.js';

/**
 * Context for a parsed document that includes location information.
 */
export interface ParsedDocumentContext {
    id: string;
    data: unknown;
    parseResult: ReturnType<typeof parseWithPointers>;
}

/**
 * Parse a JSON document with location information for precise error positioning.
 * @param content The raw JSON content to parse
 * @param id Identifier for the document (e.g., 'architecture', 'pattern')
 * @returns Parsed document context or undefined if parsing fails
 */
export function parseDocumentWithPositions(content: string, id: string): ParsedDocumentContext | undefined {
    try {
        const parseResult = parseWithPointers(content);
        return {
            id,
            data: parseResult.data,
            parseResult
        };
    } catch {
        return undefined;
    }
}

/**
 * Enrich validation outputs with line/character positions from parsed documents.
 * Mutates the ValidationOutcome in place.
 * 
 * @param outcome The validation outcome to enrich
 * @param contexts Map of document id to parsed context (e.g., { architecture: ctx, pattern: ctx })
 */
export function enrichWithDocumentPositions(
    outcome: ValidationOutcome,
    contexts: Record<string, ParsedDocumentContext>
): void {
    if (!outcome?.allValidationOutputs) {
        return;
    }
    const outputs = outcome.allValidationOutputs();
    for (const output of outputs) {
        const source = output.source || inferSourceFromAvailability(contexts);
        const context = source ? contexts[source] : undefined;
        if (!context || !output.path) {
            continue;
        }

        const location = getLocationForPointer(output.path, context);
        if (location?.range) {
            output.line_start = location.range.start.line + 1; // store 1-based for user-facing data
            output.character_start = location.range.start.character;
            output.line_end = location.range.end.line + 1; // store 1-based for user-facing data
            output.character_end = location.range.end.character;
        }
        output.source = output.source || source;

        const friendlyPath = rewritePathWithIds(output.path, context.data);
        if (friendlyPath) {
            output.path = friendlyPath;
        }
    }
}

function inferSourceFromAvailability(contexts: Record<string, ParsedDocumentContext>): string | undefined {
    if (contexts.architecture) {
        return 'architecture';
    }
    if (contexts.pattern) {
        return 'pattern';
    }
    return undefined;
}

function getLocationForPointer(pointerPath: string, context: ParsedDocumentContext) {
    const jsonPath = pointerToJsonPath(pointerPath, context.data);
    if (!jsonPath) {
        return undefined;
    }
    return getLocationForJsonPath(context.parseResult, jsonPath);
}

function pointerToJsonPath(pointerPath: string, data?: unknown): Array<string | number> | undefined {
    if (!pointerPath || pointerPath[0] !== '/') {
        return undefined;
    }
    const tokens = pointerPath.split('/').slice(1).map(decodePointerToken);

    if (!data) {
        return tokens.map(defaultTokenToPathSegment);
    }

    return tokensToJsonPath(tokens, data);
}

function decodePointerToken(token: string): string | number {
    const decoded = token.replace(/~1/g, '/').replace(/~0/g, '~');
    const asNumber = Number.parseInt(decoded, 10);
    if (Number.isInteger(asNumber) && String(asNumber) === decoded) {
        return asNumber;
    }
    return decoded;
}

function defaultTokenToPathSegment(token: string | number): string | number {
    if (typeof token === 'number') {
        return token;
    }
    const asNumber = Number.parseInt(token, 10);
    if (Number.isInteger(asNumber) && String(asNumber) === token) {
        return asNumber;
    }
    return token;
}

function tokensToJsonPath(tokens: Array<string | number>, data: unknown): Array<string | number> | undefined {
    const path: Array<string | number> = [];
    let cursor: unknown = data;

    for (const token of tokens) {
        if (Array.isArray(cursor)) {
            const idx = findIndexInArray(cursor, token);
            if (idx === undefined) {
                return undefined;
            }
            path.push(idx);
            cursor = cursor[idx];
            continue;
        }

        if (isRecord(cursor)) {
            const key = typeof token === 'number' ? String(token) : token;
            path.push(key);
            cursor = cursor[key];
            continue;
        }

        return undefined;
    }

    return path;
}

function findIndexInArray(arr: unknown[], token: string | number): number | undefined {
    if (typeof token === 'number') {
        return token >= 0 && token < arr.length ? token : undefined;
    }

    const byUniqueId = arr.findIndex(item => isRecord(item) && typeof item['unique-id'] === 'string' && item['unique-id'] === token);
    if (byUniqueId !== -1) {
        return byUniqueId;
    }

    const asNumber = Number.parseInt(token, 10);
    if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber < arr.length) {
        return asNumber;
    }

    return undefined;
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null;
}

function hasProp(obj: unknown, prop: string): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && prop in obj;
}

function rewritePathWithIds(pointerPath: string, data: unknown): string | undefined {
    if (!pointerPath || data === undefined || data === null) {
        return undefined;
    }

    const tokens = pointerPath.split('/').slice(1); // remove leading empty token from JSON pointer
    const rewritten: string[] = [];
    let cursor: unknown = data;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (Array.isArray(cursor)) {
            const index = Number.parseInt(token, 10);
            const item = Number.isInteger(index) ? cursor[index] : undefined;
            const id = selectArrayTokenId(item, token);

            rewritten.push(id);
            cursor = item;
            continue;
        }

        if (hasProp(cursor, token)) {
            rewritten.push(token);
            cursor = cursor[token];
            continue;
        }

        rewritten.push(token);
        cursor = undefined;
    }

    const decorated = rewritten.join('/');
    return `/${decorated}`;
}

function selectArrayTokenId(item: unknown, fallback: string): string {
    if (hasProp(item, 'unique-id') && typeof item['unique-id'] === 'string') {
        return item['unique-id'] as string;
    }
    return fallback;
}

// Expose internals for targeted unit tests
export const __test__ = {
    rewritePathWithIds
};
