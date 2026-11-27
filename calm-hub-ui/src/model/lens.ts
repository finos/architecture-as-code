import type { ExtensionContribution, ScreenBlock, Tone } from './extensions.js';

/** A `diagram-lens` contribution in the registry. Hub leaves the notation out and serves it when the lens opens. */
export interface DiagramLensContribution extends ExtensionContribution {
    description?: string;
    appliesTo?: { resourceTypes?: string[] };
    params?: Record<string, LensParam>;
    notation: string;
}

export interface LensParam {
    values?: string[];
    pattern?: string;
    default?: string;
}

// The notation, as notation.schema.json describes it. Hub checks each notation at start-up.

export type Paint = 'background' | 'stroke' | 'color' | 'accent' | 'none' | string;
export type Border = 'solid' | 'dashed' | 'dotted';
export type Pin = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';
export type ViewBox = [number, number, number, number];
export type Point = [number, number];

export interface Part {
    path?: string;
    rect?: { x: number; y: number; width: number; height: number; rx?: number; ry?: number };
    circle?: { cx: number; cy: number; r: number };
    ellipse?: { cx: number; cy: number; rx: number; ry: number };
    line?: { x1: number; y1: number; x2: number; y2: number };
    polyline?: Point[];
    polygon?: Point[];
    fill?: Paint;
    stroke?: Paint;
    strokeWidth?: number;
    dash?: Border;
    opacity?: number;
    pin?: Pin;
}

export interface Slot {
    x: number;
    y: number;
    width: number;
    height: number;
    kind?: 'text' | 'list';
    align?: 'start' | 'center' | 'end';
    valign?: 'top' | 'middle' | 'bottom';
    weight?: 'normal' | 'bold';
    size?: 'small' | 'normal' | 'large';
    grow?: boolean;
}

export interface Port {
    id: string;
    side: 'top' | 'right' | 'bottom' | 'left';
    offset?: number;
}

export interface Shape {
    viewBox: ViewBox;
    resize?: { mode: 'stretch' | 'aspect' | 'nine-slice'; insets?: [number, number, number, number] };
    minSize?: [number, number];
    parts: Part[];
    slots?: Record<string, Slot>;
    ports?: 'outline' | Port[];
}

export interface Marker {
    viewBox: ViewBox;
    parts: Part[];
}

interface Colours {
    background?: string;
    color?: string;
    stroke?: string;
    accent?: string;
}

export interface ElementStyle extends Colours {
    tag: string;
    shape?: string;
    strokeWidth?: number;
    border?: Border;
    opacity?: number;
    icon?: string;
    metadata?: boolean;
    description?: boolean;
    label?: string;
    dark?: Colours;
}

export type GroupStyle = Omit<ElementStyle, 'accent' | 'metadata' | 'description'>;

export interface RelationshipStyle {
    tag: string;
    color?: string;
    thickness?: number;
    style?: Border;
    routing?: 'direct' | 'curved' | 'orthogonal';
    opacity?: number;
    start?: string;
    end?: string;
    label?: string;
    dark?: { color?: string };
}

export interface Notation {
    shapes?: Record<string, Shape>;
    markers?: Record<string, Marker>;
    styles?: { elements?: ElementStyle[]; relationships?: RelationshipStyle[]; groups?: GroupStyle[] };
}

// The reply of a lens route, as lens.schema.json describes it.

export interface LensLink {
    params?: Record<string, string>;
    /** Hub opens it only with a version. `element` and `extension` are as in a `HubTarget`. */
    hub?: { namespace: string; type: string; id: string; version?: string; element?: string; extension?: string };
    href?: string;
}

export interface LensBadge {
    text: string;
    tone?: Tone;
}

export interface LensPosition {
    x: number;
    y: number;
}

export interface LensNode {
    id: string;
    label: string;
    metadata?: string;
    description?: string;
    fields?: Record<string, string>;
    sections?: Record<string, string[]>;
    tags?: string[];
    badges?: LensBadge[];
    group?: string;
    calm?: string[];
    link?: LensLink;
    tooltip?: string;
    position?: LensPosition;
}

export interface LensGroup {
    id: string;
    label?: string;
    parent?: string;
    tags?: string[];
    calm?: string[];
    layout?: LensLayout;
    position?: LensPosition;
}

export interface LensEdge {
    id: string;
    source: string;
    target: string;
    sourcePort?: string;
    targetPort?: string;
    label?: string;
    technology?: string;
    startLabel?: string;
    endLabel?: string;
    tags?: string[];
    calm?: string[];
    tooltip?: string;
}

export interface LensLayout {
    algorithm: 'layered' | 'tree' | 'radial' | 'force' | 'stress' | 'rectpacking' | 'box' | 'fixed';
    direction?: 'down' | 'right' | 'up' | 'left';
    spacing?: number;
}

export interface LensControl {
    type: 'segmented' | 'select' | 'breadcrumb';
    param: string;
    label?: string;
    /** The value that the reply was drawn with, when the request did not name one. */
    value?: string;
    items: { value: string; label: string }[];
}

export interface LensReply {
    hubApi: number;
    kind: 'graph';
    title?: string;
    layout?: LensLayout;
    graph: { groups: LensGroup[]; nodes: LensNode[]; edges: LensEdge[] };
    controls: LensControl[];
    panels: { title: string; blocks: ScreenBlock[] }[];
}
