import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DecoratorValue } from './DecoratorValue.js';

describe('DecoratorValue', () => {
    it('renders an http(s) URL as a link that opens in a new tab', () => {
        render(<DecoratorValue value="https://grafana.example.com/d/abc" />);
        const link = screen.getByRole('link', { name: 'https://grafana.example.com/d/abc' });
        expect(link).toHaveAttribute('href', 'https://grafana.example.com/d/abc');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('does not render a javascript: value as a link', () => {
        render(<DecoratorValue value="javascript:alert(1)" />);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument();
    });

    it('renders a date as a time element that keeps the original value', () => {
        const { container } = render(<DecoratorValue value="2026-03-01T10:15:00Z" />);
        const time = container.querySelector('time');
        expect(time).toHaveAttribute('dateTime', '2026-03-01T10:15:00Z');
        expect(time).toHaveAttribute('title', '2026-03-01T10:15:00Z');
    });

    it('renders numbers, booleans and null', () => {
        render(<DecoratorValue value={{ replicas: 3, ready: false, owner: null }} />);
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('false')).toBeInTheDocument();
        expect(screen.getByText('null')).toBeInTheDocument();
    });

    it('renders an object as key-value pairs', () => {
        render(<DecoratorValue value={{ status: 'completed', notes: 'ok' }} />);
        expect(screen.getByText('status')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
        expect(screen.getByText('notes')).toBeInTheDocument();
    });

    it('renders an array of primitives as a list', () => {
        render(<DecoratorValue value={['eu-west-1', 'us-east-1']} />);
        const items = within(screen.getByRole('list')).getAllByRole('listitem');
        expect(items.map((item) => item.textContent)).toEqual(['eu-west-1', 'us-east-1']);
    });

    it('renders an array of flat objects as a table', () => {
        render(<DecoratorValue value={[{ name: 'api', port: 8080 }, { name: 'db', tls: true }]} />);
        const table = screen.getByRole('table');
        expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['name', 'port', 'tls']);
        const rows = within(table).getAllByRole('row');
        expect(rows).toHaveLength(3);
        expect(within(rows[1]).getAllByRole('cell').map((td) => td.textContent)).toEqual(['api', '8080', '']);
        expect(within(rows[2]).getAllByRole('cell').map((td) => td.textContent)).toEqual(['db', '', 'true']);
    });

    it('leaves a cell empty when only the prototype has the column name', () => {
        render(<DecoratorValue value={[{ name: 'api', toString: 'own' }, { name: 'db' }]} />);
        const rows = within(screen.getByRole('table')).getAllByRole('row');
        expect(within(rows[1]).getAllByRole('cell').map((td) => td.textContent)).toEqual(['api', 'own']);
        expect(within(rows[2]).getAllByRole('cell').map((td) => td.textContent)).toEqual(['db', '']);
    });

    it('renders nesting as collapsible branches, open at the first level and closed below', () => {
        const { container } = render(
            <DecoratorValue value={{ kubernetes: { cluster: 'prod', resources: { pods: ['a', 'b'] } } }} />
        );
        const branches = container.querySelectorAll('details');
        expect(branches).toHaveLength(3);
        expect(branches[0]).toHaveAttribute('open');
        expect(branches[0].querySelector('summary')).toHaveTextContent('kubernetes · 2 fields');
        expect(branches[1]).not.toHaveAttribute('open');
        expect(branches[1].querySelector('summary')).toHaveTextContent('resources · 1 field');
        expect(branches[2]).not.toHaveAttribute('open');
        expect(branches[2].querySelector('summary')).toHaveTextContent('pods · 2 items');
    });

    it('labels the items of a mixed array', () => {
        const { container } = render(<DecoratorValue value={['first', { name: 'second', spec: { replicas: 1 } }]} />);
        expect(screen.getByText('first')).toBeInTheDocument();
        expect(container.querySelector('summary')).toHaveTextContent('Item 2');
    });

    it('says so for an empty array or object', () => {
        const { rerender } = render(<DecoratorValue value={[]} />);
        expect(screen.getByText('Empty list')).toBeInTheDocument();
        rerender(<DecoratorValue value={{}} />);
        expect(screen.getByText('No fields')).toBeInTheDocument();
    });

    it('renders an empty nested value inline, not as a branch', () => {
        const { container } = render(<DecoratorValue value={{ tags: [] }} />);
        expect(container.querySelector('details')).toBeNull();
        expect(screen.getByText('Empty list')).toBeInTheDocument();
    });
});
