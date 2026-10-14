export type EnvironmentColourToken = 'info' | 'success' | 'warning' | 'error' | 'neutral';

export interface UiEnvironment {
    name: string;
    /** An {@link EnvironmentColourToken} or a `#rrggbb` hex colour. */
    colour: string;
}

export interface UiIdentity {
    name: string;
    roles?: string[];
}

export interface UiItem {
    label: string;
    value?: string;
    url?: string;
}

/** A section is absent when the operator did not configure or enable it. */
export interface UiConfig {
    environment?: UiEnvironment;
    identity?: UiIdentity;
    items?: UiItem[];
}
