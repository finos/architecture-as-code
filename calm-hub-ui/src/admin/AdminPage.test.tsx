import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { AdminPage } from './AdminPage.js';

function renderLayout(initialPath = '/admin/entitlements') {
    return render(
        <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
                <Route path="/admin" element={<AdminPage />}>
                    <Route path="namespaces" element={<div>Namespaces panel</div>} />
                    <Route path="domains" element={<div>Domains panel</div>} />
                    <Route path="entitlements" element={<div>Entitlements panel</div>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

describe('AdminPage (layout)', () => {
    it('renders all three sidebar navigation links', () => {
        renderLayout();
        expect(screen.getByRole('link', { name: /namespaces/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /domains/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /entitlements/i })).toBeInTheDocument();
    });

    it('renders the active panel via Outlet', () => {
        renderLayout('/admin/namespaces');
        expect(screen.getByText('Namespaces panel')).toBeInTheDocument();
    });

    it('renders the entitlements panel when at that sub-route', () => {
        renderLayout('/admin/entitlements');
        expect(screen.getByText('Entitlements panel')).toBeInTheDocument();
    });

    it('renders the domains panel when at that sub-route', () => {
        renderLayout('/admin/domains');
        expect(screen.getByText('Domains panel')).toBeInTheDocument();
    });
});
