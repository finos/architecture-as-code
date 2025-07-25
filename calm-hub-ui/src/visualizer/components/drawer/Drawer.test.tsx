import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Drawer } from './Drawer.js';

describe('Drawer', () => {
    it('should render Drawer', () => {
        render(<Drawer data={undefined} />);
        expect(screen.getByText('No file selected')).toBeInTheDocument();
    });

    it('should render Drawer with Data if defined', () => {
        render(
            <Drawer
                data={{
                    id: 'traderx',
                    version: '0.1',
                    name: 'traderx',
                    data: 'testData',
                    calmType: 'Architectures',
                }}
            />
        );
        expect(screen.getByText('No file selected')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'drawer-toggle' })).not.toBeChecked();
    });
});
