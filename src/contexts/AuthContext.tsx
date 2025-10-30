import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { lemmyService, LoginRequest, MyUserInfo } from '../services/lemmy';
import { backendAPI } from '../services/backend';

interface AuthContextType {
  user: MyUserInfo | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<MyUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!lemmyService.isAuthenticated()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const siteData = await lemmyService.getSite();
      if (siteData.my_user) {
        setUser(siteData.my_user);
        // Set auth token for backend API
        const token = localStorage.getItem('lemmy_auth_token');
        if (token) {
          backendAPI.setAuthToken(token);
        }
      } else {
        setUser(null);
        lemmyService.setAuthToken(null);
        backendAPI.setAuthToken(null);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
      lemmyService.setAuthToken(null);
      backendAPI.setAuthToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true);
    try {
      const response = await lemmyService.login(credentials);
      if (response.jwt) {
        await refreshUser();
      } else {
        throw new Error('No JWT token received');
      }
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    await lemmyService.logout();
    backendAPI.setAuthToken(null);
    setUser(null);
  };

  const isAuthenticated = user !== null;
  const isAdmin = user?.local_user_view.local_user.admin ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
