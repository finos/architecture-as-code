import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import type { Data } from '../../../../model/calm.js';
import type { ImplementationsState } from '../used-by/usePatternImplementations.js';
import type { ArchitectureDecoratorsState } from '../decorators/useArchitectureDecorators.js';

/** What is known about the resource before any tab content loads. Visibility depends only on this. */
export interface DiagramTabScope {
    isArchitecture: boolean;
    /** The pattern's name on the name-based API. Undefined for architectures, and until the summary loads. */
    patternName?: string;
    /** Some extension contributes an action or a designer tab for this resource. */
    hasExtensions?: boolean;
}

export interface DiagramTabContext extends DiagramTabScope {
    data: Data & { calmType: 'Architectures' | 'Patterns' };
    selectedElement?: string;
    searchParams: URLSearchParams;
    /**
     * Changes on each link and on each Back or Forward, also to the URL that shows. A replace that changes the URL, such
     * as closing the details, updates the page in place and keeps it.
     */
    linkKey: number;
    /**
     * Replaces the query parameters of the active tab, or of the active lens for a lens. `tab` or `lens` is kept.
     * A lens can name a node to select in the same navigation.
     */
    setTabParams: (params: Record<string, string>, selectNode?: string) => void;
    /** Selects the CALM node or relationship with this unique-id, as a click on the CALM diagram does. */
    selectElement?: (uniqueId: string) => void;
    /** The diagram, built by the section because it owns the layout state. For a tab, the active lens; for a lens, the CALM diagram. */
    diagram: ReactNode;
    decorators: ArchitectureDecoratorsState;
    usedBy: ImplementationsState;
    /** The tab opened from a control that it replaces, such as "View all", so its content takes focus. */
    focusPanel?: boolean;
    /** Called once the content took that focus, so a later visit to the tab does not take it again. */
    onPanelFocused?: () => void;
}

export interface DiagramTab {
    /** The `?tab=` value. */
    id: string;
    label: string | ((context: DiagramTabContext) => string);
    icon: IconType;
    title?: string;
    /** Absent means always visible. */
    isVisible?: (scope: DiagramTabScope) => boolean;
    /** Query parameters the tab owns. They are kept when the version changes. */
    searchParams?: readonly string[];
    render: (context: DiagramTabContext) => ReactNode;
}

/** A different picture of the same architecture, drawn in the Diagram tab. It has the shape of a tab, with `?lens=` for its id. */
export interface DiagramLens extends DiagramTab {
    /** The extension that gives the lens. Absent for a lens that ships with Hub. */
    extension?: { id: string; name: string };
}

/** The lenses that ship with Hub, then the extension lenses. Each group keeps the registry order. */
export function lensGroups<T extends DiagramLens>(lenses: readonly T[]): { builtIn: T[]; extension: T[] } {
    return { builtIn: lenses.filter((lens) => !lens.extension), extension: lenses.filter((lens) => !!lens.extension) };
}

export const DEFAULT_DIAGRAM_TAB_ID = 'diagram';
export const EXTENSIONS_TAB_ID = 'extensions';
/** `?extension=<id>` opens the section of that extension in the Extensions tab and the node details. */
export const EXTENSION_PARAM = 'extension';
/**
 * `?exact=1` opens the version in the URL as it is. Without it, the latest version of an architecture with a timeline
 * opens the timeline's current moment. Typed Hub links and returns add it, so a copied link or a new tab keeps it.
 */
export const EXACT_VERSION_PARAM = 'exact';
export const DEFAULT_DIAGRAM_LENS_ID = 'calm';
export const JSON_LENS_ID = 'json';
export const LENS_PARAM = 'lens';

export function visibleDiagramTabs(tabs: readonly DiagramTab[], scope: DiagramTabScope): DiagramTab[] {
    return tabs.filter((tab) => tab.isVisible?.(scope) ?? true);
}

/** An unknown or hidden tab falls back to the default, so an old or foreign link still opens. */
export function resolveDiagramTab(
    tabs: readonly DiagramTab[],
    id: string | null,
    scope: DiagramTabScope,
    defaultId = DEFAULT_DIAGRAM_TAB_ID,
): DiagramTab {
    const visible = visibleDiagramTabs(tabs, scope);
    const fallback = visible.find((tab) => tab.id === defaultId) ?? visible[0];
    if (!fallback) throw new Error('The diagram tab registry has no visible tab');
    return visible.find((tab) => tab.id === id) ?? fallback;
}

export function diagramTabLabel(tab: DiagramTab, context: DiagramTabContext): string {
    return typeof tab.label === 'function' ? tab.label(context) : tab.label;
}

/** The query an old `?tab=` value redirects to, keeping its other parameters. Undefined when it needs none. */
export function redirectedTabQuery(
    redirects: Readonly<Record<string, Record<string, string>>>,
    searchParams: URLSearchParams,
): URLSearchParams | undefined {
    const tab = searchParams.get('tab');
    const redirect = tab !== null && Object.hasOwn(redirects, tab) ? redirects[tab] : undefined;
    if (!redirect) return undefined;
    const query = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(redirect)) query.set(name, value);
    // The default tab has no `tab` parameter, as when a user opens it.
    if (query.get('tab') === DEFAULT_DIAGRAM_TAB_ID) query.delete('tab');
    return query;
}

function ownQuery(param: string, view: DiagramTab, searchParams: URLSearchParams): string {
    const query = new URLSearchParams({ [param]: view.id });
    for (const name of view.searchParams ?? []) {
        const value = searchParams.get(name);
        if (value !== null) query.set(name, value);
    }
    return `?${query.toString()}`;
}

/** The query that keeps the tab, or the lens of the Diagram tab, and its own parameters, on navigation to another version. */
export function diagramTabQuery(tab: DiagramTab, searchParams: URLSearchParams, lens?: DiagramLens): string {
    if (tab.id !== DEFAULT_DIAGRAM_TAB_ID) return ownQuery('tab', tab, searchParams);
    return lens && lens.id !== DEFAULT_DIAGRAM_LENS_ID ? ownQuery(LENS_PARAM, lens, searchParams) : '';
}

/** The query with no lens and none of the lenses' own parameters. Other parameters, such as `node`, are kept. */
export function withoutLens(lenses: readonly DiagramLens[], searchParams: URLSearchParams): URLSearchParams {
    const query = new URLSearchParams(searchParams);
    query.delete(LENS_PARAM);
    // `tab=diagram` opens the same tab as no `tab`.
    if (query.get('tab') === DEFAULT_DIAGRAM_TAB_ID) query.delete('tab');
    for (const lens of lenses) for (const name of lens.searchParams ?? []) query.delete(name);
    return query;
}
