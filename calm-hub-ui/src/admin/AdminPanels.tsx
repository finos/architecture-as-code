import { Navigate, Route, Routes } from 'react-router-dom';
import { NamespacesPanel } from './panels/NamespacesPanel.js';
import { DomainsPanel } from './panels/DomainsPanel.js';
import { EntitlementsPanel } from './panels/EntitlementsPanel.js';

// Lazy-loaded as a unit from App.tsx (see the `/admin/*` route) so non-admin
// users never fetch this chunk. Kept as one component + one internal <Routes>
// rather than splitting per-panel, so switching between admin tabs never
// triggers its own extra chunk fetch/loading flash.
export default function AdminPanels() {
    return (
        <Routes>
            <Route index element={<Navigate to="/admin/entitlements" replace />} />
            <Route path="namespaces" element={<NamespacesPanel />} />
            <Route path="domains" element={<DomainsPanel />} />
            <Route path="entitlements" element={<EntitlementsPanel />} />
        </Routes>
    );
}
