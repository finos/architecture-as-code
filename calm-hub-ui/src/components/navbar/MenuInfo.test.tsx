import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MenuInfo } from './MenuInfo.js';

describe('MenuInfo', () => {
    it('renders nothing when there is no identity and no items', () => {
        const { container } = render(<MenuInfo items={[]} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('shows the identity without roles', () => {
        render(<MenuInfo identity={{ name: 'alice' }} />);

        const identity = screen.getByTestId('menu-identity');
        expect(within(identity).getByText('Signed in as')).toBeInTheDocument();
        expect(within(identity).getByText('alice')).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: 'Roles' })).not.toBeInTheDocument();
    });

    it('shows the roles when the identity has them', () => {
        render(<MenuInfo identity={{ name: 'alice', roles: ['admins', 'writers'] }} />);

        const roles = screen.getByRole('list', { name: 'Roles' });
        expect(within(roles).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['admins', 'writers']);
    });

    it('shows a value item as a caption and plain text', () => {
        render(<MenuInfo items={[{ label: 'Build', value: '2026.10.1' }]} />);

        expect(screen.getByText('Build')).toBeInTheDocument();
        expect(screen.getByText('2026.10.1')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('shows a url item as a link with the label as text', () => {
        render(<MenuInfo items={[{ label: 'Support', url: 'https://support.example.com' }]} />);

        const link = screen.getByRole('link', { name: 'Support' });
        expect(link).toHaveAttribute('href', 'https://support.example.com');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('shows a url item with a value as a caption and a link with the value as text', () => {
        render(<MenuInfo items={[{ label: 'Runbook', value: 'wiki/calm-hub', url: 'https://wiki.example.com/calm-hub' }]} />);

        expect(screen.getByText('Runbook')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'wiki/calm-hub' })).toHaveAttribute('href', 'https://wiki.example.com/calm-hub');
    });

    it('keeps the configured order of items', () => {
        render(<MenuInfo items={[{ label: 'B', value: '2' }, { label: 'A', value: '1' }]} />);

        const items = within(screen.getByRole('list', { name: 'Deployment information' })).getAllByRole('listitem');
        expect(items.map((li) => li.textContent)).toEqual(['B2', 'A1']);
    });
});
