import React, { ReactNode, useEffect, useState } from 'react';
import { User } from 'oidc-client-ts';
import { authService } from './authService.js';
import { fetchAuthConfig, isGitHubLinkingEnabled } from './authConfig.js';
import axios from 'axios';

interface ProtectedRouteProps {
    children: ReactNode;
}

const PRE_AUTH_HASH_KEY = 'calm_pre_auth_hash';

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [githubLinked, setGithubLinked] = useState<boolean | null>(null);

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

    useEffect(() => {
        if (!user) {
            setGithubLinked(true);
            return;
        }

        const checkGithubLink = async () => {
            await fetchAuthConfig();
            if (!isGitHubLinkingEnabled()) {
                setGithubLinked(true);
                return;
            }

            try {
                const token = user.id_token || user.access_token;
                const response = await axios.get('/api/calm/github/status', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (response.data.linked) {
                    sessionStorage.removeItem('calm_gh_link_attempted');
                    setGithubLinked(true);
                } else if (sessionStorage.getItem('calm_gh_link_attempted')) {
                    setGithubLinked(true);
                } else {
                    sessionStorage.setItem('calm_gh_link_attempted', 'true');
                    const linkResponse = await axios.get('/api/calm/github/link', {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (linkResponse.data?.authorizeUrl) {
                        window.location.href = linkResponse.data.authorizeUrl;
                    }
                }
            } catch {
                setGithubLinked(true);
            }
        };

        checkGithubLink();
    }, [user]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        return <div>Redirecting to login...</div>;
    }

    if (githubLinked === null) {
        return <div>Checking GitHub link...</div>;
    }

    return <>{children}</>;
};
export default ProtectedRoute;
