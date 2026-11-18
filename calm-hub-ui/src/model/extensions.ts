import type { DiagramLensContribution } from './lens.js';

export interface ExtensionContribution {
    id: string;
    title: string;
    route: string;
}
export interface ExtensionRoute {
    id: string;
    method: string;
    path: string;
    scope: string;
    readOnly: boolean;
}
export type ExtensionPoint = 'screen' | 'designer-tab' | 'landing-card' | 'detail-panel' | 'action';
/** The logo files that the manifest declares. Hub serves them at `/api/calm/extensions/<id>/logo/<light|dark>`. */
export interface ExtensionLogoFiles {
    light: string;
    dark?: string;
}
export interface ExtensionSummary {
    id: string;
    name: string;
    description?: string;
    provider?: string;
    logo?: ExtensionLogoFiles;
    hubApi: number;
    routes: ExtensionRoute[];
    contributes: Partial<Record<ExtensionPoint, ExtensionContribution[]>> & {
        'diagram-lens'?: DiagramLensContribution[];
        form?: ExtensionForm[];
    };
}

export type FormFieldType = 'text' | 'multiline' | 'number' | 'choice' | 'checkbox';

/** One labelled input of a form. Hub checked the rules at start-up, and checks each submission with the same rules. */
export interface ExtensionFormField {
    id: string;
    type: FormFieldType;
    label: string;
    help?: string;
    required?: boolean;
    default?: string | number | boolean;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    integer?: boolean;
    options?: { value: string; label: string }[];
}

/** The context that a form sends: none, a resource version, or a node of a resource version. */
export type FormTarget = 'none' | 'resource' | 'element';

export interface ExtensionForm {
    id: string;
    title: string;
    description?: string;
    route: string;
    target: FormTarget;
    submitLabel?: string;
    fields: ExtensionFormField[];
}
// A type, not an interface: an interface has no index signature, so it would not match ExtensionQuery.
export type ExtensionContext = {
    namespace?: string;
    /** `type/id`, for a query or a body only: a path placeholder cannot take a slash. */
    resource?: string;
    resourceType?: string;
    resourceId?: string;
    version?: string;
    selectedElement?: string;
};

export type Tone = 'positive' | 'negative' | 'warning' | 'info' | 'neutral';

/** One version of a Hub resource, and optionally the CALM `unique-id` of a node or relationship in it. */
export interface ResourceTarget {
    namespace: string;
    type: string;
    id: string;
    version: string;
    element?: string;
}

/** A Hub resource page. `extension` opens the contextual view of that extension with the resource. */
export interface HubTarget extends ResourceTarget {
    extension?: string;
}

/**
 * A top-level extension screen. `context` is the resource that the screen is for; the route gets it as the usual
 * context. `params` are view parameters, such as filters, sort and page: they stay in the URL and go to the route.
 */
export interface ScreenTarget {
    extension: string;
    screen: string;
    context?: ResourceTarget;
    params?: Record<string, string>;
}

/**
 * Where a link goes: exactly one of `href` (an external http or https URL), `hub` (a Hub resource page) or `screen`
 * (an extension screen). Blocks, search results and chat citations all use this shape, never an internal URL.
 */
export type Destination =
    | { href: string; hub?: never; screen?: never }
    | { hub: HubTarget; href?: never; screen?: never }
    | { screen: ScreenTarget; href?: never; hub?: never };

/** A link in a block: a destination and its label. */
export interface ScreenLinkValue {
    label: string;
    href?: string;
    hub?: HubTarget;
    screen?: ScreenTarget;
}

export interface BadgeValue {
    badge: string;
    tone?: Tone;
}

export type CellValue = string | number | BadgeValue | ScreenLinkValue;

/**
 * What a stat tile selects in the table `table` of the same reply. Without `id`, the tile shows all rows. A table with
 * inline rows keeps the rows whose cell in `column` has the text `value`; a table with a `source` sends `id` to its route.
 */
export interface StatFilter {
    table: string;
    id?: string;
    column?: string;
    value?: string;
}

export interface StatItem {
    label: string;
    value: string | number;
    filter?: StatFilter;
}

export interface TableBlockValue {
    type: 'table';
    id?: string;
    columns: string[];
    /** All rows. With a `source`, only a Hub that does not read `source` shows them. */
    rows: CellValue[][];
    search?: { label?: string; columns?: string[] };
    /** A GET `readOnly` route that returns one page of rows for the filters: `{ hubApi, rows, total }`. */
    source?: { route: string; pageSize?: number };
}

export type ScreenBlock =
    | { type: 'markdown'; text: string }
    | { type: 'keyValue'; items: { label: string; value: string | number }[] }
    | { type: 'stats'; items: StatItem[] }
    | TableBlockValue
    | { type: 'cards'; items: { title: string; subtitle?: string; link?: ScreenLinkValue }[] }
    | { type: 'alert'; tone?: Tone; text: string }
    | { type: 'links'; items: ScreenLinkValue[] }
    | { type: 'form'; form: string };

export interface ExtensionScreen {
    hubApi: number;
    title?: string;
    blocks: ScreenBlock[];
}

/** The reply of a table `source` route: one page of rows, and the number of rows that match the filters. */
export interface TableRowsReply {
    hubApi: number;
    rows: CellValue[][];
    total: number;
}
