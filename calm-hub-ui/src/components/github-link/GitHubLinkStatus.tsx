import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../../authService.js';
import { isGitHubLinkingEnabled } from '../../authConfig.js';

interface LinkStatus {
    linked: boolean;
    username?: string;
}

export const GitHubLinkStatus: React.FC = () => {
    const [status, setStatus] = useState<LinkStatus>({ linked: false });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isGitHubLinkingEnabled()) {
            setLoading(false);
            return;
        }

        const checkStatus = async () => {
            try {
                const headers = await getAuthHeaders();
                const response = await axios.get<LinkStatus>('/api/calm/github/status', { headers });
                setStatus(response.data);
            } catch (error) {
                console.error('Failed to check GitHub link status:', error);
            } finally {
                setLoading(false);
            }
        };

        checkStatus();
    }, []);

    if (!isGitHubLinkingEnabled() || loading) {
        return null;
    }

    if (status.linked) {
        return (
            <div className="flex items-center gap-2 text-sm text-success">
                <span>GitHub: {status.username}</span>
            </div>
        );
    }

    const handleLink = async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await axios.get('/api/calm/github/link', { headers });
            if (response.data?.authorizeUrl) {
                window.location.href = response.data.authorizeUrl;
            }
        } catch (error) {
            console.error('Failed to initiate GitHub link:', error);
        }
    };

    return (
        <button
            onClick={handleLink}
            className="btn btn-sm btn-outline btn-primary"
        >
            Link GitHub Account
        </button>
    );
};
