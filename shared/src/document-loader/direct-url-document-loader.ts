import axios, { Axios } from 'axios';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader } from './document-loader';
import { DocumentLoadError } from './document-loader';
import { Logger, initLogger } from '../logger';

export class DirectUrlDocumentLoader implements DocumentLoader {
    private readonly ax: Axios;
    private logger: Logger;

    constructor(debug: boolean, axiosInstance?: Axios) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create({
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        this.logger = initLogger(debug, 'direct-url-document-loader');
        if (debug) {
            this.addAxiosDebug();
        }
    }

    addAxiosDebug() {
        this.ax.interceptors.request.use(request => {
            console.log('Starting Request', JSON.stringify(request, null, 2));
            return request;
        });

        this.ax.interceptors.response.use(response => {
            console.log('Response:', response);
            return response;
        });
    }

    async initialise(_: SchemaDirectory): Promise<void> {
        // No-op, similar to CalmHubDocumentLoader
        return;
    }

    async loadMissingDocument(documentId: string, _type: CalmDocumentType): Promise<object> {
        try {
            const parsedUrl = new URL(documentId);
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Unsupported URL protocol '${parsedUrl.protocol}' in document URL. Only HTTP and HTTPS are allowed.`,
                });
            }
            if (isPrivateHost(parsedUrl.hostname)) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: 'Requests to private or internal network addresses are not allowed.',
                });
            }
            const safeUrl = parsedUrl.protocol + '//' + parsedUrl.host + parsedUrl.pathname + parsedUrl.search;
            const response = await this.ax.get(safeUrl, { maxRedirects: 0 });
            return response.data;
        } catch (error) {
            if (error instanceof DocumentLoadError) {
                throw error;
            }
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `Failed to load document from URL: ${documentId}`,
                cause: error instanceof Error ? error : undefined
            });
        }
    }

    /**
     * Only local files via a mapping file are currently supported.
     */
    resolvePath(_reference: string): string | undefined {
        return undefined;
    }
}

import { isIPv4 } from 'net';

// Note: This is a string-based check and does not protect against DNS rebinding
// (hostnames that resolve to private IPs). For stronger protection, consider
// resolving the hostname and validating the resolved IP addresses.
function isPrivateHost(hostname: string): boolean {
    // URL.hostname wraps IPv6 in brackets (e.g. "[::1]"); strip them and trailing dots for matching
    const normalized = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();

    // Check for localhost
    if (normalized === 'localhost') return true;

    // Check IPv4 private ranges
    if (isIPv4(normalized)) {
        const parts = normalized.split('.').map(Number);
        return (
            parts[0] === 127 ||                                          // 127.0.0.0/8 loopback
            parts[0] === 10 ||                                           // 10.0.0.0/8
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||    // 172.16.0.0/12
            (parts[0] === 192 && parts[1] === 168) ||                    // 192.168.0.0/16
            (parts[0] === 169 && parts[1] === 254) ||                    // 169.254.0.0/16 link-local
            (parts[0] === 0 && parts[1] === 0 && parts[2] === 0 && parts[3] === 0)  // 0.0.0.0
        );
    }

    // Handle IPv6 (including IPv4-mapped like ::ffff:7f00:1 and expanded loopback 0:0:0:0:0:0:0:1)
    if (normalized.includes(':')) {
        // Expand :: to full form for canonical comparison
        const canonical = canonicalizeIPv6(normalized);
        if (!canonical) return false;

        const words = canonical.split(':');

        // ::1 loopback
        if (canonical === '0000:0000:0000:0000:0000:0000:0000:0001') return true;

        // Check if last 32 bits embed a private IPv4 address.
        // Covers: IPv4-mapped (::ffff:x:x), IPv4-compatible (::x:x), and ISATAP (::ffff:0:x:x).
        // Node normalizes all dotted-decimal forms to hex (e.g. ::ffff:127.0.0.1 → ::ffff:7f00:1).
        const isV4Mapped = words[5] === 'ffff' && words.slice(0, 5).every(w => w === '0000');
        const isV4Compatible = words.slice(0, 6).every(w => w === '0000');
        const isISATAP = words[4] === 'ffff' && words[5] === '0000' && words.slice(0, 4).every(w => w === '0000');
        if (isV4Mapped || isV4Compatible || isISATAP) {
            const hi = parseInt(words[6], 16);
            const lo = parseInt(words[7], 16);
            const ipv4 = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
            return isPrivateHost(ipv4);
        }

        // fe80::/10 link-local (fe80:: through febf::)
        const firstWord = parseInt(words[0], 16);
        if (firstWord >= 0xfe80 && firstWord <= 0xfebf) return true;

        // fc00::/7 unique local (fc00:: through fdff::)
        if (firstWord >= 0xfc00 && firstWord <= 0xfdff) return true;

        return false;
    }

    return false;
}

function canonicalizeIPv6(addr: string): string | null {
    // Remove zone ID if present
    const zoneIdx = addr.indexOf('%');
    const clean = zoneIdx >= 0 ? addr.substring(0, zoneIdx) : addr;

    const parts = clean.split('::');
    if (parts.length > 2) return null;

    let groups: string[];
    if (parts.length === 2) {
        const left = parts[0] ? parts[0].split(':') : [];
        const right = parts[1] ? parts[1].split(':') : [];
        const missing = 8 - left.length - right.length;
        if (missing < 0) return null;
        groups = [...left, ...Array(missing).fill('0'), ...right];
    } else {
        groups = clean.split(':');
    }

    if (groups.length !== 8) return null;
    // Validate each group is a valid hextet
    if (!groups.every(g => /^[0-9a-f]{1,4}$/i.test(g))) return null;
    return groups.map(g => g.padStart(4, '0')).join(':');
}
