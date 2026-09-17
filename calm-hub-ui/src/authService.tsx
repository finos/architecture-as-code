import { UserManager, User } from 'oidc-client-ts';
import axios from 'axios';
import { fetchAuthConfig, getAuthConfig } from './authConfig.js';

let userManager: UserManager | null = null;
let initialized = false;

export function isAuthServiceEnabled(): boolean {
    const config = getAuthConfig();
    return config.oidc.enabled;
}

export async function initAuthService(): Promise<void> {
    if (initialized) return;

    const config = await fetchAuthConfig();
    if (!config.oidc.enabled) {
        initialized = true;
        return;
    }

    const oidcConfig = {
        authority: config.oidc.authority || '',
        client_id: config.oidc.clientId || '',
        redirect_uri: config.oidc.redirectUri
            ? new URL(config.oidc.redirectUri, window.location.origin).toString()
            : window.location.origin,
        response_type: 'code',
        scope: config.oidc.scopes?.join(' ') || 'openid profile email',
        post_logout_redirect_uri: window.location.origin,
        automaticSilentRenew: true,
        filterProtocolClaims: true,
        loadUserInfo: true,
    };

    userManager = new UserManager(oidcConfig);
    initialized = true;
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
    } catch (error) {
        console.error('Error clearing session:', error);
    }
}

export async function getToken(): Promise<string> {
    if (!userManager) {
        return '';
    }
    const user = await userManager.getUser();
    if (user && !user.expired) {
        // Entra ID: access_token audience is MS Graph, not our API.
        // Send the id_token which has our client_id as audience.
        return user.id_token || user.access_token;
    }

    if (user && user.expired) {
        try {
            const refreshedUser = await userManager.signinSilent();
            return refreshedUser?.id_token || refreshedUser?.access_token || '';
        } catch (error) {
            console.error('Error refreshing token:', error);
            return '';
        }
    }
    return '';
}

export type AuthHeaders = Record<string, string>;

export async function getAuthHeaders(): Promise<AuthHeaders> {
    const accessToken = await getToken();
    const headers: AuthHeaders = {};
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
}

export async function checkAuthorityService(): Promise<boolean> {
    const config = getAuthConfig();
    if (!config.oidc.enabled || !config.oidc.authority) {
        return false;
    }
    try {
        await axios.head(config.oidc.authority);
        return true;
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
    initAuthService,
};
