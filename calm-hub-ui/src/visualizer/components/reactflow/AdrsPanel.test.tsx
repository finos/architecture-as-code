import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AdrsPanel } from './AdrsPanel';
import { getAdrDisplayName, isCalmHubAdr, toAdrAppRoute } from './adr-utils';

describe('AdrsPanel', () => {
    it('renders nothing when adrs is empty', () => {
        const { container } = render(<AdrsPanel adrs={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders header with count', () => {
        const adrs = [
            'https://github.com/org/project/docs/adr/0001-use-oauth2.md',
            'https://example.com/adr/0002-rate-limiting.pdf',
        ];
        render(<AdrsPanel adrs={adrs} />);
        expect(screen.getByText('Architecture Decision Records (2)')).toBeInTheDocument();
    });

    it('renders external ADR links with target _blank', () => {
        const adrs = ['https://github.com/org/project/docs/adr/0001-use-oauth2.md'];
        render(<AdrsPanel adrs={adrs} />);

        const link = screen.getByRole('link', { name: /0001-use-oauth2.md/ });
        expect(link).toHaveAttribute('href', 'https://github.com/org/project/docs/adr/0001-use-oauth2.md');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders calm-hub internal ADR links as in-app navigation', () => {
        const adrs = ['/calm/namespaces/workshop/adrs/1'];
        render(<AdrsPanel adrs={adrs} />);

        const link = screen.getByRole('link', { name: /ADR 1 \(workshop\)/ });
        expect(link).toHaveAttribute('href', '#/workshop/adrs/1/1');
        expect(link).not.toHaveAttribute('target');
    });

    it('renders a mix of external and internal links', () => {
        const adrs = [
            'https://github.com/org/project/docs/adr/0001-use-oauth2.md',
            '/calm/namespaces/finos/adrs/42',
        ];
        render(<AdrsPanel adrs={adrs} />);

        expect(screen.getByText('Architecture Decision Records (2)')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /0001-use-oauth2.md/ })).toHaveAttribute('target', '_blank');
        expect(screen.getByRole('link', { name: /ADR 42 \(finos\)/ })).toHaveAttribute('href', '#/finos/adrs/42/1');
    });
});

describe('getAdrDisplayName', () => {
    it('extracts filename from external URL', () => {
        expect(getAdrDisplayName('https://github.com/org/project/docs/adr/0001-use-oauth2.md')).toBe('0001-use-oauth2.md');
    });

    it('extracts filename from URL ending with .pdf', () => {
        expect(getAdrDisplayName('https://internal-docs.company.com/adr/0001-rate-limiting.pdf')).toBe('0001-rate-limiting.pdf');
    });

    it('formats calm-hub internal link', () => {
        expect(getAdrDisplayName('/calm/namespaces/workshop/adrs/1')).toBe('ADR 1 (workshop)');
    });

    it('handles plain path segments', () => {
        expect(getAdrDisplayName('/some/random/path')).toBe('path');
    });

    it('falls back to full string when no segments', () => {
        expect(getAdrDisplayName('')).toBe('');
    });
});

describe('isCalmHubAdr', () => {
    it('returns true for calm-hub ADR paths', () => {
        expect(isCalmHubAdr('/calm/namespaces/workshop/adrs/1')).toBe(true);
        expect(isCalmHubAdr('/calm/namespaces/finos/adrs/42')).toBe(true);
    });

    it('returns false for external URLs', () => {
        expect(isCalmHubAdr('https://github.com/org/project/docs/adr/0001.md')).toBe(false);
    });

    it('returns false for non-matching paths', () => {
        expect(isCalmHubAdr('/some/other/path')).toBe(false);
    });
});

describe('toAdrAppRoute', () => {
    it('converts calm-hub path to app hash route', () => {
        expect(toAdrAppRoute('/calm/namespaces/workshop/adrs/1')).toBe('/workshop/adrs/1/1');
    });

    it('converts with different namespace', () => {
        expect(toAdrAppRoute('/calm/namespaces/finos/adrs/42')).toBe('/finos/adrs/42/1');
    });

    it('returns original URL for non-matching paths', () => {
        expect(toAdrAppRoute('https://example.com/adr')).toBe('https://example.com/adr');
    });
});
