import React from 'react'

import { useAuth } from '../contexts/AuthContext'
import AuthHome from '../components/auth/home'
import AuthLoading from '../components/auth/loading'

export default function App({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthenticating, hasUserTokens } = useAuth();

  return (
    <React.Fragment>
      { !isAuthenticated ? ((isAuthenticating || hasUserTokens) ? <AuthLoading /> : <AuthHome />) : children}
    </React.Fragment>
  )
}
