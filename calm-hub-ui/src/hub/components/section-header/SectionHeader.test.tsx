import { render, screen, fireEvent } from '@testing-library/react';
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

    it('shows share bar defaulting to latest (unversioned) URL when id is a slug', () => {
        const icon = <span>Icon</span>;

        render(
            <SectionHeader
                icon={icon}
                namespace="finos"
                id="api-gateway"
                version="1.0.0"
            />
        );

        const shareBar = screen.getByTestId('share-bar');
        expect(shareBar).toBeInTheDocument();

        const urlInput = screen.getByRole('textbox', { name: 'Shareable URL' });
        expect(urlInput).toBeInTheDocument();
        expect(urlInput).toHaveValue('http://localhost:3000/calm/namespaces/finos/api-gateway');
        expect(urlInput).toHaveAttribute('readOnly');

        expect(screen.getByTitle('Link to latest version')).toBeInTheDocument();
        expect(screen.getByTitle('Link to this specific version')).toBeInTheDocument();
        expect(screen.getByTitle('Copy URL')).toBeInTheDocument();
    });

    it('switches to pinned (versioned) URL when Pinned is clicked', () => {
        const icon = <span>Icon</span>;

        render(
            <SectionHeader
                icon={icon}
                namespace="finos"
                id="api-gateway"
                version="1.0.0"
            />
        );

        fireEvent.click(screen.getByTitle('Link to this specific version'));

        const urlInput = screen.getByRole('textbox', { name: 'Shareable URL' });
        expect(urlInput).toHaveValue('http://localhost:3000/calm/namespaces/finos/api-gateway/versions/1.0.0');
    });

    it('switches back to latest URL when Latest is clicked after Pinned', () => {
        const icon = <span>Icon</span>;

        render(
            <SectionHeader
                icon={icon}
                namespace="finos"
                id="api-gateway"
                version="1.0.0"
            />
        );

        fireEvent.click(screen.getByTitle('Link to this specific version'));
        fireEvent.click(screen.getByTitle('Link to latest version'));

        const urlInput = screen.getByRole('textbox', { name: 'Shareable URL' });
        expect(urlInput).toHaveValue('http://localhost:3000/calm/namespaces/finos/api-gateway');
    });

    it('does not show share bar when id is numeric', () => {
        const icon = <span>Icon</span>;

        render(
            <SectionHeader
                icon={icon}
                namespace="finos"
                id="42"
                version="1.0.0"
            />
        );

        expect(screen.queryByTestId('share-bar')).not.toBeInTheDocument();
    });
});
