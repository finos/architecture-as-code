import { lazy, Suspense } from 'react';
import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Hub from './hub/Hub.js';
import { AdminPage } from './admin/AdminPage.js';
import { UserAccessProvider } from './admin/context/UserAccessContext.js';

// Lazy: AdminPage itself (the entitlement gate + nav shell) stays eager so
// the "you do not have permission" check never waits on a chunk fetch. Only
// the panels behind that gate — reached exclusively by admins — are deferred.
const AdminPanels = lazy(() => import('./admin/AdminPanels.js'));

function adminPanel(view: 'namespaces' | 'domains' | 'entitlements') {
    return (
        <Suspense
            fallback={
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg" aria-label="Loading" />
                </div>
            }
        >
            <AdminPanels view={view} />
        </Suspense>
    );
}

function App() {
    //TODO: The artifacts route will eventually need to be changed/replaced once we create a unique identifier for resources that can be used across CalmHubs.
    //When this happens the logic to handle params in TreeNavigation will also have to be updated.
    //Currently the format of the route allows deeplinks to only be used within a single CalmHub.
    return (
        <UserAccessProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Hub />} />
                    <Route path="/search" element={<Hub />} />
                    {/* The standalone /visualizer page was removed; redirect old links to the hub. */}
                    <Route path="/visualizer" element={<Navigate to="/" replace />} />
                    <Route path="/namespace/:ns" element={<Hub />} />
                    <Route path="/domain/:domain" element={<Hub />} />
                    {/* Landing page for malformed detailed-architecture refs; the
                        broken ref itself travels in history state (brokenRef). */}
                    <Route path="/broken-reference" element={<Hub />} />
                    <Route path="/:namespace/:type/:id/:version" element={<Hub />} />
                    <Route path="/admin" element={<AdminPage />}>
                        <Route index element={<Navigate to="entitlements" replace />} />
                        <Route path="namespaces" element={adminPanel('namespaces')} />
                        <Route path="domains" element={adminPanel('domains')} />
                        <Route path="entitlements" element={adminPanel('entitlements')} />
                    </Route>
                </Routes>
            </Router>
        </UserAccessProvider>
    );
}

export default App;
