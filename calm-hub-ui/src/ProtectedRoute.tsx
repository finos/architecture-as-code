import React, { ReactNode, useEffect, useState } from 'react';
import { User } from 'oidc-client-ts';
import { authService } from './authService.js';

interface ProtectedRouteProps {
    children: ReactNode;
}

const PRE_AUTH_HASH_KEY = 'calm_pre_auth_hash';

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const authenticate = async () => {
            const currentUser = await authService.getUser();
            if (currentUser && !currentUser.expired) {
                setUser(currentUser);
            } else if (window.location.search.includes('code=')) {
                const loggedInUser = await authService.processRedirect();
                const savedHash = sessionStorage.getItem(PRE_AUTH_HASH_KEY);
                sessionStorage.removeItem(PRE_AUTH_HASH_KEY);
                if (savedHash && savedHash !== '#' && savedHash !== '#/') {
                    window.history.replaceState(null, '', window.location.pathname + savedHash);
                } else {
                    window.history.replaceState(null, '', window.location.pathname + '#/');
                }
                setUser(loggedInUser);
            } else {
                if (window.location.hash) {
                    sessionStorage.setItem(PRE_AUTH_HASH_KEY, window.location.hash);
                }
                await authService.login();
            }
            setLoading(false);
        };

        authenticate();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        return <div>Redirecting to login...</div>;
    }

    return <>{children}</>;
};
export default ProtectedRoute;
