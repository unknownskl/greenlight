import React from 'react'
import Head from 'next/head'

// import { useAuth } from '../../contexts/AuthContext';

export default function AuthLoadingPage() {
  // const { authState } = useAuth();

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight Authenticating...</title>
      </Head>
      <div className="flex h-screen bg-[#0d0d0d] bg-pattern overflow-hidden">
            {/* Main content */}
            <main className="flex-1 overflow-hidden relative">
              {/* Ambient background glow */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#107C10]/3 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#107C10]/2 rounded-full blur-3xl pointer-events-none" />

              {/* Main content area */}

              <div className="h-full overflow-y-auto">
                <div className="p-6 md:p-8 max-w-5xl mx-auto">
                  {/* Header */}
                  <div className="mb-6 animate-fade-in-up">
                    <h2 className="text-2xl font-bold text-white mb-1">Authenticating...</h2>
                    <p className="text-white/40 text-sm">
                      Welcome back... <br />
                      {/* userToken: { authState?.userToken ? 'Present' : 'Not present'} <br />
                      webToken: { authState?.webToken ? 'Present' : 'Not present'} <br />
                      streamingTokens: { authState?.streamingTokens ? 'Present' : 'Not present'} <br /> */}
                    </p>
                  </div>
                </div>
              </div>

              {/* End of main content */}
            </main>
          </div>
    </React.Fragment>
  )
}
