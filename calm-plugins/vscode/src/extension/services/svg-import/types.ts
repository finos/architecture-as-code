export type ShapeHint =
    | 'rectangle'
    | 'rounded-rectangle'
    | 'cylinder'
    | 'ellipse'
    | 'diamond'
    | 'person'
    | 'cloud'
    | 'hexagon'
    | 'document'
    | 'parallelogram'
    | 'unknown';

export interface SvgNodeGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SvgNode {
    id: string;
    label: string;
    shapeHint: ShapeHint;
    geometry: SvgNodeGeometry;
    parentId?: string;
    styleProps: Record<string, string>;
}

export interface SvgEdge {
    id: string;
    sourceId: string;
    targetId: string;
    label?: string;
}

export type SvgFormat = 'drawio' | 'generic';

export interface ParsedSvgGraph {
    nodes: SvgNode[];
    edges: SvgEdge[];
    sourceFormat: SvgFormat;
}

export interface ImportResult {
    json: string;
    nodeCount: number;
    relationshipCount: number;
    warnings: string[];
}
