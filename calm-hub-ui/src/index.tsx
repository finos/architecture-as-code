import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import ProtectedRoute from './ProtectedRoute.js';
import { isAuthServiceEnabled } from './authService.js';
import App from './App.js';
import { initThemeCssVars } from './theme/colors.js';   
import { LogoutButton } from './components/logout-button/LogoutButton.js';

initThemeCssVars();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

const isAuthenticationEnabled = isAuthServiceEnabled();

root.render(
    <React.StrictMode>
        {isAuthenticationEnabled ? (
            <ProtectedRoute>
                <App />
                <LogoutButton />
            </ProtectedRoute>
        ) : (
            <App />
        )}
    </React.StrictMode>
);
