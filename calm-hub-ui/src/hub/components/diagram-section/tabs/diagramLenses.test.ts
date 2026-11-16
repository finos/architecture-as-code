import { describe, expect, it } from 'vitest';
import type { ExtensionSummary } from '../../../../model/extensions.js';
import { diagramLenses } from './diagramLenses.js';

const summary = (id: string, lenses: unknown, name = id): ExtensionSummary =>
    ({ id, name, hubApi: 0, routes: [], contributes: { 'diagram-lens': lenses } }) as ExtensionSummary;

const c4 = { id: 'c4', title: 'C4', description: 'C4 diagrams', route: 'lens', notation: 'notation.json',
    appliesTo: { resourceTypes: ['architectures'] }, params: { level: { values: ['context'] }, scope: { pattern: '^[a-z]+$' } } };
const layers = { id: 'layers', title: 'Layers', route: 'lens', notation: 'notation.json' };

const shown = (lenses: ReturnType<typeof diagramLenses>) =>
    lenses.map((lens) => ({ id: lens.id, label: lens.label, title: lens.title, extension: lens.extension?.name }));

describe('diagramLenses', () => {
    it('lists the lenses of Hub, then the lenses of the enabled extensions in registry order, with the manifest text', () => {
        expect(shown(diagramLenses([summary('c4', [c4], 'C4 model'), summary('ea-layers', [layers])], 'loaded'))).toEqual([
            { id: 'calm', label: 'CALM', title: 'The CALM diagram', extension: undefined },
            { id: 'json', label: 'JSON', title: 'The CALM JSON of this version', extension: undefined },
            { id: 'c4', label: 'C4', title: 'C4 diagrams', extension: 'C4 model' },
            { id: 'layers', label: 'Layers', title: undefined, extension: 'ea-layers' },
        ]);
    });

    it('keeps the view parameters of a lens, and shows it only for the resource types that it applies to', () => {
        const [, , lens, other] = diagramLenses([summary('c4', [c4, { ...layers, id: 'all' }])], 'loaded');
        expect(lens.searchParams).toEqual(['level', 'scope']);
        expect(lens.isVisible?.({ isArchitecture: true })).toBe(true);
        expect(lens.isVisible?.({ isArchitecture: false })).toBe(false);
        expect(other.isVisible?.({ isArchitecture: false })).toBe(true);
    });

    it('ignores a malformed entry, the id of a lens of Hub, and a second lens with an id already listed', () => {
        const lenses = diagramLenses([
            summary('c4', [{ id: 'other', title: 'Other' }, { ...c4, id: 'json' }, c4, 'c4']),
            summary('acme', [{ ...c4, title: 'Acme C4' }]),
            summary('deployment', { id: 'c4', title: 'C4' }),
        ], 'loaded');
        expect(shown(lenses).map((lens) => `${lens.id}:${lens.extension ?? ''}`)).toEqual(['calm:', 'json:', 'c4:c4']);
    });

    it('lists only the lenses of Hub until the registry loads, and when it does not load', () => {
        for (const status of ['loading', 'failed', 'signed-out'] as const) {
            expect(diagramLenses([summary('c4', [c4])], status).map((lens) => lens.id)).toEqual(['calm', 'json']);
        }
    });
});
