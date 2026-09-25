import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Ipc from '../../lib/ipc'
import Button from '../../components/ui/button'
import BreadcrumbBar from '../../components/ui/breadcrumbbar'
import TitleRow from '../../components/xcloud/titleRow'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/userContext'

function xCloudHome() {
    const { t } = useTranslation()
    const { settings } = useSettings()
    useQuery(['xCloudTitles', settings.xcloud_show_non_entitled], () => Ipc.send('xCloud', 'getTitles', { showNonEntitled: settings.xcloud_show_non_entitled }), { staleTime: 300*1000 })
    const xCloudNewTitles = useQuery(['xCloudNewTitles', settings.xcloud_show_non_entitled], () => Ipc.send('xCloud', 'getNewTitles', { showNonEntitled: settings.xcloud_show_non_entitled }), { staleTime: 60*1000 })
    const xCloudRecentTitles = useQuery('xCloudRecentTitles', () => Ipc.send('xCloud', 'getRecentTitles'), { staleTime: 10*1000 })

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('page.xCloud.pageTitle')}</title>
            </Head>

            <BreadcrumbBar>
                <Link href="/xcloud/home">{t('page.xCloud.breadcrumb')}</Link>
                {/* <Link href="/xcloud/library">Library</Link> */}
            </BreadcrumbBar>

            <TitleRow titles={ (xCloudRecentTitles.isFetched) ? xCloudRecentTitles.data : [] }>{t('page.xCloud.recentGames')}</TitleRow>

            <TitleRow titles={ (xCloudNewTitles.isFetched) ? xCloudNewTitles.data : [] }>
                {t('page.xCloud.recentlyAdded')}&nbsp;
                <Link href="/xcloud/library"><Button label={t('page.xCloud.viewLibraryBtn')} className='btn-small'></Button></Link>
            </TitleRow>

            {/* } */}

        </React.Fragment>
    )
}

export default xCloudHome
