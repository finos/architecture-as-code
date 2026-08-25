import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserAccess } from '../../model/user-access.js';
import { UserAccessService } from '../../service/user-access-service.js';

const GLOBAL_NAMESPACE = 'GLOBAL';

export interface CurrentUserAccessState {
    grants: UserAccess[];
    loading: boolean;
    error: string | null;
    isGlobalAdmin: boolean;
    canAdminNamespace: (namespace: string) => boolean;
    canWriteNamespace: (namespace: string) => boolean;
}

export function useCurrentUserAccess(service?: UserAccessService): CurrentUserAccessState {
    const [grants, setGrants] = useState<UserAccess[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const svc = useMemo(() => service ?? new UserAccessService(), [service]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        svc.getCurrentUserAccess()
            .then(setGrants)
            .catch(() => setError('Failed to load your access permissions.'))
            .finally(() => setLoading(false));
    }, [svc]);

    const isGlobalAdmin = useMemo(
        () => grants.some(
            (g) => g.namespace === GLOBAL_NAMESPACE && g.permission === 'admin' && g.username !== '*'
        ),
        [grants]
    );

    const canAdminNamespace = useCallback(
        (namespace: string) =>
            isGlobalAdmin ||
            grants.some(
                (g) =>
                    g.permission === 'admin' &&
                    g.namespace != null &&
                    // OR across ancestors: admin on 'org' covers 'org', 'org.ab', 'org.ab.cd', etc.
                    (namespace === g.namespace || namespace.startsWith(g.namespace + '.'))
            ),
        [grants, isGlobalAdmin]
    );

    // Mirrors CalmHubPermissionChecker.canWrite: a grant of 'write' OR 'admin'
    // satisfies WRITE, and non-READ actions are OR'd across the ancestor chain
    // (an ancestor namespace's grant covers its descendants). This check is
    // purely cosmetic — it only decides whether to offer a button that would
    // otherwise 403; @PermissionsAllowed(WRITE) on the resource is the real gate.
    const canWriteNamespace = useCallback(
        (namespace: string) =>
            isGlobalAdmin ||
            grants.some(
                (g) =>
                    (g.permission === 'write' || g.permission === 'admin') &&
                    g.namespace != null &&
                    (namespace === g.namespace || namespace.startsWith(g.namespace + '.'))
            ),
        [grants, isGlobalAdmin]
    );

    return { grants, loading, error, isGlobalAdmin, canAdminNamespace, canWriteNamespace };
}
