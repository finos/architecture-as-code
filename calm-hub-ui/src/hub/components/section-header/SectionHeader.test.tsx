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
                typeSegment="architectures"
            />
        );

        expect(screen.getByTestId('test-icon')).toBeInTheDocument();

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('my-namespace');
        expect(heading).toHaveTextContent('my-id');
        expect(heading).toHaveTextContent('1.0.0');
    });

    it('shows the display name and type label in place of the id when provided', () => {
        render(
            <SectionHeader
                icon={<span>Icon</span>}
                namespace="my-namespace"
                id="42"
                version="1.0.0"
                typeSegment="architectures"
                showVersion={false}
                typeLabel="Architecture"
                displayName="Trading System"
            />
        );

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('my-namespace');
        expect(heading).toHaveTextContent('Architecture');
        expect(heading).toHaveTextContent('Trading System');
        // The numeric id is no longer shown as the label (kept as a tooltip).
        expect(heading).not.toHaveTextContent('42');
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
                typeSegment="architectures"
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
                typeSegment="architectures"
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
                typeSegment="architectures"
            />
        );

        const graySpans = container.querySelectorAll('.text-gray-400');
        expect(graySpans).toHaveLength(2);
        expect(graySpans[0]).toHaveTextContent('/');
        expect(graySpans[1]).toHaveTextContent('/');
    });

    it('shows share bar with pinned versioned URL when id is a slug', () => {
        const icon = <span>Icon</span>;

        render(
            <SectionHeader
                icon={icon}
                namespace="finos"
                id="api-gateway"
                version="1.0.0"
                typeSegment="architectures"
            />
        );

        const shareBar = screen.getByTestId('share-bar');
        expect(shareBar).toBeInTheDocument();

        const urlInput = screen.getByRole('textbox', { name: 'Shareable URL' });
        expect(urlInput).toBeInTheDocument();
        expect(urlInput).toHaveValue(
            'http://localhost:3000/calm/namespaces/finos/architectures/api-gateway/versions/1.0.0'
        );
        expect(urlInput).toHaveAttribute('readOnly');

        expect(screen.getByTitle('Copy URL')).toBeInTheDocument();
        expect(screen.queryByTitle('Link to latest version')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Link to this specific version')).not.toBeInTheDocument();
    });

    it('does not show share bar when id is numeric', () => {
        const icon = <span>Icon</span>;

        render(
            <SectionHeader
                icon={icon}
                namespace="finos"
                id="42"
                version="1.0.0"
                typeSegment="architectures"
            />
        );

        expect(screen.queryByTestId('share-bar')).not.toBeInTheDocument();
    });
});
