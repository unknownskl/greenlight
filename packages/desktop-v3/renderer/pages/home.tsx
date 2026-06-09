import React from 'react'
// import Link from 'next/link'
// import Image from 'next/image'
import {useTranslations} from 'next-intl';

import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../utils/trpc";
import { useAuth } from '../contexts/AuthContext';

import { useToast } from '../contexts/ToastContext'

export default function HomePage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('HomePage');

  

const { isAuthenticated, isAuthenticating, authState } = useAuth();

console.log('Authentication status in _app:', { isAuthenticated, isAuthenticating, authState });
  const toast = useToast();


  const ping = () => {
    queryClient.fetchQuery(trpc.ping.queryOptions())
      .then((data) => {
          console.log(data)
      })
      .catch((error) => {
          console.error('Error fetching data:', error);
      });
  }
  
  const getVersion = () => {
    queryClient.fetchQuery(trpc.version.queryOptions())
      .then((data) => {
          console.log(data)
      })
      .catch((error) => {
          console.error('Error fetching data:', error);
      });
  }

  const showToast = () => {
    toast.log('This is a log message');
    toast.warning('This is a warning message');
    toast.error('This is an error message');
  }



  return (
    <React.Fragment>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-fade-in-up">
          <h2 className="text-2xl font-bold text-white mb-1">Game Library</h2>
          <p className="text-white/40 text-sm">0 titles in your collection</p>

          <a data-focusable onClick={ping}>Ping</a><br />
          <a data-focusable onClick={getVersion}>getVersion</a><br />
          <a data-focusable onClick={showToast}>Show Toast</a><br />

          <p> Translated: {t('title')}</p>


          {/* <pre>{ JSON.stringify(authState, null, 2) }</pre> */}
        </div>
      </div>
    </React.Fragment>
  )
}
