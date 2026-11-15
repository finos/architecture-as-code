import { useCallback, useState } from 'react';
import { useUserAccess } from '../../../admin/context/UserAccessContext.js';

export type EditScope = 'all' | 'editable';

/** Shared by the desktop rail and the mobile menu, so the choice follows the user between them. */
const EDIT_SCOPE_STORAGE_KEY = 'calmHub.editScope';

function readScope(storage: Storage): EditScope {
    try {
        return storage.getItem(EDIT_SCOPE_STORAGE_KEY) === 'editable' ? 'editable' : 'all';
    } catch {
        return 'all';
    }
}

export interface EditScopeState {
    scope: EditScope;
    setScope: (scope: EditScope) => void;
    /** False while access loads, for a user with no grants, and for a global admin (who can edit everything). */
    showScopeControl: boolean;
    editableOnly: boolean;
    /** Pass to `useNamespaceTree`; undefined when every namespace is in scope. */
    canEditNamespace?: (namespace: string) => boolean;
    /** True for a row shown only as the parent of an editable namespace. */
    isContextOnly: (namespace: string) => boolean;
    /** The domains in scope, in their original order. */
    filterDomains: <T>(items: T[], domainOf: (item: T) => string) => T[];
}

export function useEditScope(storage: Storage = localStorage): EditScopeState {
    const [scope, setScopeState] = useState<EditScope>(() => readScope(storage));
    const { grants, loading, isGlobalAdmin, canWriteNamespace, canWriteDomain } = useUserAccess();
    // With auth off the hub reports a synthetic GLOBAL admin grant, so this also hides the control in no-auth mode.
    const showScopeControl = !loading && grants.length > 0 && !isGlobalAdmin;
    const editableOnly = showScopeControl && scope === 'editable';

    const setScope = useCallback(
        (next: EditScope) => {
            setScopeState(next);
            try {
                storage.setItem(EDIT_SCOPE_STORAGE_KEY, next);
            } catch {
                /* ignore unavailable storage */
            }
        },
        [storage]
    );

    return {
        scope,
        setScope,
        showScopeControl,
        editableOnly,
        canEditNamespace: editableOnly ? canWriteNamespace : undefined,
        isContextOnly: (namespace) => editableOnly && !canWriteNamespace(namespace),
        filterDomains: (items, domainOf) => (editableOnly ? items.filter((item) => canWriteDomain(domainOf(item))) : items),
    };
}
