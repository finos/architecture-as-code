import { useSyncExternalStore } from 'react';
import { authStore, AuthErrorStatus } from './auth-store.js';

function subscribeToAuthStore(onStoreChange: () => void): () => void {
    return authStore.subscribe(() => onStoreChange());
}

function getAuthErrorSnapshot(): AuthErrorStatus {
    return authStore.getAuthError();
}

export function useAuthError(): AuthErrorStatus {
    return useSyncExternalStore(subscribeToAuthStore, getAuthErrorSnapshot);
}
