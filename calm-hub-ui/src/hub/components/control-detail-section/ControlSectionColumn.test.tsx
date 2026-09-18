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

    it('renders as a rounded bordered card', () => {
        const { container } = render(
            <ControlSectionColumn label="A">
                <div data-testid="content" />
            </ControlSectionColumn>,
        );
        expect(container.firstChild).toHaveClass('rounded-[12px]', 'bg-base-100', 'overflow-hidden');
        expect((container.firstChild as HTMLElement).style.border).toContain('1px solid');
    });
});
