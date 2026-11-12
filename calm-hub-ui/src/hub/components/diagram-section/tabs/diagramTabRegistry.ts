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
    /** Replaces the query parameters of the active tab. `tab` is kept. */
    setTabParams: (params: Record<string, string>) => void;
    /** The diagram, built by the section because it owns the layout state. */
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

export const DEFAULT_DIAGRAM_TAB_ID = 'diagram';

export function visibleDiagramTabs(tabs: readonly DiagramTab[], scope: DiagramTabScope): DiagramTab[] {
    return tabs.filter((tab) => tab.isVisible?.(scope) ?? true);
}

/** An unknown or hidden tab falls back to the diagram, so an old or foreign link still opens. */
export function resolveDiagramTab(tabs: readonly DiagramTab[], id: string | null, scope: DiagramTabScope): DiagramTab {
    const visible = visibleDiagramTabs(tabs, scope);
    const fallback = visible.find((tab) => tab.id === DEFAULT_DIAGRAM_TAB_ID) ?? visible[0];
    if (!fallback) throw new Error('The diagram tab registry has no visible tab');
    return visible.find((tab) => tab.id === id) ?? fallback;
}

/**
 * The tab to keep on navigation to another version: the requested tab when it is registered, even if it is hidden
 * for now (the Extensions tab before the registry loads), else the active tab.
 */
export function carriedDiagramTab(tabs: readonly DiagramTab[], id: string | null, active: DiagramTab): DiagramTab {
    return tabs.find((tab) => tab.id === id) ?? active;
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
    return query;
}

/** The query that keeps the tab, and its own parameters, on navigation to another version. */
export function diagramTabQuery(tab: DiagramTab, searchParams: URLSearchParams): string {
    if (tab.id === DEFAULT_DIAGRAM_TAB_ID) return '';
    const query = new URLSearchParams({ tab: tab.id });
    for (const name of tab.searchParams ?? []) {
        const value = searchParams.get(name);
        if (value !== null) query.set(name, value);
    }
    return `?${query.toString()}`;
}
