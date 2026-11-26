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

/** Hub URLs of the organisation logo. The dark theme uses `light` when there is no `dark`. */
export interface UiLogo {
    light: string;
    dark?: string;
}

export interface UiBranding {
    organisationName?: string;
    applicationName?: string;
    /** `#rrggbb`. */
    colour?: string;
    /** `#rrggbb`. */
    colourDark?: string;
    logo?: UiLogo;
}

/** `menu`: the menu is a drawer. `sidebar`: wide screens show it at all times. */
export type NavigationLayout = 'menu' | 'sidebar';

export interface UiNavigation {
    layout: NavigationLayout;
    showNamespaces: boolean;
    showControlDomains: boolean;
    extensionsHeading?: string;
    startPage?: string;
}

/** A section is absent when the operator did not configure or enable it. */
export interface UiConfig {
    environment?: UiEnvironment;
    identity?: UiIdentity;
    items?: UiItem[];
    branding?: UiBranding;
    navigation?: UiNavigation;
}
