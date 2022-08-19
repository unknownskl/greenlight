import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import Header from '../components/header'

function Error(props) {
  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - Error</title>
      </Head>

      <p>Oopsie 500.. Application has an error</p>
    </React.Fragment>
  );
};

export default Error;
