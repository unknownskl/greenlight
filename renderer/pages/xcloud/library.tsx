import React from 'react'
import Head from 'next/head'
import Ipc from '../../lib/ipc'
import Link from 'next/link'
import Loader from '../../components/ui/loader'
import ViewportGrid from '../../components/ui/viewportgrid'
import GameTitleDynamic from '../../components/ui/game/titledynamic'
import BreadcrumbBar from '../../components/ui/breadcrumbbar'
import { useQuery, QueryClient } from 'react-query'


function xCloudLibrary() {
    const [filter, setFilter] = React.useState({
        name: '',
    })

    const xCloudTitles = useQuery('xCloudTitles', () => Ipc.send('xCloud', 'getTitles'), { staleTime: 300*1000 })
    const xCloudSearch = useQuery(['xCloudSearch', filter], () => Ipc.send('xCloud', 'filterTitles', filter))
    const queryClient = new QueryClient()

    function performFilter(){
        console.log(filter)

        // if(filter.name !== ''){
        //   // const xCloudSearch = useQuery('xCloudSearch', () => Ipc.send('xCloud', 'filterTitles', filter))
        queryClient.invalidateQueries('xCloudSearch')
        return (xCloudSearch.isFetched === true) ? xCloudSearch.data : xCloudTitles.data
        // }

        // return (xCloudSearch.isFetched === true) ? xCloudSearch.data : xCloudTitles.data
        return xCloudTitles.data
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - xCloud Library</title>
            </Head>

            <BreadcrumbBar>
                <Link href="/xcloud/home">xCloud</Link>
                <Link href="/xcloud/library">Library</Link>
            </BreadcrumbBar>

            <h2 className="title">
        Library

                <input type="text" className="text h2-search" placeholder="Search" onChange={
                    (e) => {
                        setFilter({
                            name: e.target.value,
                        })
                    }
                }></input>
            </h2>
      
            <ViewportGrid key='library' drawPagination={true}>{
                (xCloudTitles.isFetched !== true) ? (<Loader></Loader>) : performFilter().map((item) => {
                    return (
                        <GameTitleDynamic
                            titleId={ item }
                            key={ item }
                        ></GameTitleDynamic>
                    )
                })
            }</ViewportGrid>

        </React.Fragment>
    )
}

export default xCloudLibrary
