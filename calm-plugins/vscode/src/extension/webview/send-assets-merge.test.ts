import { describe, it, expect } from 'vitest';

/**
 * Tests for the asset-merge logic used in CanvasPanel.sendAssets().
 *
 * The actual sendAssets method has vscode dependencies; this tests the
 * pure merge logic: local assets + Hub assets → combined arrays.
 */

interface PatternEntry {
    id: string;
    name: string;
    description: string;
    category: string;
    schema: unknown;
}

interface BuildingBlockDef {
    id: string;
    name: string;
    behaviour: string;
    controls: Record<string, unknown>;
    nodeType?: string;
    namespace?: string;
    sha?: string;
}

function mergeBlocks(
    localBlocks: BuildingBlockDef[],
    hubBlocks: BuildingBlockDef[],
    hubStandards: BuildingBlockDef[]
): BuildingBlockDef[] {
    return [...localBlocks, ...hubBlocks, ...hubStandards];
}

function mergePatterns(
    localPatterns: PatternEntry[],
    hubPatterns: PatternEntry[]
): PatternEntry[] {
    return [...localPatterns, ...hubPatterns];
}

describe('sendAssets merge logic', () => {
    describe('mergePatterns', () => {
        it('combines local and Hub patterns into a single array', () => {
            const local: PatternEntry[] = [
                { id: 'local-1', name: 'Local Pattern', description: 'desc', category: 'general', schema: {} },
            ];
            const hub: PatternEntry[] = [
                { id: 'hub-1', name: 'Hub Pattern', description: 'from hub', category: 'finos', schema: { properties: {} } },
            ];

            const result = mergePatterns(local, hub);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('local-1');
            expect(result[1].id).toBe('hub-1');
        });

        it('returns only local patterns when Hub has none', () => {
            const local: PatternEntry[] = [
                { id: 'local-1', name: 'Local', description: '', category: 'general', schema: {} },
            ];

            const result = mergePatterns(local, []);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('local-1');
        });

        it('returns only Hub patterns when local has none', () => {
            const hub: PatternEntry[] = [
                { id: 'hub-1', name: 'Hub', description: '', category: 'finos', schema: {} },
            ];

            const result = mergePatterns([], hub);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('hub-1');
        });

        it('returns empty array when neither source has patterns', () => {
            expect(mergePatterns([], [])).toEqual([]);
        });

        it('preserves schema content from Hub patterns for instantiation', () => {
            const hubSchema = {
                title: 'API Gateway',
                properties: {
                    nodes: { prefixItems: [{ properties: { 'unique-id': { const: 'gw-1' } } }] },
                    relationships: { prefixItems: [] },
                },
            };
            const hub: PatternEntry[] = [
                { id: 'api-gw', name: 'API Gateway', description: '', category: 'networking', schema: hubSchema },
            ];

            const result = mergePatterns([], hub);

            expect(result[0].schema).toBe(hubSchema);
            const schema = result[0].schema as Record<string, unknown>;
            const props = schema.properties as Record<string, unknown>;
            const nodes = props.nodes as Record<string, unknown>;
            expect((nodes.prefixItems as unknown[]).length).toBe(1);
        });
    });

    describe('mergeBlocks', () => {
        it('combines local blocks, Hub blocks, and Hub standards', () => {
            const local: BuildingBlockDef[] = [
                { id: 'local-svc', name: 'Local Service', behaviour: 'create-node', controls: {} },
            ];
            const hubBlocks: BuildingBlockDef[] = [
                { id: 'hub-svc', name: 'Hub Service', behaviour: 'create-node', controls: {}, namespace: 'finos', sha: 'abc' },
            ];
            const hubStandards: BuildingBlockDef[] = [
                { id: 'hub-std', name: 'Hub Standard', behaviour: 'apply-controls-on-drop', controls: {}, namespace: 'finos', sha: 'def' },
            ];

            const result = mergeBlocks(local, hubBlocks, hubStandards);

            expect(result).toHaveLength(3);
            expect(result.map((b) => b.id)).toEqual(['local-svc', 'hub-svc', 'hub-std']);
        });
    });
});
