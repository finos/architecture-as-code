import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MigrationErrorModal } from './MigrationModalError.js';
import type { MigrationErrorMessage } from './service/utils/migration-store.js';

const { mockSetMigrationError } = vi.hoisted(() => ({
    mockSetMigrationError: vi.fn(),
}));

vi.mock('./service/utils/migration-store.js', () => ({
    migrationStore: { setMigrationError: mockSetMigrationError },
}));

let mockMigrationError: MigrationErrorMessage = null;
vi.mock('./service/utils/use-migration-store.js', () => ({
    useMigrationError: () => mockMigrationError,
}));

describe('MigrationErrorModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMigrationError = null;
    });

    it('renders nothing when there is no migration error', () => {
        const { container } = render(<MigrationErrorModal />);
        expect(container.firstChild).toBeNull();
    });

    it('shows the Keep CALM title and the backend-provided message', () => {
        mockMigrationError = 'CalmHub is applying a schema migration and cannot serve requests right now.';
        render(<MigrationErrorModal />);
        expect(screen.getByText('Keep CALM')).toBeInTheDocument();
        expect(
            screen.getByText('CalmHub is applying a schema migration and cannot serve requests right now.')
        ).toBeInTheDocument();
    });

    it('calls setMigrationError(null) when Close is clicked', () => {
        mockMigrationError = 'migrating';
        render(<MigrationErrorModal />);
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(mockSetMigrationError).toHaveBeenCalledWith(null);
    });
});
