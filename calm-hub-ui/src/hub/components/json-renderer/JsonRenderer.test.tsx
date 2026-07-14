import { render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { JsonRenderer } from './JsonRenderer.js';
import { CALM_DARK } from '../../../theme/monaco-theme.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: vi.fn(),
    };
});

/** Themes registered through the `beforeMount` hook the real Editor would call. */
const definedThemes: string[] = [];

vi.mock('@monaco-editor/react', () => ({
    Editor: ({
        value,
        options,
        theme,
        beforeMount,
    }: {
        value: string;
        options?: { lineNumbers?: 'on' | 'off' };
        theme?: string;
        beforeMount?: (monaco: unknown) => void;
    }) => {
        beforeMount?.({ editor: { defineTheme: (name: string) => definedThemes.push(name) } });
        return (
            <textarea
                value={value}
                readOnly
                data-testid="monaco-editor"
                data-line-numbers={options?.lineNumbers}
                data-theme={theme}
            />
        );
    }
}));

describe('JsonRenderer', () => {
    const mockNavigate = vi.fn();

    beforeEach(() => {
        vi.mocked(useNavigate).mockReturnValue(mockNavigate);
        mockNavigate.mockClear();
    });

    it('renders default message when jsonString is undefined', () => {
        render(
            <MemoryRouter>
                <JsonRenderer json={undefined} />
            </MemoryRouter>
        );
        expect(screen.getByText(/please select a document to load/i)).toBeInTheDocument();
        expect(screen.queryByText(/visualize/i)).not.toBeInTheDocument();
    });

    it('renders JsonView when jsonString is provided', () => {
        const data = {
            id: '42',
            version: '0.0.1',
            name: 'bar',
            calmType: 'Architectures',
            data: undefined,
        };
        render(
            <MemoryRouter>
                <JsonRenderer json={data} />
            </MemoryRouter>
        );

        // Monaco Editor is mocked as a textarea, so check its value
        const textarea = screen.getByTestId('monaco-editor');
        expect(textarea).toHaveValue(JSON.stringify(data, null, 2));
    });

    it('shows line numbers by default', () => {
        const data = { test: 'data' };
        render(
            <MemoryRouter>
                <JsonRenderer json={data} />
            </MemoryRouter>
        );

        const textarea = screen.getByTestId('monaco-editor');
        expect(textarea).toHaveAttribute('data-line-numbers', 'on');
    });

    it('shows line numbers when showLineNumbers is true', () => {
        const data = { test: 'data' };
        render(
            <MemoryRouter>
                <JsonRenderer json={data} showLineNumbers={true} />
            </MemoryRouter>
        );

        const textarea = screen.getByTestId('monaco-editor');
        expect(textarea).toHaveAttribute('data-line-numbers', 'on');
    });

    it('hides line numbers when showLineNumbers is false', () => {
        const data = { test: 'data' };
        render(
            <MemoryRouter>
                <JsonRenderer json={data} showLineNumbers={false} />
            </MemoryRouter>
        );

        const textarea = screen.getByTestId('monaco-editor');
        expect(textarea).toHaveAttribute('data-line-numbers', 'off');
    });

    describe('theme', () => {
        beforeEach(() => {
            definedThemes.length = 0;
        });
        afterEach(() => document.documentElement.removeAttribute('data-theme'));

        // Registration must happen even when mounting in light, or toggling to dark
        // would name a theme Monaco has never heard of and it would fall back to vs.
        it('registers the CALM dark theme on mount, whichever theme is active', () => {
            document.documentElement.setAttribute('data-theme', 'light');
            render(
                <MemoryRouter>
                    <JsonRenderer json={{ a: 1 }} />
                </MemoryRouter>
            );
            expect(definedThemes).toContain(CALM_DARK);
        });

        // Monaco ignores our stylesheet, so without this its light syntax colours
        // render as near-black text on the dark surface.
        it('uses the CALM dark Monaco theme when the document is dark', () => {
            document.documentElement.setAttribute('data-theme', 'dark');
            render(
                <MemoryRouter>
                    <JsonRenderer json={{ a: 1 }} />
                </MemoryRouter>
            );
            expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-theme', CALM_DARK);
        });

        it('uses the light Monaco theme when the document is light', () => {
            document.documentElement.setAttribute('data-theme', 'light');
            render(
                <MemoryRouter>
                    <JsonRenderer json={{ a: 1 }} />
                </MemoryRouter>
            );
            expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-theme', 'light');
        });
    });
});