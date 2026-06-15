import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthErrorModal } from './AuthModalError.js';
import type { AuthErrorStatus } from './service/utils/auth-store.js';

const { mockSetAuthError, mockLogin } = vi.hoisted(() => ({
    mockSetAuthError: vi.fn(),
    mockLogin: vi.fn(),
}));

vi.mock('./service/utils/auth-store.js', () => ({
    authStore: { setAuthError: mockSetAuthError },
}));

let mockIsAuthServiceEnabled = false;
vi.mock('./authService.js', () => ({
    authService: { login: mockLogin },
    isAuthServiceEnabled: () => mockIsAuthServiceEnabled,
}));

let mockAuthError: AuthErrorStatus = null;
vi.mock('./service/utils/use-auth-store.js', () => ({
    useAuthError: () => mockAuthError,
}));

describe('AuthErrorModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthError = null;
        mockIsAuthServiceEnabled = false;
    });

    it('renders nothing when there is no auth error', () => {
        const { container } = render(<AuthErrorModal />);
        expect(container.firstChild).toBeNull();
    });

    describe('401 — session expired', () => {
        beforeEach(() => { mockAuthError = 401; });

        it('shows the session expired title and message', () => {
            render(<AuthErrorModal />);
            expect(screen.getByText('Session expired')).toBeInTheDocument();
            expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
        });

        it('hides Sign in again when OIDC is disabled', () => {
            render(<AuthErrorModal />);
            expect(screen.queryByRole('button', { name: /sign in again/i })).toBeNull();
        });

        it('shows Sign in again when OIDC is enabled', () => {
            mockIsAuthServiceEnabled = true;
            render(<AuthErrorModal />);
            expect(screen.getByRole('button', { name: /sign in again/i })).toBeInTheDocument();
        });

        it('calls setAuthError(null) and login when Sign in again is clicked', async () => {
            mockIsAuthServiceEnabled = true;
            render(<AuthErrorModal />);
            fireEvent.click(screen.getByRole('button', { name: /sign in again/i }));
            expect(mockSetAuthError).toHaveBeenCalledWith(null);
            expect(mockLogin).toHaveBeenCalled();
        });
    });

    describe('403 — access denied', () => {
        beforeEach(() => { mockAuthError = 403; });

        it('shows the access denied title and message', () => {
            render(<AuthErrorModal />);
            expect(screen.getByText('Access denied')).toBeInTheDocument();
            expect(screen.getByText('You are not authorised to view this resource. Please contact your system administrator to request access.')).toBeInTheDocument();
        });

        it('never shows Sign in again even when OIDC is enabled', () => {
            mockIsAuthServiceEnabled = true;
            render(<AuthErrorModal />);
            expect(screen.queryByRole('button', { name: /sign in again/i })).toBeNull();
        });
    });

    it('calls setAuthError(null) when Close is clicked', () => {
        mockAuthError = 401;
        render(<AuthErrorModal />);
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(mockSetAuthError).toHaveBeenCalledWith(null);
    });
});
