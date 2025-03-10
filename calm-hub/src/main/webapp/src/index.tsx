import React from "react";
import ReactDOM from "react-dom/client";
import ProtectedRoute from "./ProtectedRoute";
import './index.css';
import '@patternfly/patternfly/patternfly.css';
import { authService } from "./authService";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

const LogoutButton: React.FC = () => {
  const handleLogout = async () => {
    await authService.logout();
  };

  return <button onClick={handleLogout} style={{ position: 'absolute', top: 10, right: 10 }}>Logout</button>;
};

const isHttps = window.location.protocol === 'https:';

root.render(
  <React.StrictMode>
    {isHttps ? (
      <ProtectedRoute>
        <LogoutButton />
        <App />
      </ProtectedRoute>
    ) : (
        <App />
    )}
  </React.StrictMode>
);