import React, { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import Ipc from '../lib/ipc'
import { useQuery, useQueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'

import Button from '../components/ui/button'
import Card from '../components/ui/card'
import Label from '../components/ui/label'
import Loader from '../components/ui/loader'

// How often (ms) and how many times to check the power state after sending a power command.
const POWER_CHECK_INTERVAL = 4000
const POWER_CHECK_ATTEMPTS = 15

// "XboxSeriesX" -> "Xbox Series X"
function formatConsoleType(consoleType?: string): string {
    return (consoleType || '').replace(/([a-z])([A-Z])/g, '$1 $2')
}

// Keeps only the entries whose console still has the power state the entry was made for.
function keepWhileSameState<T>(entries: Record<string, T | undefined>, list: any[], getState: (entry: T) => string) {
    const kept: Record<string, T | undefined> = {}

    Object.keys(entries).forEach((id) => {
        const entry = entries[id]
        const item = list.find((console) => console.id === id)

        if (entry && item?.powerState === getState(entry)) {
            kept[id] = entry
        }
    })

    return kept
}

// A console that is shut down (not in sleep mode) can't be turned on from Greenlight.
function isConsoleShutDown(item: any, assumedState?: string): boolean {
    if (item.powerState === 'On') return false

    return item.powerState === 'Off' || (!!assumedState && assumedState === item.powerState)
}

// Look of the state LED and name of the state of a console.
function getStateView(item: any, isOn: boolean, isShutDown: boolean, t: (key: string) => string) {
    if (isOn) return { led: 'on', name: t('page.myConsoles.poweredOn') }
    if (isShutDown) return { led: 'off', name: t('page.myConsoles.off') }
    if (item.powerState === 'ConnectedStandby') return { led: 'standby', name: t('page.myConsoles.standby') }

    return { led: '', name: item.powerState }
}

// Tooltip of the power button.
function getPowerTitle(pendingCommand: '' | 'on' | 'off' | undefined, isOn: boolean, isShutDown: boolean, t: (key: string) => string): string {
    if (pendingCommand === 'on') return t('page.myConsoles.poweringOn')
    if (pendingCommand === 'off') return t('page.myConsoles.poweringOff')
    if (isOn) return t('page.myConsoles.powerOffBtn')
    if (isShutDown) return t('page.myConsoles.powerOnUnavailable')

    return t('page.myConsoles.powerOnBtn')
}

// CSS class of the power button: green to turn on, red to turn off, plain grey when it can't be used.
function getPowerClass(isOn: boolean, isShutDown: boolean): string {
    if (isShutDown) return 'btn-icon'

    return isOn ? 'btn-icon btn-power-off' : 'btn-icon btn-power-on'
}

// navigator.clipboard is only available on secure origins, the Web UI over plain http needs the fallback.
function copyText(text: string): Promise<void> {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text)
    }

    return new Promise((resolve, reject) => {
        const area = document.createElement('textarea')
        area.value = text
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()

        try {
            // Deprecated, but it is the only way to copy on a page that is not a secure context (Web UI over http).
            document.execCommand('copy') ? resolve() : reject(new Error('Copy failed'))
        } catch (error) {
            reject(error)
        } finally {
            area.remove()
        }
    })
}

function Home() {
    const consoles = useQuery('consoles', () => Ipc.send('consoles', 'get'), { staleTime: 60*1000 })
    const queryClient = useQueryClient()
    const { t } = useTranslation()

    // Power command in progress for each console: turning it on or off.
    const [pending, setPending] = useState<Record<string, '' | 'on' | 'off'>>({})
    // Last power command error of each console. It is only shown while the console is still in the state it
    // had when the command failed: once the state changes the message makes no sense anymore.
    const [powerError, setPowerError] = useState<Record<string, { key: string, state: string } | undefined>>({})
    // Consoles that did not turn on after the power-on command: they are shown as shut down (a console that is not in
    // sleep mode ignores the command) while they keep reporting the same state; a new state clears it.
    const [assumedShutDown, setAssumedShutDown] = useState<Record<string, string | undefined>>({})
    const [refreshing, setRefreshing] = useState(false)
    const [copiedId, setCopiedId] = useState('')
    const mounted = useRef(true)
    const timers = useRef<ReturnType<typeof setTimeout>[]>([])

    useEffect(() => {
        mounted.current = true

        return () => {
            mounted.current = false
            timers.current.forEach((timer) => clearTimeout(timer))
        }
    }, [])

    // When a console changes state, the notes about its last failed power command are not true anymore.
    useEffect(() => {
        if (!Array.isArray(consoles.data)) return

        setAssumedShutDown((current) => keepWhileSameState(current, consoles.data, (state) => state))
        setPowerError((current) => keepWhileSameState(current, consoles.data, (error) => error.state))
    }, [consoles.data])

    const refreshConsoles = () => {
        return Ipc.send('consoles', 'refresh').then((list: any) => {
            if (mounted.current) {
                queryClient.setQueryData('consoles', list)
            }

            return list
        })
    }

    const refreshAll = () => {
        const done = () => {
            if (mounted.current) setRefreshing(false)
        }

        setRefreshing(true)
        refreshConsoles().then(done, done)
    }

    const stopPending = (consoleId: string, errorKey: string, state: string) => {
        if (!mounted.current) return

        setPending((current) => ({ ...current, [consoleId]: '' }))
        setPowerError((current) => ({ ...current, [consoleId]: errorKey ? { key: errorKey, state } : undefined }))
    }

    // Checks the power state until the console is on (turnOn) or not on anymore (!turnOn).
    const waitForPowerState = (consoleId: string, turnOn: boolean, attempt: number, stateAtStart: string) => {
        timers.current.push(setTimeout(() => {
            refreshConsoles().then((list: any) => {
                const current = list.find((item) => item.id === consoleId)

                if (current && (current.powerState === 'On') === turnOn) {
                    stopPending(consoleId, '', '')
                } else if (attempt + 1 >= POWER_CHECK_ATTEMPTS) {
                    const state = current ? current.powerState : stateAtStart

                    if (turnOn && mounted.current) {
                        setAssumedShutDown((assumed) => ({ ...assumed, [consoleId]: state }))
                    }
                    stopPending(consoleId, turnOn ? 'powerOnTimeout' : 'powerOffTimeout', state)
                } else {
                    waitForPowerState(consoleId, turnOn, attempt + 1, stateAtStart)
                }
            }).catch(() => stopPending(consoleId, turnOn ? 'powerOnFailed' : 'powerOffFailed', stateAtStart))
        }, POWER_CHECK_INTERVAL))
    }

    const sendPowerCommand = (consoleId: string, turnOn: boolean, stateAtStart: string) => {
        setPowerError((current) => ({ ...current, [consoleId]: undefined }))
        setPending((current) => ({ ...current, [consoleId]: turnOn ? 'on' : 'off' }))

        Ipc.send('consoles', turnOn ? 'powerOn' : 'powerOff', { consoleId }).then(() => {
            waitForPowerState(consoleId, turnOn, 0, stateAtStart)
        }).catch(() => stopPending(consoleId, turnOn ? 'powerOnFailed' : 'powerOffFailed', stateAtStart))
    }

    const powerOff = (item) => {
        // Turning the console off closes the game that is running on it.
        if (confirm(t('page.myConsoles.powerOffConfirm', { name: item.name }))) {
            sendPowerCommand(item.id, false, item.powerState)
        }
    }

    const copyConsoleId = (consoleId: string) => {
        copyText(consoleId).then(() => {
            setCopiedId(consoleId)
            timers.current.push(setTimeout(() => {
                if (mounted.current) setCopiedId('')
            }, 1500))
        }).catch(() => { /* nothing to do: the id stays selectable on screen */ })
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('page.myConsoles.pageTitle')}</title>
            </Head>

            <div style={ {
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'stretch',
                paddingTop: '20px',
            }}>
                { (consoles.isLoading === true) ? <Loader></Loader> :
                    (consoles.isFetched === true && consoles.data.length > 0) ? consoles.data.map((item, i) => {
                        const canPower = item.remoteManagementEnabled === true && item.consoleStreamingEnabled === true
                        const isOn = item.powerState === 'On'
                        const busy = !!pending[item.id]
                        const isShutDown = isConsoleShutDown(item, assumedShutDown[item.id])
                        const stateView = getStateView(item, isOn, isShutDown, t)

                        return (
                            <Card className='padbottom' key={i}>
                                <h1>{item.name}</h1>

                                <div style={{
                                    width: 200,
                                    margin: '0 auto',
                                    paddingTop: 10,
                                }}>
                                    <Image src="data:image/png;base64,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" style={{
                                        width: 200,
                                        textAlign: 'center',
                                    }} alt='Console' width={ 200 } height={ 56 }></Image>
                                </div>

                                <h2 className='grey' style={{
                                    textAlign: 'center',
                                    fontSize: 11,
                                    fontWeight: 'normal',
                                    opacity: 0.35,
                                }}>
                                    {formatConsoleType(item.consoleType)}
                                    {item.consoleType ? ' \u00b7 ' : ''}
                                    <button type='button' title={t('page.myConsoles.copyIdTitle')} onClick={ () => copyConsoleId(item.id) } style={{
                                        // looks like the text around it
                                        background: 'none',
                                        border: 0,
                                        padding: 0,
                                        color: 'inherit',
                                        font: 'inherit',
                                        cursor: 'pointer',
                                    }}>{copiedId === item.id ? t('page.myConsoles.idCopied') : item.id}</button>
                                </h2>

                                <br />

                                {canPower ? '' :
                                    (<div>
                                        {!item.remoteManagementEnabled ? '' : <p><Label className='orange'>{t('page.myConsoles.warningLabel')}</Label> {t('page.myConsoles.managementWarning')}</p>}
                                        {!item.consoleStreamingEnabled ? '' : <p><Label className='orange'>{t('page.myConsoles.warningLabel')}</Label> {t('page.myConsoles.streamingWarning')}</p>}
                                    </div>)}

                                {/* <p>Name: {item.name}</p>
                                <p>ID: {item.id}</p>
                                <p>State: {item.powerState}</p>
                                <p>Type: {item.consoleType}</p>
                                <p>Assistant: {item.digitalAssistantRemoteControlEnabled ? 'Enabled' : 'Disabled'}</p>
                                <p>Remote: {item.remoteManagementEnabled ? 'Enabled' : 'Disabled'}</p>
                                <p>Streaming: {item.consoleStreamingEnabled ? 'Enabled' : 'Disabled'}</p><br /> */}

                                <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', minWidth: 280 }}>
                                    {canPower ?
                                        <span className='status_led_label'>
                                            <i className={ 'status_led ' + stateView.led }></i>
                                            {stateView.name}
                                        </span> : <span></span>}

                                    <div style={ { display: 'flex', alignItems: 'center' } }>
                                        <Link href={ `stream/${item.id}` }>
                                            <Button className='btn-icon btn-primary' label={ <i className='fa-solid fa-play'></i> } title={t('page.myConsoles.startStreamBtn')} />
                                        </Link>
                                        <div style={ { marginLeft: '24px' } }>
                                            <Button className={ getPowerClass(isOn, isShutDown) }
                                                label={ <i className={ busy ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-power-off' }></i> }
                                                title={ getPowerTitle(pending[item.id], isOn, isShutDown, t) }
                                                disabled={ !canPower || busy || isShutDown }
                                                onClick={ () => isOn ? powerOff(item) : sendPowerCommand(item.id, true, item.powerState) } />
                                        </div>
                                        <div style={ { marginLeft: '10px' } }>
                                            <Button className='btn-icon' label={ <i className={ 'fa-solid fa-arrows-rotate' + (refreshing ? ' fa-spin' : '') }></i> }
                                                title={t('page.myConsoles.refreshBtn')} disabled={refreshing} onClick={ refreshAll } />
                                        </div>
                                    </div>
                                </div>

                                {(powerError[item.id] && powerError[item.id]?.state === item.powerState) ?
                                    // width 0 + min-width 100%: the text wraps inside the card instead of making it wider
                                    <p style={ { width: 0, minWidth: '100%', marginTop: '16px', color: '#ff9f1a', opacity: 1, fontSize: 12, textAlign: 'justify' } }>{t('page.myConsoles.' + powerError[item.id]?.key)}</p> : ''}
                            </Card>
                        )
                    }) : <Card className='padbottom' key='noconsoles'>{t('page.myConsoles.noConsoles')}</Card>
                }
            </div>

        </React.Fragment>
    )
}

export default Home
