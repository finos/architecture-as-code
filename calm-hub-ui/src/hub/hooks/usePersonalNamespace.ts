import { useCallback, useEffect, useMemo, useState } from 'react';
import { PersonalNamespaceState } from '../../model/personal-namespace.js';
import { PersonalNamespaceService } from '../../service/personal-namespace-service.js';

export interface PersonalNamespaceControl {
    state: PersonalNamespaceState;
    creating: boolean;
    createFailed: boolean;
    create: () => Promise<boolean>;
}

/** Loads the caller's personal namespace once. `create` resolves true when the caller now owns it. */
export function usePersonalNamespace(): PersonalNamespaceControl {
    const service = useMemo(() => new PersonalNamespaceService(), []);
    const [state, setState] = useState<PersonalNamespaceState>({ status: 'loading' });
    const [creating, setCreating] = useState(false);
    const [createFailed, setCreateFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        service
            .fetchPersonalNamespace()
            .catch((): PersonalNamespaceState => ({ status: 'unavailable' }))
            .then((next) => {
                if (!cancelled) setState(next);
            });
        return () => {
            cancelled = true;
        };
    }, [service]);

    const create = useCallback(async () => {
        setCreating(true);
        setCreateFailed(false);
        try {
            const next = await service.createPersonalNamespace();
            setState(next);
            return next.status === 'owned';
        } catch {
            setCreateFailed(true);
            return false;
        } finally {
            setCreating(false);
        }
    }, [service]);

    return { state, creating, createFailed, create };
}
