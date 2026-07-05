import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExploreRail } from './ExploreRail.js';
import type { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';

// Counts are owned by Hub and passed in as props; the rail no longer fetches them.
const namespaceCounts = [
    { namespace: 'finos', total: 4 },
    { namespace: 'traderx', total: 9 },
] as NamespaceCounts[];
const domainCounts: DomainControlCount[] = [
    { domain: 'security', controlCount: 7 },
    { domain: 'compliance', controlCount: 0 },
];

const renderRail = (path = '/', onCollapse?: () => void) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                {['/', '/namespace/:ns', '/domain/:domain'].map((p) => (
                    <Route
                        key={p}
                        path={p}
                        element={
                            <ExploreRail
                                namespaceCounts={namespaceCounts}
                                domainCounts={domainCounts}
                                onCollapse={onCollapse}
                            />
                        }
                    />
                ))}
            </Routes>
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ExploreRail', () => {
    it('renders the Explore header and the two section labels', async () => {
        renderRail();
        expect(screen.getByRole('heading', { name: 'Explore' })).toBeInTheDocument();
        expect(screen.getByText('NAMESPACES')).toBeInTheDocument();
        expect(screen.getByText('CONTROL DOMAINS')).toBeInTheDocument();
        // Wait for async data so the act warning does not leak into later tests.
        await screen.findByRole('link', { name: /finos/ });
    });

    it('renders namespace rows with totals and domain rows with control counts', async () => {
        renderRail();
        const finos = await screen.findByRole('link', { name: /finos/ });
        expect(finos).toHaveAttribute('href', '/namespace/finos');
        expect(await screen.findByRole('link', { name: /security/ })).toHaveAttribute('href', '/domain/security');

        const badges = screen.getAllByTestId('count-badge').map((b) => b.textContent);
        expect(badges).toEqual(expect.arrayContaining(['4', '9', '7', '0']));
    });

    it('client-filters namespace rows by the filter input', async () => {
        renderRail();
        await screen.findByRole('link', { name: /finos/ });

        fireEvent.change(screen.getByLabelText('Filter namespaces'), { target: { value: 'trade' } });

        expect(screen.getByRole('link', { name: /traderx/ })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /finos/ })).not.toBeInTheDocument();
        // Domain rows are unaffected by the namespace filter.
        expect(screen.getByRole('link', { name: /security/ })).toBeInTheDocument();
    });

    it('marks the namespace row matching the URL as active', async () => {
        renderRail('/namespace/traderx');
        const active = await screen.findByRole('link', { name: /traderx/ });
        expect(active).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: /finos/ })).not.toHaveAttribute('aria-current');
    });

    it('marks the domain row matching the URL as active', async () => {
        renderRail('/domain/security');
        const active = await screen.findByRole('link', { name: /security/ });
        expect(active).toHaveAttribute('aria-current', 'page');
    });

    it('invokes onCollapse when the collapse button is clicked', async () => {
        const onCollapse = vi.fn();
        renderRail('/', onCollapse);
        fireEvent.click(screen.getByLabelText('Collapse sidebar'));
        expect(onCollapse).toHaveBeenCalled();
        await screen.findByRole('link', { name: /finos/ });
    });
});
