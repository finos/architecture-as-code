import { IoWarningOutline, IoLockClosedOutline } from 'react-icons/io5';
import { authService, isAuthServiceEnabled } from './authService.js';
import { authStore } from './service/utils/auth-store.js';
import { useAuthError } from './service/utils/use-auth-store.js';

const MESSAGES = {
    401: {
        title: 'Session expired',
        body: 'Your session has expired. Please sign in again.',
    },
    403: {
        title: 'Access denied',
        body: 'You are not authorised to view this resource. Please contact your system administrator to request access.',
    },
} as const;

export function AuthErrorModal() {
    const authError = useAuthError();

    if (!authError) {
        return null;
    }

    const { title, body } = MESSAGES[authError];
    const handleClose = () => authStore.setAuthError(null);
    const handleSignIn = async () => {
        authStore.setAuthError(null);
        await authService.login();
    };

    return (
        <dialog className="modal modal-open" open>
            <div className="modal-box">
                <div className="flex items-center gap-3 mb-1">
                    {authError === 401
                        ? <IoWarningOutline className="text-2xl shrink-0 text-warning" aria-hidden />
                        : <IoLockClosedOutline className="text-2xl shrink-0 text-error" aria-hidden />
                    }
                    <h3 className="font-bold text-lg">{title}</h3>
                </div>
                <p className="py-3 text-base-content/70">{body}</p>
                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={handleClose}>
                        Close
                    </button>
                    {authError === 401 && isAuthServiceEnabled() && (
                        <button className="btn btn-primary" onClick={handleSignIn}>
                            Sign in again
                        </button>
                    )}
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={handleClose}>close</button>
            </form>
        </dialog>
    );
}
