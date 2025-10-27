import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocumentDetailSection } from './DocumentDetailSection.js';
import { describe, it, expect, vi } from 'vitest';
import { Data } from '../../../model/calm.js';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: vi.fn(() => vi.fn()),
    };
});

vi.mock('@monaco-editor/react', () => ({
    Editor: ({ value }: { value: string }) => <textarea value={value} readOnly data-testid="monaco-editor" />
}));

describe('DocumentDetailSection', () => {
    it('renders null when data is undefined', () => {
        const { container } = render(
            <MemoryRouter>
                <DocumentDetailSection data={undefined} />
            </MemoryRouter>
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders Patterns with correct icon', () => {
        const data: Data = {
            id: 'test-pattern',
            version: '1.0.0',
            name: 'my-namespace',
            calmType: 'Patterns',
            data: undefined,
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('my-namespace');
        expect(heading).toHaveTextContent('test-pattern');
        expect(heading).toHaveTextContent('1.0.0');
    });

    it('renders Flows with correct icon', () => {
        const data: Data = {
            id: 'test-flow',
            version: '2.0.0',
            name: 'flow-namespace',
            calmType: 'Flows',
            data: undefined,
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('flow-namespace');
        expect(heading).toHaveTextContent('test-flow');
        expect(heading).toHaveTextContent('2.0.0');
    });

    it('renders JsonRenderer with correct data', () => {
        const data: Data = {
            id: 'test-id',
            version: '1.0.0',
            name: 'test-namespace',
            calmType: 'Patterns',
            data: undefined,
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        const textarea = screen.getByTestId('monaco-editor');
        expect(textarea).toHaveValue(JSON.stringify(data, null, 2));
    });
});
