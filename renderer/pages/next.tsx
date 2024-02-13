import React from 'react'
import Link from 'next/link'

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
