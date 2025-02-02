import React, { ReactNode, useEffect, useState } from "react";
import { User } from "oidc-client";
import { authService } from "./authService";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authenticate = async () => {
      const currentUser = await authService.getUser();
      if (currentUser && !currentUser.expired) {
        setUser(currentUser);
      } else if (window.location.search.includes("code=")) {
        const loggedInUser = await authService.processRedirect();
        setUser(loggedInUser);
      } else {
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
