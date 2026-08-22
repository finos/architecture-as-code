import { getPatternArray, readChoiceBlock, type SchemaNode } from '@finos/calm-models/pattern';

/** `path` is Spectral path segments, not a pointer string. */
export interface PatternCandidate {
    uniqueId: string;
    site: 'prefixItem' | 'prefixItemAlternative' | 'catalogMember';
    node: SchemaNode;
    path: (string | number)[];
    slotIndex?: number;
    blockType?: 'oneOf' | 'anyOf';
}

/** How a `oneOf`/`anyOf` choice block contributes candidates. */
type BlockResolution =
    /** Every alternative of every keyword - what a pattern *declares*. */
    | 'all'
    /** Only the operative keyword's alternatives - what selection can *reach*. */
    | 'operative';

function readUniqueId(item: SchemaNode): string | undefined {
    const properties = item?.['properties'] as Record<string, SchemaNode> | undefined;
    const constValue = properties?.['unique-id']?.['const'];
    return typeof constValue === 'string' ? constValue : undefined;
}

/**
 * One traversal for both questions. The resolutions differ only in how a choice block
 * contributes, so they must not become two functions that drift apart.
 */
function walkCandidates(
    pattern: SchemaNode,
    calmType: 'nodes' | 'relationships',
    resolution: BlockResolution
): PatternCandidate[] {
    const { prefixItems, catalog } = getPatternArray(pattern, calmType);
    const candidates: PatternCandidate[] = [];

    const emitBlock = (
        container: SchemaNode,
        basePath: (string | number)[],
        site: PatternCandidate['site'],
        slotIndex?: number
    ): boolean => {
        const keywords: ReadonlyArray<'oneOf' | 'anyOf'> =
            resolution === 'all' ? ['oneOf', 'anyOf'] : (readChoiceBlock(container) ? [readChoiceBlock(container)!.groupType] : []);

        let emitted = false;
        keywords.forEach((blockType) => {
            const alternatives = container?.[blockType];
            if (!Array.isArray(alternatives)) return;
            emitted = true;
            (alternatives as SchemaNode[]).forEach((alt, j) => {
                const uniqueId = readUniqueId(alt);
                if (!uniqueId) return;
                candidates.push({
                    uniqueId,
                    site,
                    node: alt,
                    path: [...basePath, blockType, j],
                    ...(slotIndex !== undefined && { slotIndex }),
                    blockType,
                });
            });
        });
        return emitted;
    };

    prefixItems.forEach((item: SchemaNode, i: number) => {
        const base: (string | number)[] = ['properties', calmType, 'prefixItems', i];

        // A hybrid slot carries its own id and alternatives. Both must be emitted.
        const uniqueId = readUniqueId(item);
        if (uniqueId) {
            candidates.push({ uniqueId, site: 'prefixItem', node: item, path: base });
        }

        emitBlock(item, base, 'prefixItemAlternative', i);
    });

    if (catalog) {
        emitBlock(catalog, ['properties', calmType, 'items'], 'catalogMember');
    }

    return candidates;
}

/**
 * Every candidate the pattern declares, both keywords unioned. Use it for questions
 * about what a document says: uniqueness, dangling references.
 */
export function listCandidates(pattern: SchemaNode, calmType: 'nodes' | 'relationships'): PatternCandidate[] {
    return walkCandidates(pattern, calmType, 'all');
}

/**
 * Only the candidates selection can reach, resolved as `selectChoices` resolves them.
 * Use it for "can this answer be honoured". `listCandidates` is a silent bug here,
 * because it reports the losing keyword's alternatives as available.
 */
export function listSelectableCandidates(pattern: SchemaNode, calmType: 'nodes' | 'relationships'): PatternCandidate[] {
    return walkCandidates(pattern, calmType, 'operative');
}
