/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FlowHeader } from './FlowHeader.js';

describe('FlowHeader', () => {
    it('renders the description', () => {
        render(<FlowHeader description="Trader places a new trade order through the platform" />);
        expect(
            screen.getByText('Trader places a new trade order through the platform')
        ).toBeInTheDocument();
    });

    it('renders nothing when there is no description', () => {
        const { container } = render(<FlowHeader />);
        expect(container.firstChild).toBeNull();
    });

    it('does not repeat the flow name - the breadcrumb already shows it', () => {
        render(<FlowHeader description="Payment Processing flow description" />);
        expect(screen.queryByRole('heading')).toBeNull();
    });
});
