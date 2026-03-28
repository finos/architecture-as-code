import { render, screen } from '@testing-library/react';
import { ReadableJsonView } from './ReadableJsonView.js';
import { describe, it, expect } from 'vitest';

describe('ReadableJsonView', () => {
    it('shows placeholder text when json is undefined', () => {
        render(<ReadableJsonView />);
        expect(screen.getByText('Please select a document to load.')).toBeInTheDocument();
    });

    it('renders a simple key-value object as a table', () => {
        const json = { name: 'test', count: 42 };
        render(<ReadableJsonView json={json} />);

        expect(screen.getByText('name')).toBeInTheDocument();
        expect(screen.getByText('test')).toBeInTheDocument();
        expect(screen.getByText('count')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders boolean values as badges', () => {
        const json = { enabled: true, disabled: false };
        render(<ReadableJsonView json={json} />);

        expect(screen.getByText('true')).toHaveClass('badge');
        expect(screen.getByText('false')).toHaveClass('badge');
    });

    it('renders null values with italic text', () => {
        const json = { empty: null };
        render(<ReadableJsonView json={json} />);

        expect(screen.getByText('null')).toBeInTheDocument();
    });

    it('renders nested objects recursively', () => {
        const json = { outer: { inner: 'value' } };
        render(<ReadableJsonView json={json} />);

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.getByText('inner')).toBeInTheDocument();
        expect(screen.getByText('value')).toBeInTheDocument();
    });

    it('renders arrays as lists', () => {
        const json = { items: ['a', 'b', 'c'] };
        render(<ReadableJsonView json={json} />);

        expect(screen.getByText('items')).toBeInTheDocument();
        expect(screen.getByText('a')).toBeInTheDocument();
        expect(screen.getByText('b')).toBeInTheDocument();
        expect(screen.getByText('c')).toBeInTheDocument();
    });

    it('renders empty arrays with placeholder text', () => {
        const json = { items: [] };
        render(<ReadableJsonView json={json} />);

        expect(screen.getByText('empty list')).toBeInTheDocument();
    });

    it('renders empty objects with placeholder text', () => {
        const json = { config: {} };
        render(<ReadableJsonView json={json} />);

        expect(screen.getByText('empty object')).toBeInTheDocument();
    });

    it('has the readable-json-view test id', () => {
        const json = { key: 'value' };
        render(<ReadableJsonView json={json} />);

        expect(screen.getByTestId('readable-json-view')).toBeInTheDocument();
    });
});
