export interface ExtensionSummary {
    id: string;
    name: string;
    description?: string;
    provider?: string;
    screen?: { title: string };
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
