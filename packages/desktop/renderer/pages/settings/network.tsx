import React from 'react'
import Head from 'next/head'
import { useTranslation } from 'react-i18next'

import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import Button from '../../components/ui/button'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'
import { NetworkInterfaceInfo, NetworkMode } from '../../lib/networkInterface'

interface NetworkStatus {
    interfaces: NetworkInterfaceInfo[];
    mdnsDisabled: boolean;
    platform: string;
}

const MODES: NetworkMode[] = ['nat', 'wifi', 'lan']

function SettingsNetwork() {
    const { t } = useTranslation()
    const { settings, setSettings } = useSettings()
    const [status, setStatus] = React.useState<NetworkStatus | undefined>(undefined)
    const [lastRoute, setLastRoute] = React.useState<any>(undefined)

    const mode: NetworkMode = ((settings as any).network_interface || 'nat') as NetworkMode

    function refresh() {
        Ipc.send('network', 'getStatus').then((result: NetworkStatus) => {
            setStatus(result)
        }).catch((error) => {
            console.log('Failed to load network status:', error)
        })
    }

    React.useEffect(() => {
        refresh()
        try {
            const raw = localStorage.getItem('greenlight_last_route')
            if (raw) setLastRoute(JSON.parse(raw))
        } catch (e) {
            // ignore
        }
    }, [])

    function setMode(newMode: NetworkMode) {
        setSettings({
            ...settings,
            network_interface: newMode,
        })
    }

    function restartApp() {
        Ipc.send('app', 'restart')
    }

    const interfaces = status?.interfaces || []
    const ofType = (type: string) => interfaces.filter((i) => i.type === type)
    const hasAddress = (type: string) => ofType(type).some((i) => i.addresses.some((a) => a.family === 'IPv4'))
    const vpnActive = ofType('vpn').some((i) => i.addresses.some((a) => a.family === 'IPv4'))

    const needsRestart = status !== undefined && mode !== 'nat' && !status.mdnsDisabled
    const missingInterface = status !== undefined && mode !== 'nat' && !hasAddress(mode)

    const typeLabel = (type: string) => t('settings.network.type.' + type)

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('settings.network.pageTitle')}</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>{t('settings.network.title')}</h1>
                    <p><small>{t('settings.network.description')}</small></p>

                    { MODES.map((m) => (
                        <p key={m}>
                            <label>
                                <input type="radio" name="network_interface" value={m} checked={mode === m} onChange={() => setMode(m)} />
                                &nbsp; {t('settings.network.mode.' + m)}
                            </label>
                            <br />
                            <small>{t('settings.network.modeDescription.' + m)}</small>
                        </p>
                    )) }

                    { needsRestart ? (
                        <p>
                            <small style={{ color: 'orange' }}>{t('settings.network.restartRequired')}</small><br />
                            <Button label={t('settings.network.restartBtn')} className="btn-primary" onClick={restartApp} />
                        </p>
                    ) : null }

                    { missingInterface ? (
                        <p><small style={{ color: 'orange' }}>{t('settings.network.missingInterface', { type: typeLabel(mode) })}</small></p>
                    ) : null }

                    { mode === 'nat' && vpnActive ? (
                        <p><small>{t('settings.network.vpnDetectedNat')}</small></p>
                    ) : null }
                </Card>

                <Card>
                    <h1>{t('settings.network.detectedTitle')}</h1>

                    { interfaces.length === 0 ? <p>{t('settings.network.noInterfaces')}</p> : (
                        <table className="component_controllermapping">
                            <tbody>
                                { interfaces.filter((i) => i.type !== 'other').map((iface) => (
                                    <tr key={iface.name}>
                                        <td>{iface.label} ({iface.name})</td>
                                        <td>{typeLabel(iface.type)}</td>
                                        <td>{iface.addresses.filter((a) => a.family === 'IPv4').map((a) => a.address).join(', ') || '-'}</td>
                                    </tr>
                                )) }
                            </tbody>
                        </table>
                    ) }

                    <p><Button label={t('settings.network.refreshBtn')} onClick={refresh} /></p>
                </Card>

                { lastRoute ? (
                    <Card>
                        <h1>{t('settings.network.lastRouteTitle')}</h1>
                        <p>
                            {t('settings.network.lastRouteMode')}: {t('settings.network.mode.' + (lastRoute.mode || 'nat'))}<br />
                            {t('settings.network.lastRouteLocal')}: {lastRoute.localAddress || '-'} ({lastRoute.localType || '-'}, {lastRoute.protocol || '-'})<br />
                            {t('settings.network.lastRouteRemote')}: {lastRoute.remoteAddress || '-'} ({lastRoute.remoteType || '-'})<br />
                            { lastRoute.onSelectedInterface === false ? <small style={{ color: 'orange' }}>{t('settings.network.lastRouteMismatch')}</small> : null }
                            { lastRoute.onSelectedInterface === true ? <small style={{ color: '#5dc21e' }}>{t('settings.network.lastRouteOk')}</small> : null }
                        </p>
                        <p><small>{lastRoute.at ? new Date(lastRoute.at).toLocaleString() : ''}</small></p>
                    </Card>
                ) : null }
            </SettingsSidebar>
        </React.Fragment>
    )
}

export default SettingsNetwork
