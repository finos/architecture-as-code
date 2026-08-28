import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ControlSectionColumn } from './ControlSectionColumn.js';

describe('ControlSectionColumn', () => {
    it('renders the label, picker, toggle and content', () => {
        render(
            <ControlSectionColumn
                label="Requirement"
                picker={<span data-testid="picker" />}
                toggle={<span data-testid="toggle" />}
            >
                <div data-testid="content" />
            </ControlSectionColumn>,
        );
        expect(screen.getByText('Requirement')).toBeInTheDocument();
        expect(screen.getByTestId('picker')).toBeInTheDocument();
        expect(screen.getByTestId('toggle')).toBeInTheDocument();
        expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('adds a right border only when bordered', () => {
        const { rerender, container } = render(
            <ControlSectionColumn label="A"><div /></ControlSectionColumn>,
        );
        expect(container.firstChild).not.toHaveClass('border-r');

        rerender(
            <ControlSectionColumn label="A" bordered><div /></ControlSectionColumn>,
        );
        expect(container.firstChild).toHaveClass('border-r');
    });
});
