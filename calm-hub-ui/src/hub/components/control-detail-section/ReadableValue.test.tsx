import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReadableValue } from './ReadableValue.js';

describe('ReadableValue', () => {
    it('renders booleans as badges', () => {
        const { rerender } = render(<ReadableValue value={true} />);
        expect(screen.getByText('true')).toHaveClass('badge', 'badge-success');
        rerender(<ReadableValue value={false} />);
        expect(screen.getByText('false')).toHaveClass('badge', 'badge-error');
    });

    it('renders numbers in a mono info style', () => {
        render(<ReadableValue value={42} />);
        expect(screen.getByText('42')).toHaveClass('font-mono', 'text-info');
    });

    it('renders null as italic text', () => {
        render(<ReadableValue value={null} />);
        expect(screen.getByText('null')).toHaveClass('italic');
    });

    it('renders a URL string as an external link', () => {
        render(<ReadableValue value="https://owasp.org/x" />);
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', 'https://owasp.org/x');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders a plain string with the active-text class, not a link', () => {
        render(<ReadableValue value="90-days" />);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('90-days')).toHaveClass('text-[var(--calm-redesign-active-text)]');
    });

    it('renders a string array as a bullet list, linking URL items', () => {
        render(<ReadableValue value={['see https://a.example', 'https://b.example']} />);
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByRole('link', { name: /b\.example/ })).toHaveAttribute(
            'href',
            'https://b.example',
        );
    });

    it('renders an empty array as placeholder text', () => {
        render(<ReadableValue value={[]} />);
        expect(screen.getByText('empty list')).toBeInTheDocument();
    });
});
