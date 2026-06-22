import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NamespacesPanel } from './NamespacesPanel.js';
import { CalmService } from '../../service/calm-service.js';

function mockService(namespaces: string[], createResult: 'ok' | 'fail' = 'ok') {
    const svc = new CalmService();
    vi.spyOn(svc, 'fetchNamespaces').mockResolvedValue(namespaces);
    vi.spyOn(svc, 'createNamespace').mockImplementation(() =>
        createResult === 'ok' ? Promise.resolve() : Promise.reject(new Error('fail'))
    );
    return svc;
}

function renderPanel(svc: CalmService) {
    return render(<NamespacesPanel calmService={svc} />);
}

beforeEach(() => vi.clearAllMocks());

describe('NamespacesPanel', () => {

    describe('loading', () => {
        it('shows a loading spinner while fetching', () => {
            const svc = mockService([]);
            renderPanel(svc);
            expect(screen.getByLabelText('Loading namespaces')).toBeInTheDocument();
        });

        it('hides the spinner after loading', async () => {
            const svc = mockService(['finos']);
            renderPanel(svc);
            await waitFor(() =>
                expect(screen.queryByLabelText('Loading namespaces')).not.toBeInTheDocument()
            );
        });
    });

    describe('existing namespaces list', () => {
        it('renders each namespace as a badge', async () => {
            const svc = mockService(['finos', 'finos.payments']);
            renderPanel(svc);
            expect(await screen.findByText('finos')).toBeInTheDocument();
            expect(await screen.findByText('finos.payments')).toBeInTheDocument();
        });

        it('shows empty state message when no namespaces exist', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            expect(await screen.findByText(/no namespaces yet/i)).toBeInTheDocument();
        });

        it('shows a load error when fetch fails', async () => {
            const svc = new CalmService();
            vi.spyOn(svc, 'fetchNamespaces').mockRejectedValue(new Error('fail'));
            renderPanel(svc);
            await waitFor(() =>
                expect(screen.getByRole('alert')).toHaveTextContent(/failed to load namespaces/i)
            );
        });
    });

    describe('create namespace form', () => {
        it('renders the name and description inputs', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Namespace name');
            expect(screen.getByLabelText('Namespace name')).toBeInTheDocument();
            expect(screen.getByLabelText('Namespace description')).toBeInTheDocument();
        });

        it('disables the create button when name is empty', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Namespace name');
            expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
        });

        it('enables the create button when name is filled', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Namespace name');
            fireEvent.change(screen.getByLabelText('Namespace name'), {
                target: { value: 'my-ns' },
            });
            expect(screen.getByRole('button', { name: /create/i })).not.toBeDisabled();
        });

        it('calls createNamespace with trimmed name and description on submit', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Namespace name');

            fireEvent.change(screen.getByLabelText('Namespace name'), {
                target: { value: '  my-ns  ' },
            });
            fireEvent.change(screen.getByLabelText('Namespace description'), {
                target: { value: '  My namespace  ' },
            });
            fireEvent.click(screen.getByRole('button', { name: /create/i }));

            await waitFor(() =>
                expect(svc.createNamespace).toHaveBeenCalledWith('my-ns', 'My namespace')
            );
        });

        it('shows success message after creation', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Namespace name');

            fireEvent.change(screen.getByLabelText('Namespace name'), {
                target: { value: 'my-ns' },
            });
            fireEvent.click(screen.getByRole('button', { name: /create/i }));

            await waitFor(() =>
                expect(screen.getByRole('status')).toHaveTextContent(/my-ns.*created/i)
            );
        });

        it('clears the form fields after successful creation', async () => {
            const svc = mockService([]);
            renderPanel(svc);
            await screen.findByLabelText('Namespace name');

            fireEvent.change(screen.getByLabelText('Namespace name'), {
                target: { value: 'my-ns' },
            });
            fireEvent.change(screen.getByLabelText('Namespace description'), {
                target: { value: 'some description' },
            });
            fireEvent.click(screen.getByRole('button', { name: /create/i }));

            await waitFor(() => screen.getByRole('status'));
            expect(screen.getByLabelText('Namespace name')).toHaveValue('');
            expect(screen.getByLabelText('Namespace description')).toHaveValue('');
        });

        it('refreshes the namespace list after successful creation', async () => {
            const svc = new CalmService();
            vi.spyOn(svc, 'fetchNamespaces')
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce(['my-ns']);
            vi.spyOn(svc, 'createNamespace').mockResolvedValue();
            renderPanel(svc);
            await screen.findByText(/no namespaces yet/i);

            fireEvent.change(screen.getByLabelText('Namespace name'), {
                target: { value: 'my-ns' },
            });
            fireEvent.click(screen.getByRole('button', { name: /create/i }));

            expect(await screen.findByText('my-ns')).toBeInTheDocument();
        });

        it('shows error message when creation fails', async () => {
            const svc = mockService([], 'fail');
            renderPanel(svc);
            await screen.findByLabelText('Namespace name');

            fireEvent.change(screen.getByLabelText('Namespace name'), {
                target: { value: 'my-ns' },
            });
            fireEvent.click(screen.getByRole('button', { name: /create/i }));

            await waitFor(() =>
                expect(screen.getByRole('alert')).toHaveTextContent(/failed to create namespace/i)
            );
        });
    });

    describe('headings', () => {
        it('renders the Namespaces page heading', () => {
            const svc = mockService([]);
            renderPanel(svc);
            expect(screen.getByRole('heading', { name: /namespaces/i, level: 1 })).toBeInTheDocument();
        });

        it('renders the Create Namespace section heading', () => {
            const svc = mockService([]);
            renderPanel(svc);
            expect(screen.getByRole('heading', { name: /create namespace/i })).toBeInTheDocument();
        });

        it('renders the Existing Namespaces section heading', () => {
            const svc = mockService([]);
            renderPanel(svc);
            expect(screen.getByRole('heading', { name: /existing namespaces/i })).toBeInTheDocument();
        });
    });
});
