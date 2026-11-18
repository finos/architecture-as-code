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
    contributes: Partial<Record<ExtensionPoint, ExtensionContribution[]>> & { 'diagram-lens'?: DiagramLensContribution[] };
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

export type ScreenBlock =
    | { type: 'markdown'; text: string }
    | { type: 'keyValue'; items: { label: string; value: string | number }[] }
    | { type: 'stats'; items: { label: string; value: string | number }[] }
    | { type: 'table'; columns: string[]; rows: CellValue[][] }
    | { type: 'cards'; items: { title: string; subtitle?: string; link?: ScreenLinkValue }[] }
    | { type: 'alert'; tone?: Tone; text: string }
    | { type: 'links'; items: ScreenLinkValue[] };

export interface ExtensionScreen {
    hubApi: number;
    title?: string;
    blocks: ScreenBlock[];
}
