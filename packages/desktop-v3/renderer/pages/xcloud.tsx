import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'


import PageHeader from '../components/ui/pageheader';
import Content from '../components/ui/content';

export default function XcloudPage() {
  const router = useRouter()

  function handleStreamClick() {
    const titleId = (document.getElementById('titleid') as HTMLInputElement).value
    console.log(`Starting stream, redirecting user to /stream/xcloud/${titleId}`)
    router.push(`/stream/xcloud/${titleId}`)
  }
  return (
    <React.Fragment>
      <Head>
          <title>Greenlight - xCloud</title>
      </Head>

      <PageHeader title="xCloud Streaming" subtitle="xCloud streaming coming soon" />

      <Content>
        
          <input id="titleid" type="text" placeholder="Title ID" defaultValue="HALOINFINITE" className="input" data-focusable />
          <button className="btn" onClick={handleStreamClick} data-focusable>Stream title</button>

      </Content>
    </React.Fragment>
  )
}
