import { describe, expect, it } from 'vitest';
import { IoEyeOutline } from 'react-icons/io5';
import {
    DEFAULT_DIAGRAM_LENS_ID,
    diagramTabLabel,
    diagramTabQuery,
    redirectedTabQuery,
    resolveDiagramTab,
    visibleDiagramTabs,
    withoutLens,
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

    it('falls back to the given default, as for the CALM lens', () => {
        const calm = tab(DEFAULT_DIAGRAM_LENS_ID);
        expect(resolveDiagramTab([archOnly, calm], 'no-such-lens', architecture, DEFAULT_DIAGRAM_LENS_ID)).toBe(calm);
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

describe('diagramTabQuery with a lens', () => {
    const c4 = tab('c4', { searchParams: ['level', 'scope'] });
    const calm = tab(DEFAULT_DIAGRAM_LENS_ID);

    it('keeps the lens and only its own parameters on the diagram tab', () => {
        expect(diagramTabQuery(diagram, new URLSearchParams('lens=c4&level=container&node=n1&type=x'), c4)).toBe('?lens=c4&level=container');
    });

    it('is empty for the CALM lens, and ignores the lens on another tab', () => {
        expect(diagramTabQuery(diagram, new URLSearchParams('level=container'), calm)).toBe('');
        expect(diagramTabQuery(json, new URLSearchParams('tab=json&lens=c4&level=container'), c4)).toBe('?tab=json');
    });
});

describe('withoutLens', () => {
    it('drops the lens and the parameters of every lens, and keeps the rest', () => {
        const lenses = [tab('c4', { searchParams: ['level', 'scope'] }), tab('other', { searchParams: ['depth'] })];
        expect(withoutLens(lenses, new URLSearchParams('lens=c4&level=component&scope=s&depth=2&node=n1')).toString()).toBe('node=n1');
    });
});

describe('redirectedTabQuery', () => {
    const redirects = { deployments: { tab: 'decorators', type: 'deployment' } };

    it('replaces an old tab and keeps the other parameters', () => {
        const query = redirectedTabQuery(redirects, new URLSearchParams('tab=deployments&node=api'));
        expect(query?.toString()).toBe('tab=decorators&node=api&type=deployment');
    });

    it('needs no redirect for a current tab, no tab, or an inherited key', () => {
        expect(redirectedTabQuery(redirects, new URLSearchParams('tab=decorators'))).toBeUndefined();
        expect(redirectedTabQuery(redirects, new URLSearchParams(''))).toBeUndefined();
        expect(redirectedTabQuery(redirects, new URLSearchParams('tab=toString'))).toBeUndefined();
    });
});
