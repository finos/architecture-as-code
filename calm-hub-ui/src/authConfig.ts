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
    const attempt = async (): Promise<AuthConfig> => {
        const response = await axios.get<AuthConfig>('/api/calm/auth/config');
        return response.data;
    };
    try {
        cachedConfig = await attempt();
        return cachedConfig;
    } catch {
        // Retry once after a short delay before giving up
        try {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            cachedConfig = await attempt();
            return cachedConfig;
        } catch (retryError) {
            console.error('Failed to fetch auth config after retry:', retryError);
            throw new Error('Unable to load authentication configuration');
        }
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
