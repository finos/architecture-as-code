import { render, screen } from '@testing-library/react';
import { SectionHeader } from './SectionHeader.js';
import { describe, it, expect } from 'vitest';

describe('SectionHeader', () => {
    it('renders icon, namespace, id, and version', () => {
        const icon = <span data-testid="test-icon">Icon</span>;
        render(
            <SectionHeader
                icon={icon}
                namespace="my-namespace"
                id="my-id"
                version="1.0.0"
            />
        );

        expect(screen.getByTestId('test-icon')).toBeInTheDocument();

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('my-namespace');
        expect(heading).toHaveTextContent('my-id');
        expect(heading).toHaveTextContent('1.0.0');
    });

    it('renders right content when provided', () => {
        const icon = <span>Icon</span>;
        const rightContent = <div data-testid="right-content">Right Content</div>;

        render(
            <SectionHeader
                icon={icon}
                namespace="namespace"
                id="id"
                version="1.0"
                rightContent={rightContent}
            />
        );

        expect(screen.getByTestId('right-content')).toBeInTheDocument();
        expect(screen.getByText('Right Content')).toBeInTheDocument();
    });

    it('renders without right content', () => {
        const icon = <span>Icon</span>;

        render(
            <SectionHeader
                icon={icon}
                namespace="namespace"
                id="id"
                version="1.0"
            />
        );

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('namespace');
    });

    it('renders slashes with gray styling', () => {
        const icon = <span>Icon</span>;

        const { container } = render(
            <SectionHeader
                icon={icon}
                namespace="namespace"
                id="id"
                version="1.0"
            />
        );

        const graySpans = container.querySelectorAll('.text-gray-400');
        expect(graySpans).toHaveLength(2);
        expect(graySpans[0]).toHaveTextContent('/');
        expect(graySpans[1]).toHaveTextContent('/');
    });
});
