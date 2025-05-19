import React from 'react';
import ReactDOM from 'react-dom/client';
import ProtectedRoute from './ProtectedRoute.js';
import './index.css';
import { authService } from './authService.js';
import App from './App.js';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

const LogoutButton: React.FC = () => {
    const handleLogout = async () => {
        await authService.logout();
    };

    return (
        <button onClick={handleLogout} style={{ position: 'absolute', top: 10, right: 10 }}>
            Logout
        </button>
    );
};

const isHttps = window.location.protocol === 'https:';

root.render(
    <React.StrictMode>
        {isHttps ? (
            <ProtectedRoute>
                <App />
                <LogoutButton />
            </ProtectedRoute>
        ) : (
            <App />
        )}
    </React.StrictMode>
);
