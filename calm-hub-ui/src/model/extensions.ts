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
export interface ExtensionSummary {
    id: string;
    name: string;
    description?: string;
    provider?: string;
    hubApi: number;
    routes: ExtensionRoute[];
    contributes: Partial<Record<ExtensionPoint, ExtensionContribution[]>>;
}
export interface ExtensionContext {
    namespace?: string;
    /** `type/id`, for a query or a body only: a path placeholder cannot take a slash. */
    resource?: string;
    resourceType?: string;
    resourceId?: string;
    version?: string;
    selectedElement?: string;
}

export type Tone = 'positive' | 'negative' | 'warning' | 'info' | 'neutral';

export interface HubTarget {
    namespace: string;
    type: string;
    id: string;
    version: string;
}

/** Exactly one of `href` (an external http or https URL) or `hub` (a Hub page) is set. */
export interface ScreenLinkValue {
    label: string;
    href?: string;
    hub?: HubTarget;
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
