import { useEffect, useState } from 'react';
import { authStore, AuthErrorStatus } from './auth-store.js';

export function useAuthError(): AuthErrorStatus {
    const [status, setStatus] = useState<AuthErrorStatus>(authStore.getAuthError());
    useEffect(() => {
        return authStore.subscribe(setStatus);
    }, []);
    return status;
}