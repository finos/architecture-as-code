// Reusable direction type used by multiple strategies/builders in this package
export type Direction = 'both' | 'in' | 'out';
export type IncludeContainers = 'none' | 'parents' | 'all';
export type IncludeChildren = 'none' | 'direct' | 'all';
export type Edges = 'connected' | 'seeded' | 'all' | 'none';
export type EdgeLabels = 'description' | 'none';
export type ThemePreset = 'light' | 'dark' | 'high-contrast';

/** -----------------------------
 * Theme Types
 * ------------------------------ */
export interface ThemeClassStyle {
    fill: string;
    stroke: string;
    strokeWidth?: number;
    strokeDasharray?: string;
    fontSize?: string;
}

export interface ThemeColors {
    boundary: ThemeClassStyle;
    node: ThemeClassStyle;
    iface: ThemeClassStyle;
    highlight: ThemeClassStyle;
    actor?: ThemeClassStyle;
    database?: ThemeClassStyle;
    webclient?: ThemeClassStyle;
    service?: ThemeClassStyle;
    messagebus?: ThemeClassStyle;
    system?: ThemeClassStyle;
}

/** -----------------------------
 * Options (external API: CSV strings, flags)
 * ------------------------------ */
export interface BlockArchOptions {
    ['focus-nodes']?: string;
    ['focus-relationships']?: string;
    ['focus-flows']?: string;
    ['focus-controls']?: string;
    ['focus-interfaces']?: string;
    ['highlight-nodes']?: string;
    ['render-interfaces']?: boolean;
    ['render-node-type-shapes']?: boolean;
    ['include-containers']?: IncludeContainers;
    ['include-children']?: IncludeChildren;
    ['edges']?: Edges;
    ['node-types']?: string;
    ['direction']?: Direction;
    ['edge-labels']?: EdgeLabels;
    ['collapse-relationships']?: boolean;
    ['link-prefix']?: string;
    ['link-map']?: string;
    ['node-type-map']?: string;
    ['theme']?: ThemePreset | string;
    ['theme-colors']?: string | ThemeColors;
}

/** -----------------------------
 * VM Types
 * ------------------------------ */
export type VMInterface = { id: string; label: string };
export type VMLeafNode = { id: string; label: string; nodeType?: string; interfaces?: VMInterface[] };
export type VMContainer = { id: string; label: string; nodeType?: string; nodes: VMLeafNode[]; containers: VMContainer[] };
export type VMEdge = { id: string; source: string; target: string; label?: string };
export type VMAttach = { from: string; to: string };

export type BlockArchVM = {
    containers: VMContainer[];
    edges: VMEdge[];
    attachments: VMAttach[];
    looseNodes: VMLeafNode[];
    highlightNodeIds?: string[];  // union of highlight-nodes + focus-nodes
    renderNodeTypeShapes?: boolean;
    linkPrefix?: string;
    linkMap?: Record<string, string>;
    nodeTypeMap?: Record<string, string>;
    themeColors?: ThemeColors;
    warnings?: string[];
};

/** -----------------------------
 * Normalized options (internal shape)
 * ------------------------------ */
export type NormalizedOptions = {
    focusNodes?: string[];
    focusRelationships?: string[];
    focusFlows?: string[];
    highlightNodes?: string[];
    focusInterfaces?: string[];
    focusControls?: string[];
    includeContainers: IncludeContainers;
    includeChildren: IncludeChildren;
    edges: Edges;
    nodeTypes?: string[];
    direction: Direction;
    renderInterfaces: boolean;
    renderNodeTypeShapes: boolean;
    edgeLabels: EdgeLabels;
    collapseRelationships: boolean;
    linkPrefix?: string;
    linkMap?: Record<string, string>;
    nodeTypeMap?: Record<string, string>;
    theme: ThemePreset;
    themeColors?: ThemeColors;
};


