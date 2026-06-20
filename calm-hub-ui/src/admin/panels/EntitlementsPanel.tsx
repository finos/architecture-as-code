import { useEffect, useMemo, useState } from 'react';
import { CalmService } from '../../service/calm-service.js';
import { UserAccessService } from '../../service/user-access-service.js';
import { useCurrentUserAccess } from '../hooks/useCurrentUserAccess.js';
import { NamespaceAccessPanel } from '../components/namespace-access/NamespaceAccessPanel.js';
import { DomainAccessPanel } from '../components/domain-access/DomainAccessPanel.js';

interface EntitlementsPanelProps {
    calmService?: CalmService;
    userAccessService?: UserAccessService;
}

export function EntitlementsPanel({ calmService, userAccessService }: EntitlementsPanelProps) {
    const calmSvc = useMemo(() => calmService ?? new CalmService(), [calmService]);
    const userAccessSvc = useMemo(() => userAccessService ?? new UserAccessService(), [userAccessService]);

    const [namespaces, setNamespaces] = useState<string[]>([]);
    const [namespacesLoading, setNamespacesLoading] = useState(true);
    const [namespacesError, setNamespacesError] = useState<string | null>(null);
    const [selectedNamespace, setSelectedNamespace] = useState<string>('');

    const [domains, setDomains] = useState<string[]>([]);
    const [domainsLoading, setDomainsLoading] = useState(true);
    const [domainsError, setDomainsError] = useState<string | null>(null);
    const [selectedDomain, setSelectedDomain] = useState<string>('');

    const { canAdminNamespace, isGlobalAdmin, loading: accessLoading, error: accessError } =
        useCurrentUserAccess(userAccessSvc);

    useEffect(() => {
        calmSvc.fetchNamespaces()
            .then(setNamespaces)
            .catch(() => setNamespacesError('Failed to load namespaces.'))
            .finally(() => setNamespacesLoading(false));
    }, [calmSvc]);

    useEffect(() => {
        calmSvc.fetchDomains()
            .then((d) => setDomains([...d].sort()))
            .catch(() => setDomainsError('Failed to load domains.'))
            .finally(() => setDomainsLoading(false));
    }, [calmSvc]);

    const loading = namespacesLoading || domainsLoading || accessLoading;
    const adminNamespaces = namespaces.filter(canAdminNamespace).sort();
    const error = namespacesError ?? domainsError ?? accessError;

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Access Management</h1>

            {loading && (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg" aria-label="Loading" />
                </div>
            )}

            {!loading && error && (
                <div className="alert alert-error mb-4" role="alert">
                    <span>{error}</span>
                </div>
            )}

            {!loading && !error && adminNamespaces.length === 0 && (
                <div className="alert alert-info" role="status">
                    <span>You have no admin access to any namespaces.</span>
                </div>
            )}

            {!loading && adminNamespaces.length > 0 && (
                <div className="flex flex-col gap-6">
                    <section aria-label="Namespace access">
                        <h2 className="text-lg font-semibold mb-3">Namespace Access</h2>
                        <select
                            className="select select-bordered select-sm w-full max-w-xs mb-4"
                            value={selectedNamespace}
                            onChange={(e) => setSelectedNamespace(e.target.value)}
                            aria-label="Select namespace"
                        >
                            <option value="">Select a namespace…</option>
                            {adminNamespaces.map((ns) => (
                                <option key={ns} value={ns}>{ns}</option>
                            ))}
                        </select>
                        {selectedNamespace && (
                            <NamespaceAccessPanel
                                key={selectedNamespace}
                                namespace={selectedNamespace}
                                service={userAccessSvc}
                            />
                        )}
                    </section>

                    {isGlobalAdmin && (
                        <section aria-label="Global admin access">
                            <h2 className="text-lg font-semibold mb-3">Global Admin Access</h2>
                            <NamespaceAccessPanel
                                namespace="GLOBAL"
                                service={userAccessSvc}
                            />
                        </section>
                    )}

                    {isGlobalAdmin && (
                        <section aria-label="Domain access">
                            <h2 className="text-lg font-semibold mb-3">Domain Access</h2>
                            {domains.length === 0 ? (
                                <p className="text-base-content/50 text-sm italic">No domains found.</p>
                            ) : (
                                <>
                                    <select
                                        className="select select-bordered select-sm w-full max-w-xs mb-4"
                                        value={selectedDomain}
                                        onChange={(e) => setSelectedDomain(e.target.value)}
                                        aria-label="Select domain"
                                    >
                                        <option value="">Select a domain…</option>
                                        {domains.map((domain) => (
                                            <option key={domain} value={domain}>{domain}</option>
                                        ))}
                                    </select>
                                    {selectedDomain && (
                                        <DomainAccessPanel
                                            key={selectedDomain}
                                            domain={selectedDomain}
                                            service={userAccessSvc}
                                        />
                                    )}
                                </>
                            )}
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
