import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectionHeader } from './SectionHeader.js';
import { describe, it, expect, vi } from 'vitest';
import type { BreadcrumbItem } from '../../../model/calm.js';

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

    it('renders slashes with muted styling', () => {
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

        const mutedSpans = container.querySelectorAll('[class*="text-base-content/40"]');
        expect(mutedSpans).toHaveLength(2);
        expect(mutedSpans[0]).toHaveTextContent('/');
        expect(mutedSpans[1]).toHaveTextContent('/');
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

    it('renders a single breadcrumb as a button before the current trail', () => {
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'patterns', id: 'api-gateway-pattern', version: '1.0.0' },
        ];

        render(
            <SectionHeader
                icon={<span>Icon</span>}
                namespace="finos"
                id="api-platform"
                version="1.0.0"
                typeSegment="architectures"
                breadcrumbs={crumbs}
            />
        );

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('api-gateway-pattern');
        expect(heading).toHaveTextContent('api-platform');
        expect(screen.queryByText('…')).not.toBeInTheDocument();
    });

    it('renders two breadcrumbs as two buttons with no ellipsis', () => {
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'architectures', id: 'microservices-platform', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'backend-services', version: '1.0.0' },
        ];

        render(
            <SectionHeader
                icon={<span>Icon</span>}
                namespace="finos"
                id="order-service"
                version="1.0.0"
                typeSegment="architectures"
                breadcrumbs={crumbs}
            />
        );

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('microservices-platform');
        expect(heading).toHaveTextContent('backend-services');
        expect(screen.queryByText('…')).not.toBeInTheDocument();
    });

    it('collapses middle breadcrumbs into an ellipsis when there are more than two', () => {
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'architectures', id: 'level-1', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'level-2', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'level-3', version: '1.0.0' },
        ];

        render(
            <SectionHeader
                icon={<span>Icon</span>}
                namespace="finos"
                id="level-4"
                version="1.0.0"
                typeSegment="architectures"
                breadcrumbs={crumbs}
            />
        );

        expect(screen.getByRole('button', { name: 'level-1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'level-3' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'level-2' })).not.toBeInTheDocument();
        expect(screen.getByText('…')).toBeInTheDocument();
    });

    it('calls onBreadcrumbClick with the correct crumb and index when a breadcrumb is clicked', async () => {
        const user = userEvent.setup();
        const onBreadcrumbClick = vi.fn();
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'patterns', id: 'api-gateway-pattern', version: '1.0.0' },
        ];

        render(
            <SectionHeader
                icon={<span>Icon</span>}
                namespace="finos"
                id="api-platform"
                version="1.0.0"
                typeSegment="architectures"
                breadcrumbs={crumbs}
                onBreadcrumbClick={onBreadcrumbClick}
            />
        );

        await user.click(screen.getByRole('button', { name: 'api-gateway-pattern' }));
        expect(onBreadcrumbClick).toHaveBeenCalledWith(crumbs[0], 0);
    });

    it('collapses to first and last and navigates to the last crumb when clicked with 3+ breadcrumbs', async () => {
        const user = userEvent.setup();
        const onBreadcrumbClick = vi.fn();
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'architectures', id: 'root', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'middle', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'parent', version: '1.0.0' },
        ];

        render(
            <SectionHeader
                icon={<span>Icon</span>}
                namespace="finos"
                id="current"
                version="1.0.0"
                typeSegment="architectures"
                breadcrumbs={crumbs}
                onBreadcrumbClick={onBreadcrumbClick}
            />
        );

        await user.click(screen.getByRole('button', { name: 'parent' }));
        expect(onBreadcrumbClick).toHaveBeenCalledWith(crumbs[2], 2);
    });

    it('opens a dropdown with hidden breadcrumbs when the ellipsis is clicked', async () => {
        const user = userEvent.setup();
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'architectures', id: 'level-1', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'level-2', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'level-3', version: '1.0.0' },
        ];

        render(
            <SectionHeader
                icon={<span>Icon</span>}
                namespace="finos"
                id="level-4"
                version="1.0.0"
                typeSegment="architectures"
                breadcrumbs={crumbs}
            />
        );

        expect(screen.queryByRole('button', { name: 'level-2' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Show hidden breadcrumbs' }));

        expect(screen.getByRole('button', { name: 'level-2' })).toBeInTheDocument();
    });

    it('calls onBreadcrumbClick with the correct crumb and index when a dropdown item is clicked', async () => {
        const user = userEvent.setup();
        const onBreadcrumbClick = vi.fn();
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'architectures', id: 'level-1', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'level-2', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'level-3', version: '1.0.0' },
        ];

        render(
            <SectionHeader
                icon={<span>Icon</span>}
                namespace="finos"
                id="level-4"
                version="1.0.0"
                typeSegment="architectures"
                breadcrumbs={crumbs}
                onBreadcrumbClick={onBreadcrumbClick}
            />
        );

        await user.click(screen.getByRole('button', { name: 'Show hidden breadcrumbs' }));
        await user.click(screen.getByRole('button', { name: 'level-2' }));

        expect(onBreadcrumbClick).toHaveBeenCalledWith(crumbs[1], 1);
        expect(screen.queryByRole('button', { name: 'level-2' })).not.toBeInTheDocument();
    });

    it('closes the dropdown when clicking outside', async () => {
        const user = userEvent.setup();
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'architectures', id: 'level-1', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'level-2', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'level-3', version: '1.0.0' },
        ];

        render(
            <SectionHeader
                icon={<span>Icon</span>}
                namespace="finos"
                id="level-4"
                version="1.0.0"
                typeSegment="architectures"
                breadcrumbs={crumbs}
            />
        );

        await user.click(screen.getByRole('button', { name: 'Show hidden breadcrumbs' }));
        expect(screen.getByRole('button', { name: 'level-2' })).toBeInTheDocument();

        await user.click(document.body);
        expect(screen.queryByRole('button', { name: 'level-2' })).not.toBeInTheDocument();
    });

    // Long trails must fit narrow (mobile) viewports. The header has no JS
    // viewport branching — mobile fit is pure CSS — so this locks the two
    // structural affordances that make it work: the heading wraps
    // (`flex-wrap`), and every crumb is width-capped and truncated with a
    // title tooltip carrying the full text. jsdom cannot measure layout;
    // the visual check at a real mobile width stays a manual step.
    it('keeps the heading wrappable and long crumbs truncated so deep trails fit narrow viewports', () => {
        const longId = 'a-very-long-architecture-identifier-that-would-overflow-a-phone-screen';
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'architectures', id: longId, version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'level-2', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'level-3', version: '1.0.0' },
        ];

        render(
            <SectionHeader
                icon={<span>Icon</span>}
                namespace="finos"
                id="level-4"
                version="1.0.0"
                typeSegment="architectures"
                breadcrumbs={crumbs}
            />
        );

        expect(screen.getByRole('heading')).toHaveClass('flex-wrap');

        const crumbButton = screen.getByRole('button', { name: longId });
        expect(crumbButton).toHaveClass('truncate', 'max-w-[8rem]');
        expect(crumbButton).toHaveAttribute('title', longId);
    });
});
