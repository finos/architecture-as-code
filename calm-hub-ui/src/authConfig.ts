import axios from 'axios';

export interface AuthConfig {
    oidc: {
        enabled: boolean;
        provider?: string;
        authority?: string;
        clientId?: string;
        scopes?: string[];
        redirectUri?: string;
    };
    github: {
        enabled: boolean;
        oauthClientId?: string;
    };
    databaseMode: string;
}

const DEFAULT_CONFIG: AuthConfig = {
    oidc: { enabled: false },
    github: { enabled: false },
    databaseMode: 'mongo',
};

let cachedConfig: AuthConfig | null = null;

export async function fetchAuthConfig(): Promise<AuthConfig> {
    if (cachedConfig) {
        return cachedConfig;
    }
    try {
        const response = await axios.get<AuthConfig>('/api/calm/auth/config');
        cachedConfig = response.data;
        return cachedConfig;
    } catch (error) {
        console.warn('Failed to fetch auth config, using defaults:', error);
        cachedConfig = DEFAULT_CONFIG;
        return cachedConfig;
    }
}

export function getAuthConfig(): AuthConfig {
    return cachedConfig || DEFAULT_CONFIG;
}

export function isOidcEnabled(): boolean {
    return cachedConfig?.oidc?.enabled ?? false;
}

export function isGitHubMode(): boolean {
    return cachedConfig?.databaseMode === 'github';
}

export function isGitHubLinkingEnabled(): boolean {
    return cachedConfig?.github?.enabled ?? false;
}
