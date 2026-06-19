import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserAccess, UserAccessRequest } from '../../../model/user-access.js';
import { UserAccessService } from '../../../service/user-access-service.js';
import { GrantRow } from '../namespace-access/GrantRow.js';
import { AddGrantForm } from '../namespace-access/AddGrantForm.js';

interface DomainAccessPanelProps {
    domain: string;
    service?: UserAccessService;
}

export function DomainAccessPanel({ domain, service }: DomainAccessPanelProps) {
    const svc = useMemo(() => service ?? new UserAccessService(), [service]);
    const [grants, setGrants] = useState<UserAccess[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [pendingRevoke, setPendingRevoke] = useState<UserAccess | null>(null);
    const [revoking, setRevoking] = useState(false);

    const fetchGrants = useCallback(() => {
        setLoading(true);
        setFetchError(null);
        svc.getDomainUserAccess(domain)
            .then(setGrants)
            .catch(() => setFetchError('Failed to load access grants.'))
            .finally(() => setLoading(false));
    }, [svc, domain]);

    useEffect(() => { fetchGrants(); }, [fetchGrants]);

    function handleRequestRevoke(grant: UserAccess) {
        setPendingRevoke(grant);
    }

    async function handleConfirmRevoke() {
        if (!pendingRevoke) return;
        setRevoking(true);
        try {
            await svc.revokeDomainAccess(domain, pendingRevoke.userAccessId);
            setGrants((prev) => prev.filter((g) => g.userAccessId !== pendingRevoke.userAccessId));
            setPendingRevoke(null);
        } catch {
            // leave dialog open so user can retry or cancel
        } finally {
            setRevoking(false);
        }
    }

    function handleCancelRevoke() {
        setPendingRevoke(null);
    }

    async function handleGrantAccess(request: UserAccessRequest) {
        await svc.grantDomainAccess(domain, request);
        fetchGrants();
    }

    const revokeTarget = pendingRevoke?.username === '*' ? '* (everyone)' : pendingRevoke?.username;

    return (
        <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body gap-4">
                <h3 className="card-title text-base">{domain}</h3>

                {loading && <span className="loading loading-spinner loading-sm" aria-label="Loading grants" />}

                {fetchError && (
                    <div className="alert alert-error alert-sm" role="alert">
                        <span>{fetchError}</span>
                    </div>
                )}

                {!loading && !fetchError && (
                    <div className="overflow-x-auto">
                        <table className="table table-sm">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Permission</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {grants.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="text-center text-base-content/50 italic text-sm">
                                            No access grants
                                        </td>
                                    </tr>
                                ) : (
                                    grants.map((grant) => (
                                        <GrantRow
                                            key={grant.userAccessId}
                                            grant={grant}
                                            onRequestRevoke={handleRequestRevoke}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="divider my-0" />
                <AddGrantForm onSubmit={handleGrantAccess} />
            </div>

            {pendingRevoke && (
                <dialog open className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">Confirm revoke</h3>
                        <p className="py-4">
                            Remove <span className="font-mono font-semibold">{revokeTarget}</span>'s{' '}
                            <span className="font-semibold">{pendingRevoke.permission}</span> access on{' '}
                            <span className="font-semibold">{domain}</span>?
                        </p>
                        <div className="modal-action">
                            <button
                                className="btn btn-error"
                                onClick={handleConfirmRevoke}
                                disabled={revoking}
                            >
                                {revoking ? 'Revoking…' : 'Revoke'}
                            </button>
                            <button
                                className="btn btn-ghost"
                                onClick={handleCancelRevoke}
                                disabled={revoking}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                    <form method="dialog" className="modal-backdrop">
                        <button onClick={handleCancelRevoke}>close</button>
                    </form>
                </dialog>
            )}
        </div>
    );
}
