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

bootstrap();
