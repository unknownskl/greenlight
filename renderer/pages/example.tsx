import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import Header from '../components/header'

function Home() {
  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - Example</title>
      </Head>

      <div>
        <p>
          ⚡ Electron + Next.js ⚡ -
          <Link legacyBehavior href="/next">
            <a>Go to next page</a>
          </Link>
          <Link legacyBehavior href="/log">
            <a>Go to logs</a>
          </Link>
        </p>
        <img src="/images/logo.png" />
      </div>
    </React.Fragment>
  );
};

export default Home;
