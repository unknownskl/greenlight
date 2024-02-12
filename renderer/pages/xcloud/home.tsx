import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Ipc from '../../lib/ipc'
import Button from '../../components/ui/button'
import BreadcrumbBar from '../../components/ui/breadcrumbbar'
import TitleRow from '../../components/xcloud/titleRow'
import { useQuery } from 'react-query'

function xCloudHome() {
    useQuery('xCloudTitles', () => Ipc.send('xCloud', 'getTitles'), { staleTime: 300*1000 })
    const xCloudNewTitles = useQuery('xCloudNewTitles', () => Ipc.send('xCloud', 'getNewTitles'), { staleTime: 60*1000 })
    const xCloudRecentTitles = useQuery('xCloudRecentTitles', () => Ipc.send('xCloud', 'getRecentTitles'), { staleTime: 10*1000 })

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - xCloud Library</title>
            </Head>

            <BreadcrumbBar>
                <Link href="/xcloud/home">xCloud</Link>
                {/* <Link href="/xcloud/library">Library</Link> */}
            </BreadcrumbBar>

            <TitleRow titles={ (xCloudRecentTitles.isFetched) ? xCloudRecentTitles.data : [] }>Recent Games</TitleRow>

            <TitleRow titles={ (xCloudNewTitles.isFetched) ? xCloudNewTitles.data : [] }>
          Recently added &nbsp;
                <Link href="/xcloud/library"><Button label="View Library" className='btn-small'></Button></Link>
            </TitleRow>
        
            {/* } */}

        </React.Fragment>
    )
}

export default xCloudHome
