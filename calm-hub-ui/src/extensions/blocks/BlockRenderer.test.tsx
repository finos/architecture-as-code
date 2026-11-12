import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BlockRenderer } from './BlockRenderer.js';
import { HubTarget, ScreenBlock } from '../../model/extensions.js';
import { safeHref } from '../ScreenLink.js';
import { ScreenErrorBoundary } from '../ScreenErrorBoundary.js';

function draw(block: ScreenBlock) {
    return render(
        <MemoryRouter>
            <BlockRenderer block={block} />
        </MemoryRouter>
    );
}

describe('extension blocks', () => {
    it.each([
        { type: 'markdown', text: 'hello' },
        { type: 'keyValue', items: [{ label: 'hello', value: 1 }] },
        { type: 'stats', items: [{ label: 'hello', value: 1 }] },
        { type: 'table', columns: ['hello'], rows: [[{ badge: 'ok' }], [2]] },
        { type: 'cards', items: [{ title: 'hello', subtitle: 'sub' }] },
        { type: 'alert', text: 'hello' },
        { type: 'links', items: [{ label: 'hello', href: 'https://example.com' }] },
    ] as ScreenBlock[])('renders $type', (block) => {
        draw(block);
        expect(screen.getByText(/hello/)).toBeInTheDocument();
    });

    it('ignores raw HTML, unsafe Markdown links and remote images', () => {
        const { container } = draw({
            type: 'markdown',
            text: '<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n![image](https://example.com/x)',
        });
        expect(container.querySelector('script, img, a')).toBeNull();
    });

    it.each(['javascript:alert(1)', 'data:text/html,x', '/relative', '//example.com', 'not a URL'])('rejects %s', (href) => {
        expect(safeHref(href)).toBeUndefined();
    });

    it('adds safe external link attributes', () => {
        draw({ type: 'links', items: [{ label: 'site', href: 'https://example.com' }] });
        expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('encodes Hub target path segments', () => {
        draw({ type: 'links', items: [{ label: 'Hub', hub: { namespace: 'a/b', type: 'architectures', id: '1', version: '1.0.0' } }] });
        expect(screen.getByRole('link')).toHaveAttribute('href', '/a%2Fb/architectures/1/1.0.0');
    });

    it('shows a Hub link with a missing part as text', () => {
        const partial = { namespace: 'a', type: 'architectures', id: '1' } as unknown as HubTarget;
        draw({ type: 'links', items: [{ label: 'Partial', hub: partial }, { label: 'site', href: 'https://example.com' }] });
        expect(screen.getByText('Partial').closest('a')).toBeNull();
        expect(screen.getByRole('link')).toHaveTextContent('site');
    });

    it.each(['.', '..'])('shows a Hub link with a %s part as text, so it cannot open another page', (part) => {
        draw({ type: 'links', items: [
            { label: 'Dot', hub: { namespace: 'finos', type: 'architectures', id: part, version: '1.0.0' } },
            { label: 'Fine', hub: { namespace: 'finos', type: 'architectures', id: '..x', version: '1.0.0' } },
        ] });
        expect(screen.getByText('Dot').closest('a')).toBeNull();
        expect(screen.getByRole('link')).toHaveAttribute('href', '/finos/architectures/..x/1.0.0');
    });

    it('shows a placeholder for a future block', () => {
        draw({ type: 'future' } as unknown as ScreenBlock);
        expect(screen.getByText(/block type/)).toBeInTheDocument();
    });

    it('contains bad data within the slot boundary', () => {
        render(
            <>
                <ScreenErrorBoundary>
                    <BlockRenderer block={{ type: 'table', rows: null } as unknown as ScreenBlock} />
                </ScreenErrorBoundary>
                <p>Hub remains</p>
            </>
        );
        expect(screen.getByRole('alert')).toHaveTextContent('cannot show');
        expect(screen.getByText('Hub remains')).toBeInTheDocument();
    });
});

it('renders Markdown tables with the Hub Markdown styles', () => {
    const { container } = draw({ type: 'markdown', text: '| Name |\n| --- |\n| Service |' });
    expect(screen.getByRole('table')).toHaveTextContent('Service');
    expect(container.querySelector('.adr-markdown')).not.toBeNull();
});

describe('block tones', () => {
    it.each(['loud', 'constructor', 42, null])('falls back for an unknown tone %s', (tone) => {
        draw({ type: 'alert', text: 'hello', tone } as unknown as ScreenBlock);
        expect(screen.getByRole('alert').className).toBe('alert alert-info');
        draw({ type: 'table', columns: ['c'], rows: [[{ badge: 'b', tone }]] } as unknown as ScreenBlock);
        expect(screen.getByText('b').className).toBe('badge badge-sm badge-soft badge-ghost');
    });

    it('keeps a known tone', () => {
        draw({ type: 'alert', text: 'hello', tone: 'negative' });
        expect(screen.getByRole('alert').className).toBe('alert alert-error');
        draw({ type: 'table', columns: ['c'], rows: [[{ badge: 'b', tone: 'positive' }]] });
        expect(screen.getByText('b').className).toBe('badge badge-sm badge-soft badge-success');
    });
});

it('draws key-value lines between rows and columns, not a divide that puts a line at the start of a row', () => {
    const { container } = draw({ type: 'keyValue', items: [1, 2, 3, 4].map((n) => ({ label: `k${n}`, value: n })) });
    const list = container.querySelector('dl')!;
    expect(list.className).not.toMatch(/divide-/);
    expect(list.className).toContain('overflow-hidden');
    for (const item of screen.getAllByTestId('key-value-item')) {
        expect(item.className.split(' ')).toEqual(expect.arrayContaining(['-mt-px', '-ml-px', 'border-t', 'border-l']));
    }
});

describe('Markdown in a slot', () => {
    it('puts its headings below the slot title, and styles them', () => {
        render(
            <MemoryRouter>
                <BlockRenderer block={{ type: 'markdown', text: '# Top\n\n## Next\n\n#### Deep\n\n- item' }} headingLevel={4} />
            </MemoryRouter>
        );
        expect(screen.getByRole('heading', { name: 'Top', level: 5 })).toHaveClass('text-lg', 'font-bold');
        expect(screen.getByRole('heading', { name: 'Next', level: 6 })).toHaveClass('text-base', 'font-bold');
        expect(screen.getByRole('heading', { name: 'Deep', level: 6 })).toHaveClass('text-sm', 'font-semibold');
        expect(screen.getByRole('list')).toHaveClass('list-disc');
    });

    it('styles numbered lists and quotes, which Tailwind base styles reset', () => {
        const { container } = draw({ type: 'markdown', text: '1. one\n\n> quoted' });
        expect(screen.getByRole('list')).toHaveClass('list-decimal');
        expect(container.querySelector('blockquote')).toHaveClass('border-l-4');
    });

    it('starts below h2 when the slot gives no level', () => {
        draw({ type: 'markdown', text: '# Top' });
        expect(screen.getByRole('heading', { name: 'Top', level: 3 })).toBeInTheDocument();
    });
});

describe('blocks in a narrow slot', () => {
    // A details panel can be 304px wide on a wide screen, so the column count follows the slot, not the viewport.
    it.each([
        { type: 'keyValue', items: [{ label: 'k', value: 1 }] },
        { type: 'stats', items: [{ label: 'k', value: 1 }] },
        { type: 'cards', items: [{ title: 'k' }] },
    ] as ScreenBlock[])('sets the $type columns from the slot width', (block) => {
        const { container } = draw(block);
        const grid = container.firstElementChild!;
        expect(grid.className).toMatch(/@(md|sm):grid-cols-3/);
        expect(grid.className).not.toMatch(/(^|\s)sm:grid-cols/);
    });

    it('wraps a very long card title and subtitle in the card', () => {
        const long = 'x'.repeat(200);
        draw({ type: 'cards', items: [{ title: long, subtitle: long }] });
        for (const text of screen.getAllByText(long)) expect(text).toHaveClass('wrap-anywhere');
        expect(screen.getAllByText(long)[0].parentElement).toHaveClass('min-w-0');
    });
});
