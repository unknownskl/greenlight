import React from 'react'
import Head from 'next/head'

import PageHeader from '../components/ui/pageheader';
import Content from '../components/ui/content';

export default function HomePage() {
  return (
    <React.Fragment>
        <Head>
            <title>Greenlight - xCloud</title>
        </Head>

        <PageHeader title="xCloud Streaming" subtitle="xCloud streaming coming soon" />

        <Content>
                <p>xCloud page</p>
        </Content>
    </React.Fragment>
  )
}
