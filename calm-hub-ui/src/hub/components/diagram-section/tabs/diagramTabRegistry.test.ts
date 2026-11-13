import { describe, expect, it } from 'vitest';
import { IoEyeOutline } from 'react-icons/io5';
import {
    diagramTabLabel,
    diagramTabQuery,
    resolveDiagramTab,
    visibleDiagramTabs,
    type DiagramTab,
    type DiagramTabContext,
} from './diagramTabRegistry.js';

const tab = (id: string, extra: Partial<DiagramTab> = {}): DiagramTab => ({
    id,
    label: id,
    icon: IoEyeOutline,
    render: () => null,
    ...extra,
});

const diagram = tab('diagram');
const json = tab('json');
const archOnly = tab('arch-only', { isVisible: ({ isArchitecture }) => isArchitecture, searchParams: ['type'] });
const tabs = [diagram, json, archOnly];
const architecture = { isArchitecture: true };
const pattern = { isArchitecture: false };

describe('visibleDiagramTabs', () => {
    it('keeps tabs with no rule and tabs whose rule passes, in order', () => {
        expect(visibleDiagramTabs(tabs, architecture)).toEqual([diagram, json, archOnly]);
        expect(visibleDiagramTabs(tabs, pattern)).toEqual([diagram, json]);
    });
});

describe('resolveDiagramTab', () => {
    it('returns the requested visible tab', () => {
        expect(resolveDiagramTab(tabs, 'json', pattern)).toBe(json);
        expect(resolveDiagramTab(tabs, 'arch-only', architecture)).toBe(archOnly);
    });

    it('falls back to the diagram for no tab, an unknown tab and a hidden tab', () => {
        expect(resolveDiagramTab(tabs, null, architecture)).toBe(diagram);
        expect(resolveDiagramTab(tabs, 'no-such-tab', architecture)).toBe(diagram);
        expect(resolveDiagramTab(tabs, 'arch-only', pattern)).toBe(diagram);
    });

    it('falls back to the first visible tab when there is no diagram tab', () => {
        expect(resolveDiagramTab([json, archOnly], 'unknown', architecture)).toBe(json);
    });

    it('throws when no tab is visible', () => {
        expect(() => resolveDiagramTab([archOnly], null, pattern)).toThrow('no visible tab');
    });
});

describe('diagramTabLabel', () => {
    it('returns a fixed label, or computes one from the context', () => {
        const context = { isArchitecture: true } as DiagramTabContext;
        expect(diagramTabLabel(json, context)).toBe('json');
        expect(diagramTabLabel(tab('x', { label: (c) => (c.isArchitecture ? 'Arch' : 'Pattern') }), context)).toBe('Arch');
    });
});

describe('diagramTabQuery', () => {
    it('is empty for the diagram tab', () => {
        expect(diagramTabQuery(diagram, new URLSearchParams('tab=diagram&type=x'))).toBe('');
    });

    it('keeps the tab and only the parameters it owns', () => {
        expect(diagramTabQuery(json, new URLSearchParams('tab=json&type=x'))).toBe('?tab=json');
        expect(diagramTabQuery(archOnly, new URLSearchParams('tab=arch-only&type=deployment&node=n1'))).toBe(
            '?tab=arch-only&type=deployment'
        );
        expect(diagramTabQuery(archOnly, new URLSearchParams('tab=arch-only'))).toBe('?tab=arch-only');
    });
});
