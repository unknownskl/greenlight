import React from 'react'
import Head from 'next/head'
import Ipc from '../../lib/ipc'
import Link from 'next/link'
import Loader from '../../components/ui/loader'
import ViewportGrid from '../../components/ui/viewportgrid'
import GameTitleDynamic from '../../components/ui/game/titledynamic'
import BreadcrumbBar from '../../components/ui/breadcrumbbar'
import { useQuery, QueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/userContext'


function xCloudLibrary() {
    const { t } = useTranslation()
    const { settings } = useSettings()
    const [filter, setFilter] = React.useState({
        name: '',
    })

    const xCloudTitles = useQuery(['xCloudTitles', settings.xcloud_show_non_entitled], () => Ipc.send('xCloud', 'getTitles', { showNonEntitled: settings.xcloud_show_non_entitled }), { staleTime: 300*1000 })
    const xCloudSearch = useQuery(['xCloudSearch', filter, settings.xcloud_show_non_entitled], () => Ipc.send('xCloud', 'filterTitles', { ...filter, showNonEntitled: settings.xcloud_show_non_entitled }))
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
                <title>Greenlight - {t('page.xCloudLibrary.pageTitle')}</title>
            </Head>

            <BreadcrumbBar>
                <Link href="/xcloud/home">{t('page.xCloudLibrary.breadcrumb1')}</Link>
                <Link href="/xcloud/library">{t('page.xCloudLibrary.breadcrumb2')}</Link>
            </BreadcrumbBar>

            <h2 className="title">
                {t('page.xCloudLibrary.title')}

                <input type="text" className="text h2-search" placeholder={t('page.xCloudLibrary.searchPlaceholder')} onChange={
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
