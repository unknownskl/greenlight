import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// import { trpc } from '../trpc';
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC, RouterOutputs } from "../utils/trpc";

interface AuthContextType {
  startAuth: () => Promise<RouterOutputs["auth_msal_start"] | undefined>;
  verifyCode: (code: string) => Promise<RouterOutputs["auth_msal_verify"] | undefined>;
  logout: () => void;
  getWebToken: () => { uhs: string; token: string };
  getxHomeToken: () => { market: string; language: string; token: string };
  getxCloudToken: () => { market: string; language: string; token: string };
  getUserRefreshToken: () => string | undefined;
  authState?: {
    userToken: RouterOutputs["auth_msal_verify"] | null;
    webToken: RouterOutputs["auth_get_webtoken"] | null;
    streamingTokens: RouterOutputs["auth_get_streamingtokens"] | null;
  };
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  hasUserTokens: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [authState, setAuthState] = useState<{
    userToken: RouterOutputs["auth_msal_verify"] | null;
    webToken: RouterOutputs["auth_get_webtoken"] | null;
    streamingTokens: RouterOutputs["auth_get_streamingtokens"] | null;
  }>({
    userToken: null,
    webToken: null,
    streamingTokens: null,
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [hasUserTokens, setHasUserTokens] = useState<boolean>(true);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState<boolean>(false);

  // Load saved auth state from localStorage on mount
  useEffect(() => {
    setHasUserTokens(localStorage.getItem('userToken') ? true : false);

    const loadAuthState = async () => {
      setIsAuthenticating(true);
      const savedUserToken = localStorage.getItem('userToken');
      if (savedUserToken) {
        try {
          const userToken = JSON.parse(savedUserToken);
          
          // Fetch fresh web and streaming tokens (don't load from storage)
          try {
            const [webToken, streamingTokens] = await Promise.all([
              queryClient.fetchQuery(trpc.auth_get_webtoken.queryOptions(userToken)),
              queryClient.fetchQuery(trpc.auth_get_streamingtokens.queryOptions(userToken)),
            ]);
            
            setAuthState({
              userToken,
              webToken: webToken,
              streamingTokens,
            });
            
            setIsAuthenticated(true);
          } catch (error) {
            console.error('Failed to fetch tokens:', error);

            // Check if we can refresh the tokens
            // const refreshedToken = await queryClient.fetchQuery(trpc.auth_msal_refresh.queryOptions(userToken.refresh_token))

            // Clear invalid userToken only on auth failure
            // localStorage.removeItem('userToken');

            // setAuthState({
            //   userToken: null,
            //   webToken: null,
            //   streamingTokens: null,
            // });
            // setIsAuthenticated(false);

            setHasUserTokens(false);
            setIsAuthenticating(false);
          }
        } catch (e) {
          console.error('Failed to parse saved user token', e);
        }
      }
      setHasLoadedFromStorage(true);
      setIsAuthenticating(false);
    };
    
    loadAuthState();
  }, []);

  // Save only userToken to localStorage (not web/streaming tokens)
  // Only save after we've loaded from storage to avoid removing on initial render
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    
    if (authState.userToken) {
      localStorage.setItem('userToken', JSON.stringify(authState.userToken));
    }
  }, [authState.userToken, hasLoadedFromStorage]);

  const startAuth = async () => {
    const result = await queryClient.fetchQuery(trpc.auth_msal_start.queryOptions());
    return result;
  };

  const verifyCode = async (code: string) => {
    // setIsAuthenticating(true);
    try {
      const userToken = await queryClient.fetchQuery(trpc.auth_msal_verify.queryOptions(code));
      console.log('User token obtained:', userToken);
      
      // Save userToken immediately to localStorage
      localStorage.setItem('userToken', JSON.stringify(userToken));
      
      // Fetch web token and streaming tokens using the userToken
      const [webToken, streamingTokens] = await Promise.all([
        queryClient.fetchQuery(trpc.auth_get_webtoken.queryOptions(userToken)),
        queryClient.fetchQuery(trpc.auth_get_streamingtokens.queryOptions(userToken)),
      ]);
      
      setAuthState({
        userToken,
        webToken,
        streamingTokens,
      });
      
      setIsAuthenticated(true);
      
      return userToken;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = () => {
    setAuthState({
      userToken: null,
      webToken: null,
      streamingTokens: null,
    });
    setIsAuthenticated(false);
    localStorage.removeItem('userToken');
  };

  const getBrowserLanguage = () => {
    const primaryLang = navigator.languages?.[0]?.split('-')[0] || 'en';
    const regionalVariant = navigator.languages?.find(lang => 
      lang.toLowerCase().startsWith(primaryLang + '-')
    )?.toLowerCase() || `${primaryLang}-us`;

    return regionalVariant
  }

  const getWebToken = () => {
    return {
      uhs: authState?.webToken?.data.DisplayClaims?.xui[0]?.uhs || '', // @TODO: Fix typing
      token: authState?.webToken?.data.Token || '',
    }
  }

  const getxHomeToken = () => {
    return {
      market: authState.streamingTokens?.xHomeToken?.data.market || '',
      language: getBrowserLanguage() || 'en-us',
      token: authState.streamingTokens?.xHomeToken?.data.gsToken || '',
    }
  }

  const getxCloudToken = () => {
    return {
      market: authState.streamingTokens?.xCloudToken?.data.market || '',
      language: getBrowserLanguage() || 'en-us',
      token: authState.streamingTokens?.xCloudToken?.data.gsToken || '',
    }
  }

  const getUserRefreshToken = () => {
    return authState.userToken?.refresh_token;
  }

  return (
    <AuthContext.Provider
      value={{
        startAuth,
        verifyCode,
        logout,
        authState,
        isAuthenticated,
        isAuthenticating,
        hasUserTokens,
        getWebToken,
        getxHomeToken,
        getxCloudToken,
        getUserRefreshToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
