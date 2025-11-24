import { UserManager, Log, User } from 'oidc-client';

const config = {
    authority: 'https://calm-hub.finos.org:9443/realms/calm-hub-realm',
    client_id: 'calm-hub-authz-code',
    redirect_uri: window.location.origin,
    response_type: 'code',
    scope: 'openid profile architectures:read adrs:all',
    post_logout_redirect_uri: window.location.origin,
    automaticSilentRenew: true,
    filterProtocolClaims: true,
    loadUserInfo: true,
};

//Set AUTH_SERVICE_OIDC_ENABLE to true only when the backend is running with a secure profile and is NOT behind an ADC/Reverse-Proxy that handles user authentication.
export const AUTH_SERVICE_OIDC_ENABLE: boolean = false;
let userManager: UserManager | null = null;

export function isAuthServiceEnabled(): boolean {
    const oidcEnabled = AUTH_SERVICE_OIDC_ENABLE;
    const isHttps =
        typeof window !== 'undefined' &&
        typeof window.location !== 'undefined' &&
        window.location.protocol === 'https:';
    return (oidcEnabled && isHttps);
}

if (isAuthServiceEnabled()) {
    userManager = new UserManager(config);
    Log.logger = console;
    Log.level = Log.INFO;
}

export async function getUser(): Promise<User | null> {
    return (await userManager?.getUser()) || null;
}

export async function login(): Promise<void> {
    await userManager?.signinRedirect();
}

export async function processRedirect(): Promise<User | null> {
    try {
        await userManager?.signinRedirectCallback();
        return await getUser();
    } catch (error) {
        console.error('Redirect Processing Error:', error);
        return null;
    }
}

export async function logout(): Promise<void> {
    try {
        await userManager?.signoutRedirect();
    } catch (error) {
        console.error('Logout Error:', error);
    }
}

export async function clearSession(): Promise<void> {
    try {
        await userManager?.removeUser();
        console.log('Session cleared successfully.');
    } catch (error) {
        console.error('Error clearing session:', error);
    }
}

export async function getToken(): Promise<string> {
    if (!AUTH_SERVICE_OIDC_ENABLE) {
        return '';
    }
    const user = await userManager?.getUser();
    if (user && !user.expired) {
        return user.access_token;
    }

    if (user && user.expired) {
        try {
            const refreshedUser = await userManager?.signinSilent();
            return refreshedUser?.access_token || '';
        } catch (error) {
            console.error('Error refreshing token:', error);
            return '';
        }
    }
    return '';
}

export async function getAuthHeaders(): Promise<HeadersInit> {
    const accessToken = await getToken();
    const headers: HeadersInit = {};
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
}

export async function checkAuthorityService(): Promise<boolean> {
    try {
        const response = await fetch(config.authority, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        console.error('Authority Service Check Error:', error);
        return false;
    }
}

export const authService = {
    getUser,
    login,
    processRedirect,
    logout,
    clearSession,
    getToken,
    getAuthHeaders,
    isAuthServiceEnabled,
};
