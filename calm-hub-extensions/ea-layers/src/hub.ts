/** A failure that the lens shows to the user, as application/problem+json. */
export class Problem extends Error {
    constructor(readonly status: number, readonly title: string, readonly detail?: string) {
        super(detail ? `${title}: ${detail}` : title);
    }
}

export interface ServiceAccount {
    /** An OAuth 2.0 token endpoint. With none, the service calls CALM Hub with no token, as a no-auth Hub needs. */
    tokenUrl?: string;
    clientId?: string;
    clientSecret?: string;
    scope?: string;
}

const TIMEOUT_MS = 5_000;

/**
 * Reads CALM Hub with the service account of the extension (ADR 0010), never with the user's token. The account can
 * read more than the user, so callers read only the namespace that Hub checked for the user.
 */
export class HubClient {
    private token?: { value: string; expires: number };

    constructor(readonly baseUrl: string, private readonly account: ServiceAccount = {}, private readonly now = () => Date.now()) {}

    /** The JSON at a Hub path, or undefined for 204 or 404. */
    async get(path: string): Promise<unknown> {
        const headers: Record<string, string> = { Accept: 'application/json' };
        const token = await this.accessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(new URL(path, this.baseUrl), { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.status === 204 || res.status === 404) return undefined;
        if (!res.ok) throw new Problem(502, 'CALM Hub did not answer the layers service', `GET ${path} returned ${res.status}`);
        return res.json();
    }

    // The client credentials grant. The token is kept until a minute before it expires.
    private async accessToken(): Promise<string | undefined> {
        const { tokenUrl, clientId, clientSecret, scope } = this.account;
        if (!tokenUrl) return undefined;
        if (this.token && this.token.expires > this.now()) return this.token.value;
        const body = new URLSearchParams({ grant_type: 'client_credentials', ...(scope && { scope }) });
        const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${encodeURIComponent(clientId ?? '')}:${encodeURIComponent(clientSecret ?? '')}`).toString('base64')}`,
            },
            body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Problem(502, 'The layers service cannot sign in to CALM Hub', `The token endpoint returned ${res.status}`);
        const { access_token: value, expires_in: expiresIn = 300 } = (await res.json()) as { access_token: string; expires_in?: number };
        this.token = { value, expires: this.now() + Math.max(0, expiresIn - 60) * 1000 };
        return value;
    }
}
