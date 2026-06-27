import React from 'react'
import {useTranslations} from 'next-intl';

import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../utils/trpc";

import { useToast } from '../contexts/ToastContext'

import PageHeader from '../components/ui/pageheader';
import Content from '../components/ui/content';

export default function HomePage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('HomePage');
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
      
      <PageHeader title="Game Library" subtitle="0 titles in your collection" />

      <Content>
        <p>
          <a data-focusable onClick={ping}>Ping</a><br />
          <a data-focusable onClick={getVersion}>getVersion</a><br />
          <a data-focusable onClick={showToast}>Show Toast</a><br />
        </p>

        <p> Translated: {t('title')}</p>


        {/* <pre>{ JSON.stringify(authState, null, 2) }</pre> */}
      </Content>
    </React.Fragment>
  )
}
