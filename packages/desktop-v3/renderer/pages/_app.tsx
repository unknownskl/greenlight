import type { AppProps } from 'next/app'
import { TrpcProviderComponent } from '../providers/trpc'
import { AuthProvider } from '../contexts/AuthContext'
import { ToastProvider } from '../contexts/ToastContext'
import { I18nProvider } from '../contexts/I18nContext'
import App from './app'
import Head from 'next/head'
import Sidebar from '../components/sidebar'

import '../styles/globals.css'

function GreenlightDesktop({ Component, pageProps }: AppProps) {

  return (
    <I18nProvider>
      <ToastProvider>
        <TrpcProviderComponent>
          <AuthProvider>
            <App>
              <Head>
                <title>Greenlight</title>
              </Head>
              <div className="flex h-screen bg-[#0d0d0d] bg-pattern overflow-hidden">
                {/* Sidebar */}
                <Sidebar />

                {/* Main content */}
                <main className="flex-1 overflow-hidden relative">
                  {/* Ambient background glow */}
                  <div className="absolute top-0 right-0 w-96 h-96 bg-[#107C10]/3 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#107C10]/2 rounded-full blur-3xl pointer-events-none" />

                  {/* Main content area */}

                  <div className="h-full overflow-y-auto">
                    <Component {...pageProps} />
                  </div>
                </main>
              </div>
            </App>
          </AuthProvider>
        </TrpcProviderComponent>
      </ToastProvider>
    </I18nProvider>
  );
}

export default GreenlightDesktop
