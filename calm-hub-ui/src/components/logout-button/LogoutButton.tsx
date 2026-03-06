import React from 'react';
import { authService } from '../../authService.js';

export const LogoutButton: React.FC = () => {
    const handleLogout = async () => {
        await authService.logout();
    };

    return (
        <button onClick={handleLogout} style={{ position: 'absolute', top: 10, right: 10 }}>
            Logout
        </button>
    );
};
