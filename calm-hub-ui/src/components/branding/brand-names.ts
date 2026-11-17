import { UiBranding } from '../../model/ui-config.js';
import { useUiConfig } from '../ui-config/UiConfigContext.js';

/** The organisation name, else the application name. */
export function brandName(branding?: UiBranding): string | undefined {
    return branding?.organisationName ?? branding?.applicationName;
}

export function documentTitle(branding?: UiBranding): string | undefined {
    const names = [branding?.applicationName, branding?.organisationName].filter((name): name is string => !!name);
    return names.length > 0 ? names.join(' · ') : undefined;
}

/** The name that the UI calls the application: the organisation's, else CALM Hub. */
export function useProductName(): string {
    return brandName(useUiConfig().branding) ?? 'CALM Hub';
}
