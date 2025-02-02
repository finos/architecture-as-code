import { UserManager, WebStorageStateStore, Log, User } from "oidc-client";

const config = {
  authority: 'https://localhost:9443/realms/calm-hub-realm',
  client_id: 'calm-hub-authz-code',
  redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile read:patterns read:flows read:architectures read:namespaces read:adrs',
  post_logout_redirect_uri: window.location.origin,
  automaticSilentRenew: true,
  filterProtocolClaims: true,
  loadUserInfo: true,
};

let userManager = null;
const isHttps = window.location.protocol === 'https:';
if (isHttps) {
  userManager = new UserManager(config);
  Log.logger = console;
  Log.level = Log.INFO;
}

export const getUser = async (): Promise<User | null> => {
  return await userManager.getUser();
};

export const login = async (): Promise<void> => {
  await userManager.signinRedirect();
};

export const processRedirect = async (): Promise<User | null> => {
  try {
    await userManager.signinRedirectCallback();
    return await getUser();
  } catch (error) {
    console.error("Redirect Processing Error:", error);
    return null;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await userManager.signoutRedirect();
  } catch (error) {
    console.error("Logout Error:", error);
  }
};

export const clearSession = async (): Promise<void> => {
  try {
    await userManager.removeUser();
    console.log("Session cleared successfully.");
  } catch (error) {
    console.error("Error clearing session:", error);
  }
};

export const getToken = async (): Promise<string> => {
    if (!isHttps) {
        return "";
    }
    const user = await userManager.getUser();
    if (user && !user.expired) {
        return user.access_token;
    }

    if (user && user.expired) {
       try {
         const refreshedUser = await userManager.signinSilent();
         return refreshedUser.access_token;
       } catch (error) {
          console.error('Error refreshing token:', error);
          return "";
       }
    }
    return "";
};

export const checkAuthorityService = async (): Promise<boolean> => {
  try {
    const response = await fetch(config.authority, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error("Authority Service Check Error:", error);
    return false;
  }
};


export const authService = {
  getUser,
  login,
  processRedirect,
  logout,
  clearSession,
  getToken,
};
