import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Hub from './hub/Hub.js';
import { AdminPage } from './admin/AdminPage.js';
import { NamespacesPanel } from './admin/panels/NamespacesPanel.js';
import { DomainsPanel } from './admin/panels/DomainsPanel.js';
import { EntitlementsPanel } from './admin/panels/EntitlementsPanel.js';
import { UserAccessProvider } from './admin/context/UserAccessContext.js';

function App() {
    //TODO: The artifacts route will eventually need to be changed/replaced once we create a unique identifier for resources that can be used across CalmHubs.
    //When this happens the logic to handle params in TreeNavigation will also have to be updated.
    //Currently the format of the route allows deeplinks to only be used within a single CalmHub.
    return (
        <UserAccessProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Hub />} />
                    {/* The standalone /visualizer page was removed; redirect old links to the hub. */}
                    <Route path="/visualizer" element={<Navigate to="/" replace />} />
                    <Route path="/namespace/:ns" element={<Hub />} />
                    <Route path="/domain/:domain" element={<Hub />} />
                    <Route path="/:namespace/:type/:id/:version" element={<Hub />} />
                    <Route path="/admin" element={<AdminPage />}>
                        <Route index element={<Navigate to="entitlements" replace />} />
                        <Route path="namespaces" element={<NamespacesPanel />} />
                        <Route path="domains" element={<DomainsPanel />} />
                        <Route path="entitlements" element={<EntitlementsPanel />} />
                    </Route>
                </Routes>
            </Router>
        </UserAccessProvider>
    );
}

export default App;
