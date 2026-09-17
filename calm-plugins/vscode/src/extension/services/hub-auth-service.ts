import * as vscode from 'vscode';
import * as http from 'http';
import * as crypto from 'crypto';
import { HubClient, HubAuthConfig } from './hub-client';

/**
 * Authentication service that delegates the OIDC flow to CalmHub.
 * The plugin opens the Hub's /api/calm/auth/plugin-login in a browser,
 * the Hub handles OIDC, then redirects back to the plugin's localhost
 * callback with the token.
 */
export class HubAuthService {
    private token: string | undefined;
    private authConfig: HubAuthConfig | undefined;

    constructor(
        private secrets: vscode.SecretStorage,
        private client: HubClient
    ) {}

    async initialize(): Promise<void> {
        this.token = (await this.secrets.get('calm.hub.token')) ?? undefined;
        if (this.token) {
            this.client.setAuthHeaders({ Authorization: `Bearer ${this.token}` });
        }
    }

    async discoverAndAuthenticate(): Promise<boolean> {
        try {
            this.authConfig = await this.client.getAuthConfig();

            if (!this.authConfig.authEnabled) {
                this.client.setAuthHeaders({});
                return true;
            }

            // If we have a stored token, try it
            if (this.token) {
                this.client.setAuthHeaders({
                    Authorization: `Bearer ${this.token}`,
                });
                try {
                    await this.client.getNamespaces();
                    return true;
                } catch {
                    // Token expired, need re-auth
                }
            }

            // Delegate authentication entirely to the Hub
            const token = await this.loginViaHub();
            if (token) {
                this.token = token;
                await this.secrets.store('calm.hub.token', token);
                this.client.setAuthHeaders({ Authorization: `Bearer ${token}` });
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }

    async signOut(): Promise<void> {
        this.token = undefined;
        this.authConfig = undefined;
        await this.secrets.delete('calm.hub.token');
        this.client.setAuthHeaders({});
    }

    get isAuthenticated(): boolean {
        return (
            this.authConfig !== undefined &&
            (!this.authConfig.authEnabled || !!this.token)
        );
    }

    private async loginViaHub(): Promise<string | undefined> {
        const port = await this.findFreePort();
        const nonce = crypto.randomBytes(16).toString('hex');

        const hubBaseUrl = this.client.getBaseUrl();
        const loginUrl = `${hubBaseUrl}/api/calm/auth/plugin-login?port=${port}&nonce=${nonce}`;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                server.close();
                resolve(undefined);
            }, 120_000);

            const server = http.createServer((req, res) => {
                const url = new URL(req.url ?? '', `http://localhost:${port}`);

                if (url.pathname === '/callback') {
                    const receivedToken = url.searchParams.get('token');
                    const receivedNonce = url.searchParams.get('nonce');
                    const error = url.searchParams.get('error');

                    res.writeHead(200, { 'Content-Type': 'text/html' });

                    if (error) {
                        res.end('<!DOCTYPE html><html><body><h2>Authentication failed</h2><p>An error occurred during authentication.</p></body></html>');
                        clearTimeout(timeout);
                        server.close();
                        resolve(undefined);
                        return;
                    }

                    if (receivedNonce !== nonce) {
                        res.end('<!DOCTYPE html><html><body><h2>Authentication failed</h2><p>Invalid nonce — possible CSRF attack.</p></body></html>');
                        clearTimeout(timeout);
                        server.close();
                        resolve(undefined);
                        return;
                    }

                    if (receivedToken) {
                        res.end('<!DOCTYPE html><html><body><h2>Authentication successful!</h2><p>You can close this tab and return to VS Code.</p></body></html>');
                        clearTimeout(timeout);
                        server.close();
                        resolve(receivedToken);
                    } else {
                        res.end('<!DOCTYPE html><html><body><h2>Authentication failed</h2><p>No token received.</p></body></html>');
                        clearTimeout(timeout);
                        server.close();
                        resolve(undefined);
                    }
                    return;
                }
            });

            server.listen(port, () => {
                vscode.env.openExternal(vscode.Uri.parse(loginUrl));
            });

            server.on('error', () => {
                clearTimeout(timeout);
                resolve(undefined);
            });
        });
    }

    private findFreePort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const server = http.createServer();
            server.listen(0, () => {
                const addr = server.address();
                const port = typeof addr === 'object' && addr ? addr.port : 0;
                server.close(() => resolve(port));
            });
            server.on('error', reject);
        });
    }
}
