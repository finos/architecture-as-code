import { useSyncExternalStore } from 'react';
import { authStore, AuthErrorStatus } from './auth-store.js';

export function useAuthError(): AuthErrorStatus {
    return useSyncExternalStore(
        (onStoreChange) => authStore.subscribe(() => onStoreChange()),
        () => authStore.getAuthError()
    );
}
