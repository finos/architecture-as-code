import type { Decorator } from './decorator-contracts.js';

/** The fixed scale that every overlay maps its status values to. */
export type OverlayStatus = 'ok' | 'warn' | 'error' | 'info';

/** A decorator matches on its `type` or its `$schema` URL. */
export interface DecoratorViewMatch {
    type?: string;
    schema?: string;
}

/**
 * How a view draws its decorators on the diagram. `status`, `label`, `key` and `time` are JSON Pointers into a
 * decorator's `data`.
 */
export interface DecoratorOverlay {
    status: string;
    map: Record<string, OverlayStatus>;
    /** The scale value for a status the map does not name. Absent: the decorator is not drawn. */
    default?: OverlayStatus;
    label?: string;
    /** Status values that count as the newest decorator but draw nothing, so they hide an older result. */
    hide?: string[];
    /** With `time`, only the newest decorator of each key counts for an element. */
    key?: string;
    /** An ISO date-time. With it, only the newest decorator (per `key`) counts for an element. */
    time?: string;
}

/** The extension that contributes a view. The UI adds it; it is not part of the manifest entry. */
export interface DecoratorViewSource {
    id: string;
    name: string;
    /** Shipped with CALM Hub, not installed by an operator. */
    builtIn: boolean;
}

/** One `decorator-views` entry. */
export interface DecoratorView {
    id: string;
    match: DecoratorViewMatch;
    label: string;
    overlay?: DecoratorOverlay;
    source?: DecoratorViewSource;
}

export type OverlayDecoratorView = DecoratorView & { overlay: DecoratorOverlay };

/** One decorator drawn for an element. */
export interface OverlayEntry {
    decorator: Decorator;
    /** The raw status value from the decorator. */
    value: string;
    status: OverlayStatus;
    label?: string;
    /** The raw value at the overlay's `time` pointer. */
    time?: string;
}

/** What one view draws on one element: its worst entry first. */
export interface ElementOverlay {
    status: OverlayStatus;
    value: string;
    entries: OverlayEntry[];
}

export interface ViewOverlay {
    view: OverlayDecoratorView;
    elements: Map<string, ElementOverlay>;
}
