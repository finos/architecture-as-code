import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainsPanel } from './DomainsPanel.js';
import { CalmService } from '../../service/calm-service.js';

function mockService(domains: string[], createResult: 'ok' | 'fail' = 'ok') {
    const svc = new CalmService();
    vi.spyOn(svc, 'fetchDomains').mockResolvedValue(domains);
    vi.spyOn(svc, 'createDomain').mockImplementation(() =>
        createResult === 'ok' ? Promise.resolve() : Promise.reject(new Error('fail'))
    );
    return svc;
}

function renderPanel(svc: CalmService) {
    return render(<DomainsPanel calmService={svc} />);
}

beforeEach(() => vi.clearAllMocks());

describe('DomainsPanel', () => {

    describe('loading', () => {
        it('shows a loading spinner while fetching', () => {
            const svc = mockService([]);
            renderPanel(svc);
            expect(screen.getByLabelText('Loading domains')).toBeInTheDocument();
        });

        it('hides the spinner after loading', async () => {
            const svc = mockService(['retail']);
            renderPanel(svc);
            await waitFor(() =>
                expect(screen.queryByLabelText('Loading domains')).not.toBeInTheDocument()
            );
        });
    });

    describe('existing domains list', () => {
        it('renders each domain as a badge', async () => {
            const svc = mockService(['retail', 'wholesale']);
            renderPanel(svc);
            expect(await screen.findByText('retail')).toBeInTheDocument();
            expect(await screen.findByText('wholesale')).toBeInTheDocument();
        });

        it('shows empty state message when no domains exist', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            expect(await screen.findByText(/no domains yet/i)).toBeInTheDocument();
        });

        it('shows a load error when fetch fails', async () => {
            const svc = new CalmService();
            vi.spyOn(svc, 'fetchDomains').mockRejectedValue(new Error('fail'));
            renderPanel(svc);
            await waitFor(() =>
                expect(screen.getByRole('alert')).toHaveTextContent(/failed to load domains/i)
            );
        });
    });

    describe('create domain form', () => {
        it('renders the domain name input', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Domain name');
            expect(screen.getByLabelText('Domain name')).toBeInTheDocument();
        });

        it('disables the create button when name is empty', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Domain name');
            expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
        });

        it('enables the create button when name is filled', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Domain name');
            fireEvent.change(screen.getByLabelText('Domain name'), {
                target: { value: 'retail' },
            });
            expect(screen.getByRole('button', { name: /create/i })).not.toBeDisabled();
        });

        it('calls createDomain with trimmed name on submit', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Domain name');

            fireEvent.change(screen.getByLabelText('Domain name'), {
                target: { value: '  retail  ' },
            });
            fireEvent.click(screen.getByRole('button', { name: /create/i }));

            await waitFor(() =>
                expect(svc.createDomain).toHaveBeenCalledWith('retail')
            );
        });

        it('shows success message after creation', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Domain name');

            fireEvent.change(screen.getByLabelText('Domain name'), {
                target: { value: 'retail' },
            });
            fireEvent.click(screen.getByRole('button', { name: /create/i }));

            await waitFor(() =>
                expect(screen.getByRole('status')).toHaveTextContent(/retail.*created/i)
            );
        });

        it('clears the name field after successful creation', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Domain name');

            fireEvent.change(screen.getByLabelText('Domain name'), {
                target: { value: 'retail' },
            });
            fireEvent.click(screen.getByRole('button', { name: /create/i }));

            await waitFor(() => screen.getByRole('status'));
            expect(screen.getByLabelText('Domain name')).toHaveValue('');
        });

        it('refreshes the domain list after successful creation', async () => {
            const svc = new CalmService();
            vi.spyOn(svc, 'fetchDomains')
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce(['retail']);
            vi.spyOn(svc, 'createDomain').mockResolvedValue();
            renderPanel(svc);
            await screen.findByText(/no domains yet/i);

            fireEvent.change(screen.getByLabelText('Domain name'), {
                target: { value: 'retail' },
            });
            fireEvent.click(screen.getByRole('button', { name: /create/i }));

            expect(await screen.findByText('retail')).toBeInTheDocument();
        });

        it('shows error message when creation fails', async () => {
            const svc = mockService([], 'fail');
            renderPanel(svc);
            await screen.findByLabelText('Domain name');

            fireEvent.change(screen.getByLabelText('Domain name'), {
                target: { value: 'retail' },
            });
            fireEvent.click(screen.getByRole('button', { name: /create/i }));

            await waitFor(() =>
                expect(screen.getByRole('alert')).toHaveTextContent(/failed to create domain/i)
            );
        });
    });

    describe('headings', () => {
        it('renders the Domains page heading', () => {
            const svc = mockService([]);
            renderPanel(svc);
            expect(screen.getByRole('heading', { name: /domains/i, level: 1 })).toBeInTheDocument();
        });

        it('renders the Create Domain section heading', () => {
            const svc = mockService([]);
            renderPanel(svc);
            expect(screen.getByRole('heading', { name: /create domain/i })).toBeInTheDocument();
        });

        it('renders the Existing Domains section heading', () => {
            const svc = mockService([]);
            renderPanel(svc);
            expect(screen.getByRole('heading', { name: /existing domains/i })).toBeInTheDocument();
        });
    });
});
