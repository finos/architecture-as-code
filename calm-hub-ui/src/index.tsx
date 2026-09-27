import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import ProtectedRoute from './ProtectedRoute.js';
import { initAuthService, isAuthServiceEnabled } from './authService.js';
import App from './App.js';
import { AuthErrorModal } from './AuthModalError.js';
import { MigrationErrorModal } from './MigrationModalError.js';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

async function bootstrap() {
    await initAuthService();

    const isAuthenticationEnabled = isAuthServiceEnabled();

    root.render(
        <React.StrictMode>
            {isAuthenticationEnabled ? (
                <ProtectedRoute>
                    <App />
                </ProtectedRoute>
            ) : (
                <App />
            )}
            <AuthErrorModal />
            <MigrationErrorModal />
        </React.StrictMode>
    );
}

bootstrap().catch((error: unknown) => {
    console.error('Failed to bootstrap CalmHub', error);
    root.render(
        <React.StrictMode>
            <div role="alert" style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
                <h1>CalmHub failed to load</h1>
                <p>Please try refreshing the page. If the problem persists, contact your administrator.</p>
            </div>
        </React.StrictMode>
    );
});
