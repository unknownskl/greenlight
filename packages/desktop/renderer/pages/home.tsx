import React from 'react'
import Head from 'next/head'
import Ipc from '../lib/ipc'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'

import { useSettings } from '../context/userContext'
import ConsoleTile, { ConsoleItem } from '../components/console/consoletile'
import SidebarFriends from '../components/sidebar/friends'

function isValidPort(port: any): boolean {
    return Number.isInteger(port) && port >= 1 && port <= 65535
}

function Home() {
    const consoles = useQuery('consoles', () => Ipc.send('consoles', 'get'), { staleTime: 60*1000 })
    const { settings } = useSettings()
    const { t } = useTranslation()

    // The port that is used for remote play to this console (same rule as the streaming code)
    function getRemotePort(consoleId: string): number {
        const perConsole = settings.remote_port_consoles?.[consoleId]
        if(isValidPort(perConsole)){
            return perConsole
        }

        return isValidPort(settings.remote_port) ? settings.remote_port : 9002
    }

    const items: ConsoleItem[] = (consoles.isFetched === true && Array.isArray(consoles.data)) ? consoles.data : []

    // The first console that can be streamed (a powered on one is preferred) gets the gamepad focus
    const streamable = items.filter((item) => item.remoteManagementEnabled === true && item.consoleStreamingEnabled === true)
    const defaultConsole = streamable.find((item) => item.powerState === 'On') ?? streamable[0]

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('page.myConsoles.pageTitle')}</title>
            </Head>

            <div className="home-page">
                <div className="page-hero">
                    <h1>{t('page.myConsoles.pageTitle')}</h1>
                    <p>{t('page.myConsoles.subtitle')}</p>
                </div>

                <div className="console-row">
                    { (consoles.isLoading === true) ? (
                        [0, 1].map((i) => <div className="console-tile console-tile-skeleton" key={i}></div>)
                    ) : (items.length > 0) ? (
                        items.map((item) => (
                            <ConsoleTile key={item.id} item={item} remotePort={getRemotePort(item.id)} isDefault={item.id === defaultConsole?.id} />
                        ))
                    ) : (
                        <div className="console-empty">
                            <i className="fa-solid fa-circle-info"></i>
                            <p>{t('page.myConsoles.noConsoles')}</p>
                        </div>
                    ) }
                </div>

                <div className="page-section">
                    <h2>{t('friends.title')}</h2>
                    <SidebarFriends></SidebarFriends>
                </div>
            </div>
        </React.Fragment>
    )
}

export default Home
