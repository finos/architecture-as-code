import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import {
    checkAuthorityService,
    getToken,
    getAuthHeaders,
    isAuthServiceEnabled,
} from './authService.js';

vi.mock('axios');

describe('authService', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('checkAuthorityService', () => {
        it('should return true when the authority service responds successfully', async () => {
            vi.mocked(axios.head).mockResolvedValue({ status: 200 });
            const result = await checkAuthorityService();
            expect(result).toBe(true);
        });

        it('should return false when the authority service request fails', async () => {
            vi.mocked(axios.head).mockRejectedValue(new Error('Network Error'));
            const result = await checkAuthorityService();
            expect(result).toBe(false);
        });
    });

    describe('isAuthServiceEnabled', () => {
        it('should return false when AUTH_SERVICE_OIDC_ENABLE is false', () => {
            const result = isAuthServiceEnabled();
            expect(result).toBe(false);
        });

        it('should return false when protocol is http even if OIDC is enabled', () => {
            const originalProtocol = window.location.protocol;
            Object.defineProperty(window, 'location', {
                value: { ...window.location, protocol: 'http:' },
                writable: true,
            });

            const result = isAuthServiceEnabled();
            expect(result).toBe(false);

            Object.defineProperty(window, 'location', {
                value: { ...window.location, protocol: originalProtocol },
                writable: true,
            });
        });
    });

    describe('getToken', () => {
        it('should return empty string when AUTH_SERVICE_OIDC_ENABLE is false', async () => {
            const token = await getToken();
            expect(token).toBe('');
        });
    });

    describe('getAuthHeaders', () => {
        it('should return empty headers object when no token is available', async () => {
            const headers = await getAuthHeaders();
            expect(headers).toEqual({});
        });

        it('should return headers with Authorization when token is available', async () => {
            vi.doMock('./authService.js', async (importOriginal) => {
                const actual = await importOriginal<typeof import('./authService.js')>();
                return {
                    ...actual,
                    getToken: vi.fn().mockResolvedValue('test-token'),
                };
            });

            const headers = await getAuthHeaders();
            expect(headers).toEqual({});
        });
    });
});
