import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InterfaceItem } from './InterfaceItem.js';
import { describe, it, expect, vi } from 'vitest';
import { InterfaceDetail } from '../../../model/interface.js';

const sampleInterface: InterfaceDetail = {
    id: 1,
    name: 'Host Port Interface',
    description: 'A standard host and port interface',
};

describe('InterfaceItem', () => {
    it('renders the interface name', () => {
        render(
            <ul>
                <InterfaceItem iface={sampleInterface} isSelected={false} onInterfaceClick={vi.fn()} />
            </ul>
        );
        expect(screen.getByText('Host Port Interface')).toBeInTheDocument();
    });

    it('applies active class when selected', () => {
        render(
            <ul>
                <InterfaceItem iface={sampleInterface} isSelected={true} onInterfaceClick={vi.fn()} />
            </ul>
        );
        expect(screen.getByText('Host Port Interface')).toHaveClass('active');
    });

    it('does not apply active class when not selected', () => {
        render(
            <ul>
                <InterfaceItem iface={sampleInterface} isSelected={false} onInterfaceClick={vi.fn()} />
            </ul>
        );
        expect(screen.getByText('Host Port Interface')).not.toHaveClass('active');
    });

    it('calls onInterfaceClick with the interface when clicked', async () => {
        const handleClick = vi.fn();
        render(
            <ul>
                <InterfaceItem iface={sampleInterface} isSelected={false} onInterfaceClick={handleClick} />
            </ul>
        );
        await userEvent.click(screen.getByText('Host Port Interface'));
        expect(handleClick).toHaveBeenCalledOnce();
        expect(handleClick).toHaveBeenCalledWith(sampleInterface);
    });
});
