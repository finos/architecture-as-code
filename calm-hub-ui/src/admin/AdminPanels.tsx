import { NamespacesPanel } from './panels/NamespacesPanel.js';
import { DomainsPanel } from './panels/DomainsPanel.js';
import { EntitlementsPanel } from './panels/EntitlementsPanel.js';

type AdminPanelView = 'namespaces' | 'domains' | 'entitlements';

// Lazy-loaded from App.tsx (one lazy() call reused across the three /admin/*
// routes) so non-admin users never fetch this chunk. `lazy()` caches the
// resolved module, so switching tabs after the first load never re-fetches
// or re-suspends.
export default function AdminPanels({ view }: { view: AdminPanelView }) {
    switch (view) {
        case 'namespaces':
            return <NamespacesPanel />;
        case 'domains':
            return <DomainsPanel />;
        case 'entitlements':
            return <EntitlementsPanel />;
    }
}
