export type AuthErrorStatus = 401 | 403 | null;
type Listener = (status: AuthErrorStatus) => void;

export class AuthStore {
    private status: AuthErrorStatus = null;
    private listeners = new Set<Listener>();

    setAuthError(status: AuthErrorStatus) {
        this.status = status;
        this.listeners.forEach((l) => l(status));
    }

    getAuthError(): AuthErrorStatus {
        return this.status;
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}

export const authStore = new AuthStore();