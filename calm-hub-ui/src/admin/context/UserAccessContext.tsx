import { createContext, useContext, ReactNode } from 'react';
import { CurrentUserAccessState, useCurrentUserAccess } from '../hooks/useCurrentUserAccess.js';
import { UserAccessService } from '../../service/user-access-service.js';

const defaultState: CurrentUserAccessState = {
    grants: [],
    loading: true,
    error: null,
    isGlobalAdmin: false,
    canAdminNamespace: () => false,
};

export const UserAccessContext = createContext<CurrentUserAccessState>(defaultState);

export function UserAccessProvider({
    children,
    service,
}: {
    children: ReactNode;
    service?: UserAccessService;
}) {
    const state = useCurrentUserAccess(service);
    return <UserAccessContext.Provider value={state}>{children}</UserAccessContext.Provider>;
}

export function useUserAccess(): CurrentUserAccessState {
    return useContext(UserAccessContext);
}
