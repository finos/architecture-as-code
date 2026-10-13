/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Russlan Ramdowar
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HashRouter } from 'react-router-dom';
import { AdrMarkdown } from './AdrMarkdown.js';

describe('ADR Markdown', () => {
    const originalUrl = window.location.href;
    afterEach(() => window.history.replaceState(null, '', originalUrl));

    it('keeps a semantic table inside a keyboard-accessible scrolling region', () => {
        render(<AdrMarkdown>{'| Choice | Cost |\n| --- | --- |\n| Queue | 2 |'}</AdrMarkdown>);

        const region = screen.getByRole('region', { name: 'ADR table' });
        expect(region).toHaveAttribute('tabindex', '0');
        expect(region).toHaveClass('adr-markdown-table');
        expect(region).toContainElement(screen.getByRole('table'));
        expect(screen.getByRole('columnheader', { name: 'Choice' })).toBeInTheDocument();
    });

    it('preserves CommonMark, headings and normal links while adding GFM autolinks', () => {
        render(
            <AdrMarkdown>
                {'## Decision\n\n*italic* **bold** [source](https://example.org/source)\n\nhttps://example.org/evidence'}
            </AdrMarkdown>
        );

        expect(screen.getByRole('heading', { name: 'Decision' })).not.toHaveClass('sr-only');
        expect(screen.getByText('italic').tagName).toBe('EM');
        expect(screen.getByText('bold').tagName).toBe('STRONG');
        expect(screen.getByRole('link', { name: 'source' })).toHaveAttribute('href', 'https://example.org/source');
        expect(screen.getByRole('link', { name: 'https://example.org/evidence' })).toHaveAttribute('href', 'https://example.org/evidence');
        let prevented = true;
        document.addEventListener(
            'click',
            (event) => {
                prevented = event.defaultPrevented;
                event.preventDefault();
            },
            { once: true }
        );
        fireEvent.click(screen.getByRole('link', { name: 'source' }));
        expect(prevented).toBe(false);
    });

    it('scrolls footnotes and back-links without changing the HashRouter route', () => {
        window.history.replaceState(null, '', '#/adrs/7');
        const { container } = render(
            <HashRouter>
                <AdrMarkdown>{'Decision[^note]\n\n[^note]: Evidence'}</AdrMarkdown>
            </HashRouter>
        );
        const reference = container.querySelector<HTMLAnchorElement>('a[data-footnote-ref]')!;
        const note = document.getElementById(reference.hash.slice(1))!;
        note.scrollIntoView = vi.fn();
        fireEvent.click(reference);
        expect(note.scrollIntoView).toHaveBeenCalledOnce();
        expect(window.location.hash).toBe('#/adrs/7');

        const backLink = container.querySelector<HTMLAnchorElement>('a[data-footnote-backref]')!;
        reference.scrollIntoView = vi.fn();
        fireEvent.click(backLink);
        expect(reference.scrollIntoView).toHaveBeenCalledOnce();
        expect(window.location.hash).toBe('#/adrs/7');
        const label = document.getElementById(reference.getAttribute('aria-describedby')!)!;
        expect(label).toHaveTextContent('Footnotes');
        expect(label).toHaveClass('sr-only');
    });

    it('keeps footnotes in separate ADR fields distinct, including their accessible labels', () => {
        const markdown = 'Decision[^note]\n\n[^note]: Evidence';
        const { container } = render(
            <>
                <AdrMarkdown>{markdown}</AdrMarkdown>
                <AdrMarkdown>{markdown}</AdrMarkdown>
            </>
        );
        const ids = Array.from(container.querySelectorAll('[id]'), (element) => element.id);
        expect(new Set(ids).size).toBe(ids.length);

        for (const reference of container.querySelectorAll<HTMLAnchorElement>('a[data-footnote-ref]')) {
            const target = document.getElementById(reference.hash.slice(1))!;
            const label = document.getElementById(reference.getAttribute('aria-describedby')!)!;
            expect(reference.closest('.adr-markdown')).toContainElement(target);
            expect(reference.closest('.adr-markdown')).toContainElement(label);
        }
    });

    it('decodes valid fragments and leaves the route intact for missing or malformed targets', () => {
        window.history.replaceState(null, '', '#/adrs/7');
        render(
            <>
                <div id="section with space">Evidence</div>
                <AdrMarkdown>{'[jump](#section%20with%20space) [missing](#absent) [broken](#%ZZ)'}</AdrMarkdown>
            </>
        );
        const target = screen.getByText('Evidence');
        target.scrollIntoView = vi.fn();
        fireEvent.click(screen.getByRole('link', { name: 'jump' }));
        expect(target.scrollIntoView).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('link', { name: 'missing' }));
        fireEvent.click(screen.getByRole('link', { name: 'broken' }));
        expect(window.location.hash).toBe('#/adrs/7');
    });

    it('does not enable raw HTML or unsafe URLs', () => {
        const { container } = render(<AdrMarkdown>{'<img src="x" onerror="alert(1)">\n\n[unsafe](javascript:alert(1))'}</AdrMarkdown>);
        expect(container.querySelector('img')).toBeNull();
        expect(screen.getByText('unsafe')).toHaveAttribute('href', '');
    });
});
