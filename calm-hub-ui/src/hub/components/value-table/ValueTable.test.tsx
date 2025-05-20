import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ValueTable } from './ValueTable.js';

describe('ValueTable', () => {
    const header = 'Test Header';
    const values = ['Value 1', 'Value 2', 'Value 3'];

    it('renders the header', () => {
        render(
            <ValueTable
                header={header}
                values={values}
                callback={() => {}}
                currentValue={undefined}
            />
        );
        expect(screen.getByText(header)).toBeInTheDocument();
    });

    it('renders all values', () => {
        render(
            <ValueTable
                header={header}
                values={values}
                callback={() => {}}
                currentValue={undefined}
            />
        );
        values.forEach((value) => {
            expect(screen.getByText(value)).toBeInTheDocument();
        });
    });

    it('calls callback with correct value when a value is clicked', () => {
        const callback = vi.fn();
        render(
            <ValueTable
                header={header}
                values={values}
                callback={callback}
                currentValue={undefined}
            />
        );
        fireEvent.click(screen.getByText('Value 2'));
        expect(callback).toHaveBeenCalledWith('Value 2');
    });

    it('applies selected style to the currentValue', () => {
        render(
            <ValueTable
                header={header}
                values={values}
                callback={() => {}}
                currentValue="Value 3"
            />
        );
        const selected = screen.getByText('Value 3');
        expect(selected.className).toContain('bg-[#eee]');
    });

    it('does not apply selected style to non-current values', () => {
        render(
            <ValueTable
                header={header}
                values={values}
                callback={() => {}}
                currentValue="Value 1"
            />
        );
        const notSelected = screen.getByText('Value 2');
        expect(notSelected.className).not.toContain('bg-[#eee]');
    });

    it('renders nothing if values array is empty', () => {
        render(
            <ValueTable header={header} values={[]} callback={() => {}} currentValue={undefined} />
        );
        expect(screen.queryByText('Value 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Value 2')).not.toBeInTheDocument();
        expect(screen.queryByText('Value 3')).not.toBeInTheDocument();
    });
});
