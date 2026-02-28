import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
    const defaultProps = {
        searchTerm: '',
        onSearchChange: vi.fn(),
        typeFilter: '',
        onTypeFilterChange: vi.fn(),
        nodeTypes: ['service', 'database', 'actor'],
    };

    it('renders search input', () => {
        render(<SearchBar {...defaultProps} />);
        expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
    });

    it('displays current search term', () => {
        render(<SearchBar {...defaultProps} searchTerm="test" />);
        expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    });

    it('calls onSearchChange when typing', () => {
        const onSearchChange = vi.fn();
        render(<SearchBar {...defaultProps} onSearchChange={onSearchChange} />);
        fireEvent.change(screen.getByPlaceholderText('Search nodes...'), {
            target: { value: 'service' },
        });
        expect(onSearchChange).toHaveBeenCalledWith('service');
    });

    it('shows clear button when search term is present', () => {
        render(<SearchBar {...defaultProps} searchTerm="test" />);
        expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });

    it('does not show clear button when search term is empty', () => {
        render(<SearchBar {...defaultProps} />);
        expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
    });

    it('calls onSearchChange with empty string when clear is clicked', () => {
        const onSearchChange = vi.fn();
        render(<SearchBar {...defaultProps} searchTerm="test" onSearchChange={onSearchChange} />);
        fireEvent.click(screen.getByLabelText('Clear search'));
        expect(onSearchChange).toHaveBeenCalledWith('');
    });

    it('renders node type dropdown with options', () => {
        render(<SearchBar {...defaultProps} />);
        const select = screen.getByLabelText('Filter by node type');
        expect(select).toBeInTheDocument();
        expect(screen.getByText('All types')).toBeInTheDocument();
        expect(screen.getByText('service')).toBeInTheDocument();
        expect(screen.getByText('database')).toBeInTheDocument();
        expect(screen.getByText('actor')).toBeInTheDocument();
    });

    it('calls onTypeFilterChange when selecting a type', () => {
        const onTypeFilterChange = vi.fn();
        render(<SearchBar {...defaultProps} onTypeFilterChange={onTypeFilterChange} />);
        fireEvent.change(screen.getByLabelText('Filter by node type'), {
            target: { value: 'service' },
        });
        expect(onTypeFilterChange).toHaveBeenCalledWith('service');
    });

    it('does not render dropdown when nodeTypes is empty', () => {
        render(<SearchBar {...defaultProps} nodeTypes={[]} />);
        expect(screen.queryByLabelText('Filter by node type')).not.toBeInTheDocument();
    });
});
