import React from 'react'
import Head from 'next/head'

function Error404Page() {
    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - Error</title>
            </Head>
      
            <p>Oopsie 404.. Action not found</p>
        </React.Fragment>
    )
}

export default Error404Page
