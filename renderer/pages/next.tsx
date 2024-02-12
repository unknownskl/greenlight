import React from 'react'
import Head from 'next/head'
import Link from 'next/link'

import Header from '../components/header'

function Next() {
    return (
        <React.Fragment>
            <div>
                <p>
          ⚡ Electron + Next.js ⚡ -
                    <Link legacyBehavior href="/home">
                        <a>Go to home page</a>
                    </Link>
                </p>
            </div>
        </React.Fragment>
    )
}

export default Next
