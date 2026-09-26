import React from 'react'
import Head from 'next/head'
import Ipc from '../../lib/ipc'
import Link from 'next/link'
import Loader from '../../components/ui/loader'
import ViewportGrid from '../../components/ui/viewportgrid'
import GameTitleDynamic from '../../components/ui/game/titledynamic'
import BreadcrumbBar from '../../components/ui/breadcrumbbar'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'


function xCloudLibrary() {
    const { t } = useTranslation()
    const [searchTerm, setSearchTerm] = React.useState('')
    const [debouncedSearch, setDebouncedSearch] = React.useState('')
    const [gamePassOnly, setGamePassOnly] = React.useState(true)

    // Debounce search input by 250ms to prevent query churn
    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm)
        }, 250)
        return () => {
            clearTimeout(handler)
        }
    }, [searchTerm])

    const trimmedSearch = debouncedSearch.trim()
    const titlesQuery = useQuery(
        ['xCloudTitles', trimmedSearch, gamePassOnly],
        () => Ipc.send('xCloud', 'filterTitles', { name: trimmedSearch, onlyEntitled: gamePassOnly }),
        { staleTime: 60 * 1000, keepPreviousData: true }
    )

    const titles: string[] = titlesQuery.data || []

    const renderContent = () => {
        if (titlesQuery.isLoading && !titlesQuery.data) {
            return <Loader />
        }

        if (titles.length === 0) {
            return (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888888', fontSize: '16px' }}>
                    {t('page.xCloudLibrary.noGamesFound')}
                </div>
            )
        }

        return (
            <ViewportGrid key={`library_${trimmedSearch}_${gamePassOnly}`} drawPagination={true}>
                { titles.map((item) => (
                    <GameTitleDynamic
                        titleId={ item }
                        key={ item }
                    />
                )) }
            </ViewportGrid>
        )
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

                <div style={{ float: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', userSelect: 'none', fontWeight: 300, minWidth: 0, paddingRight: '4px' }}>
                        <input
                            type="checkbox"
                            checked={gamePassOnly}
                            onChange={(e) => setGamePassOnly(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        <span>{t('page.xCloudLibrary.gamePassOnly')}</span>
                    </label>

                    <input
                        type="text"
                        className="text h2-search"
                        style={{ float: 'none', margin: 0 }}
                        placeholder={t('page.xCloudLibrary.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </h2>

            { renderContent() }

        </React.Fragment>
    )
}

export default xCloudLibrary

