import { useState } from 'react';
import { useUserAccess } from '../../../admin/context/UserAccessContext.js';
import type { EditScope } from './EditScopeToggle.js';

export interface EditScopeState {
    scope: EditScope;
    setScope: (scope: EditScope) => void;
    /** False while access loads, for a user with no grants, and for a global admin (who can edit everything). */
    showScopeToggle: boolean;
    editableOnly: boolean;
    /** Pass to `useNamespaceTree`; undefined when every namespace is in scope. */
    canEditNamespace?: (namespace: string) => boolean;
    /** True for a row shown only as the parent of an editable namespace. */
    isContextOnly: (namespace: string) => boolean;
    /** The domains in scope, in their original order. */
    filterDomains: <T>(items: T[], domainOf: (item: T) => string) => T[];
}

export function useEditScope(): EditScopeState {
    const [scope, setScope] = useState<EditScope>('all');
    const { grants, loading, isGlobalAdmin, canWriteNamespace, canWriteDomain } = useUserAccess();
    // With auth off the hub reports a synthetic GLOBAL admin grant, so this also hides the control in no-auth mode.
    const showScopeToggle = !loading && grants.length > 0 && !isGlobalAdmin;
    const editableOnly = showScopeToggle && scope === 'editable';

    return {
        scope,
        setScope,
        showScopeToggle,
        editableOnly,
        canEditNamespace: editableOnly ? canWriteNamespace : undefined,
        isContextOnly: (namespace) => editableOnly && !canWriteNamespace(namespace),
        filterDomains: (items, domainOf) => (editableOnly ? items.filter((item) => canWriteDomain(domainOf(item))) : items),
    };
}
