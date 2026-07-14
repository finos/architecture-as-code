import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BreadcrumbTrail } from './BreadcrumbTrail.js';
import { BreadcrumbItem } from '../../../model/calm.js';

const threeCrumbs: BreadcrumbItem[] = [
    { namespace: 'finos', type: 'architectures', id: 'level-1', version: '1.0.0' },
    { namespace: 'finos', type: 'architectures', id: 'level-2', version: '1.0.0' },
    { namespace: 'finos', type: 'architectures', id: 'level-3', version: '1.0.0' },
];

describe('BreadcrumbTrail', () => {
    it('renders nothing for an empty trail', () => {
        const { container } = render(<BreadcrumbTrail breadcrumbs={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('closes the ellipsis dropdown on Escape and returns focus to the trigger', async () => {
        const user = userEvent.setup();
        render(<BreadcrumbTrail breadcrumbs={threeCrumbs} />);

        const trigger = screen.getByRole('button', { name: 'Show hidden breadcrumbs' });
        await user.click(trigger);
        expect(screen.getByRole('button', { name: 'level-2' })).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('button', { name: 'level-2' })).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('reports the original index for a crumb chosen from the dropdown', async () => {
        const user = userEvent.setup();
        const onBreadcrumbClick = vi.fn();
        render(<BreadcrumbTrail breadcrumbs={threeCrumbs} onBreadcrumbClick={onBreadcrumbClick} />);

        await user.click(screen.getByRole('button', { name: 'Show hidden breadcrumbs' }));
        await user.click(screen.getByRole('button', { name: 'level-2' }));

        expect(onBreadcrumbClick).toHaveBeenCalledWith(threeCrumbs[1], 1);
    });

    it('gives the immediate-parent (last) crumb a wider truncation cap than the first', () => {
        render(<BreadcrumbTrail breadcrumbs={threeCrumbs} />);

        // The last crumb is the primary "go back" target, so it is capped wider
        // (12rem) than the first/middle crumbs (8rem) to stay readable.
        expect(screen.getByRole('button', { name: 'level-1' })).toHaveClass('max-w-[8rem]');
        expect(screen.getByRole('button', { name: 'level-3' })).toHaveClass('max-w-[12rem]');
    });
});
