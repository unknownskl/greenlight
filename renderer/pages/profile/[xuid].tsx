import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

function Profile() {
    const router = useRouter()

    //   React.useEffect(() => {


    //     return () => {
        
    //     };
    //   })

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - Profile {router.query.xuid}</title>
            </Head>

            <div style={{ paddingTop: '20px' }}>
                <p>Profile View: {router.query.xuid}</p>
            </div>
        </React.Fragment>
    )
}

export default Profile
