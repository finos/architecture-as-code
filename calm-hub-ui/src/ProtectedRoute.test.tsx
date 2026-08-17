import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./authService.js', () => ({
    authService: {
        getUser: vi.fn(),
        login: vi.fn(),
        processRedirect: vi.fn(),
    },
}));

vi.mock('./authConfig.js', () => ({
    fetchAuthConfig: vi.fn().mockResolvedValue({ oidc: { enabled: false }, github: { enabled: false } }),
    isGitHubLinkingEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock('axios');

import ProtectedRoute from './ProtectedRoute.js';
import { authService } from './authService.js';

const PRE_AUTH_HASH_KEY = 'calm_pre_auth_hash';

const fakeUser = {
    expired: false,
    id_token: 'test-id-token',
    access_token: 'test-access-token',
    profile: { preferred_username: 'testuser' },
} as unknown as import('oidc-client-ts').User;

describe('ProtectedRoute', () => {
    let replaceStateSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    });

    afterEach(() => {
        replaceStateSpy.mockRestore();
        Object.defineProperty(window, 'location', {
            value: window.location,
            writable: true,
        });
    });

    describe('hash preservation before OIDC redirect', () => {
        it('saves window.location.hash to sessionStorage before calling login', async () => {
            vi.mocked(authService.getUser).mockResolvedValue(null);
            vi.mocked(authService.login).mockResolvedValue(undefined);
            Object.defineProperty(window, 'location', {
                value: { ...window.location, hash: '#/fae-calm/architectures/123/abc', search: '' },
                writable: true,
            });

            render(
                <ProtectedRoute>
                    <div>Protected Content</div>
                </ProtectedRoute>
            );

            await waitFor(() => {
                expect(authService.login).toHaveBeenCalled();
            });
            expect(sessionStorage.getItem(PRE_AUTH_HASH_KEY)).toBe('#/fae-calm/architectures/123/abc');
        });

        it('does not save an empty hash to sessionStorage', async () => {
            vi.mocked(authService.getUser).mockResolvedValue(null);
            vi.mocked(authService.login).mockResolvedValue(undefined);
            Object.defineProperty(window, 'location', {
                value: { ...window.location, hash: '', search: '' },
                writable: true,
            });

            render(
                <ProtectedRoute>
                    <div>Protected Content</div>
                </ProtectedRoute>
            );

            await waitFor(() => {
                expect(authService.login).toHaveBeenCalled();
            });
            expect(sessionStorage.getItem(PRE_AUTH_HASH_KEY)).toBeNull();
        });
    });

    describe('hash restoration after OIDC callback', () => {
        it('restores the saved hash after processing the redirect callback', async () => {
            vi.mocked(authService.getUser).mockResolvedValue(null);
            vi.mocked(authService.processRedirect).mockResolvedValue(fakeUser);
            sessionStorage.setItem(PRE_AUTH_HASH_KEY, '#/fae-calm/architectures/123/abc');
            Object.defineProperty(window, 'location', {
                value: { ...window.location, search: '?code=AUTH_CODE&state=xyz', hash: '', pathname: '/' },
                writable: true,
            });

            render(
                <ProtectedRoute>
                    <div>Protected Content</div>
                </ProtectedRoute>
            );

            await waitFor(() => {
                expect(replaceStateSpy).toHaveBeenCalledWith(
                    null,
                    '',
                    '/#/fae-calm/architectures/123/abc'
                );
            });
            expect(sessionStorage.getItem(PRE_AUTH_HASH_KEY)).toBeNull();
        });

        it('falls back to #/ when no hash was saved', async () => {
            vi.mocked(authService.getUser).mockResolvedValue(null);
            vi.mocked(authService.processRedirect).mockResolvedValue(fakeUser);
            Object.defineProperty(window, 'location', {
                value: { ...window.location, search: '?code=AUTH_CODE&state=xyz', hash: '', pathname: '/' },
                writable: true,
            });

            render(
                <ProtectedRoute>
                    <div>Protected Content</div>
                </ProtectedRoute>
            );

            await waitFor(() => {
                expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/#/');
            });
        });

        it('falls back to #/ when saved hash is just #', async () => {
            vi.mocked(authService.getUser).mockResolvedValue(null);
            vi.mocked(authService.processRedirect).mockResolvedValue(fakeUser);
            sessionStorage.setItem(PRE_AUTH_HASH_KEY, '#');
            Object.defineProperty(window, 'location', {
                value: { ...window.location, search: '?code=AUTH_CODE&state=xyz', hash: '', pathname: '/' },
                writable: true,
            });

            render(
                <ProtectedRoute>
                    <div>Protected Content</div>
                </ProtectedRoute>
            );

            await waitFor(() => {
                expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/#/');
            });
        });

        it('renders children after successful redirect processing', async () => {
            vi.mocked(authService.getUser).mockResolvedValue(null);
            vi.mocked(authService.processRedirect).mockResolvedValue(fakeUser);
            Object.defineProperty(window, 'location', {
                value: { ...window.location, search: '?code=AUTH_CODE&state=xyz', hash: '', pathname: '/' },
                writable: true,
            });

            render(
                <ProtectedRoute>
                    <div>Protected Content</div>
                </ProtectedRoute>
            );

            expect(await screen.findByText('Protected Content')).toBeInTheDocument();
        });
    });

    describe('already authenticated user', () => {
        it('renders children immediately without redirect when session exists', async () => {
            vi.mocked(authService.getUser).mockResolvedValue(fakeUser);

            render(
                <ProtectedRoute>
                    <div>Protected Content</div>
                </ProtectedRoute>
            );

            expect(await screen.findByText('Protected Content')).toBeInTheDocument();
            expect(authService.login).not.toHaveBeenCalled();
            expect(authService.processRedirect).not.toHaveBeenCalled();
        });
    });
});
