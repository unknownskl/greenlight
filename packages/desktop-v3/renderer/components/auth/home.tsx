import React, { useState, useEffect } from 'react'
import Head from 'next/head'

import QRCode from "react-qr-code";

// import { useQueryClient } from "@tanstack/react-query";
import { RouterOutputs } from "../../utils/trpc";
import { useAuth } from '../../contexts/AuthContext';

export default function HomePage() {
  // const trpc = useTRPC();
  // const queryClient = useQueryClient();

  // const { isAuthenticated, isAuthenticating, authState, startAuth } = useAuth();
  const { startAuth, verifyCode } = useAuth();
  const [authFlow, setAuthFlow] = useState<RouterOutputs["auth_msal_start"] | undefined>(undefined);

  useEffect(() => {
    if(!authFlow){
      // const authState = useQuery(trpc.auth_msal_start.queryOptions());
      // const authState = await queryClient.fetchQuery(trpc.auth_msal_start.queryOptions());
      startAuth().then(async (authState) => {
        console.log('Authentication flow started:', authState);
        setAuthFlow(authState)

        if(authState) {
          const tokens = await verifyCode(authState.device_code);
          console.log('Device code verified, tokens:', tokens);

        } else {
          console.error('No auth session yet, starting one...');
        }

      }).catch((error) => {
        console.error('Failed to start authentication flow:', error);
      });
    }
  }, [authFlow, startAuth, verifyCode]);

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight Authentication</title>
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
                    <h2 className="text-2xl font-bold text-white mb-1">You need to authenticate</h2>
                    <p className="text-white/40 text-sm">Login with your xbox account to continue</p>

                    <div className="flex mt-10">
                      <div className="w-64 flex-auto content-center p-4">
                        <p id="login-message">{ authFlow?.message || 'Retrieving login details...'}</p>
                      </div>
                      <div className="w-1 border-l border-white/20"></div>
                      <div className="w-64 flex-auto content-center justify-items-center p-4">
                        <p className="pb-4">
                          Or scan the QR code below with your phone to sign in.
                        </p>
                        { (authFlow?.verification_uri && authFlow?.user_code) ? <QRCode value={`${authFlow.verification_uri}?otc=${authFlow.user_code}`} size={100} bgColor="#0d0d0d" fgColor="#ffffff" /> : ''}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* End of main content */}
            </main>
          </div>
    </React.Fragment>
  )
}
