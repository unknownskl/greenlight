import React from 'react'
import Head from 'next/head'
import { useTranslation } from 'react-i18next'

import SettingsSidebar from '../../components/settings/sidebar'
import ControllerView from '../../components/settings/controllerview'
import Card from '../../components/ui/card'
import Button from '../../components/ui/button'

import { useSettings } from '../../context/userContext'
import Ipc from '../../lib/ipc'
import {
    XBOX_BUTTONS,
    XboxButton,
    GamepadMapping,
    DEFAULT_GAMEPAD_MAPPING,
    resolveMapping,
} from '../../lib/gamepadMapping'

function listGamepads(): Gamepad[] {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return []
    return Array.from(navigator.getGamepads()).filter((pad) => pad !== null)
}

function SettingsController() {
    const { t } = useTranslation()
    const { settings, setSettings } = useSettings()

    const [gamepads, setGamepads] = React.useState<Gamepad[]>([])
    const [selectedIndex, setSelectedIndex] = React.useState(0)
    const [listening, setListening] = React.useState<XboxButton | undefined>(undefined)
    const [showMapped, setShowMapped] = React.useState(true)
    const [reconnectSupported, setReconnectSupported] = React.useState(false)
    const [reconnecting, setReconnecting] = React.useState(false)
    const [reconnectMessage, setReconnectMessage] = React.useState<string | undefined>(undefined)

    React.useEffect(() => {
        Ipc.send('gamepad', 'getReconnectSupport').then((supported: boolean) => {
            setReconnectSupported(supported === true)
        }).catch(() => setReconnectSupported(false))
    }, [])

    function reconnectControllers() {
        setReconnecting(true)
        setReconnectMessage(undefined)
        Ipc.send('gamepad', 'reconnect').then((results: { name: string; ok: boolean; error?: string }[]) => {
            if (!results || results.length === 0) {
                setReconnectMessage(t('settings.controller.reconnectNone'))
            } else if (results.every((r) => r.ok)) {
                setReconnectMessage(t('settings.controller.reconnectDone', { devices: results.map((r) => r.name).join(', ') }))
            } else {
                setReconnectMessage(t('settings.controller.reconnectFailed') + ' ' + results.filter((r) => !r.ok).map((r) => r.name + ': ' + r.error).join('; '))
            }
        }).catch((error) => {
            setReconnectMessage(t('settings.controller.reconnectFailed') + ' ' + (typeof error === 'string' ? error : (error?.message || '')))
        }).finally(() => {
            setReconnecting(false)
        })
    }

    const userMapping: GamepadMapping = (settings as any).controller_mapping || {}
    const mapping = resolveMapping(userMapping)

    const settingsRef = React.useRef(settings)
    settingsRef.current = settings

    // Keep the controller list in sync
    React.useEffect(() => {
        const refresh = () => {
            const pads = listGamepads()
            setGamepads(pads)
            setSelectedIndex((current) => pads.some((p) => p.index === current) ? current : (pads[0]?.index ?? 0))
        }
        refresh()
        window.addEventListener('gamepadconnected', refresh)
        window.addEventListener('gamepaddisconnected', refresh)
        // Some platforms only expose a pad after the first input, so poll as well
        const interval = setInterval(refresh, 1000)
        return () => {
            window.removeEventListener('gamepadconnected', refresh)
            window.removeEventListener('gamepaddisconnected', refresh)
            clearInterval(interval)
        }
    }, [])

    function saveMapping(newMapping: GamepadMapping) {
        setSettings({
            ...settingsRef.current,
            controller_mapping: newMapping,
        })
    }

    // Capture the next physical button press while remapping
    React.useEffect(() => {
        if (listening === undefined) return

        let frame: number
        let baseline: boolean[] | undefined

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setListening(undefined)
        }
        window.addEventListener('keydown', onKey)

        const poll = () => {
            const pad = navigator.getGamepads()[selectedIndex]
            if (pad) {
                const pressed = pad.buttons.map((b) => b.pressed)
                if (baseline === undefined) {
                    // Ignore buttons already held when listening started
                    baseline = pressed
                } else {
                    const idx = pressed.findIndex((p, i) => p && !baseline[i])
                    baseline = baseline.map((b, i) => b && pressed[i])
                    if (idx >= 0) {
                        const current: GamepadMapping = (settingsRef.current as any).controller_mapping || {}
                        const next = { ...current }
                        if (idx === DEFAULT_GAMEPAD_MAPPING[listening]) {
                            delete next[listening]
                        } else {
                            next[listening] = idx
                        }
                        saveMapping(next)
                        setListening(undefined)
                        return
                    }
                }
            }
            frame = requestAnimationFrame(poll)
        }
        frame = requestAnimationFrame(poll)

        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener('keydown', onKey)
        }
    }, [listening, selectedIndex])

    function resetButton(btn: XboxButton) {
        const next = { ...userMapping }
        delete next[btn]
        saveMapping(next)
    }

    function resetAll() {
        setListening(undefined)
        saveMapping({})
    }

    function testRumble() {
        const pad: any = navigator.getGamepads()[selectedIndex]
        if (pad?.vibrationActuator?.playEffect) {
            pad.vibrationActuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: 500,
                weakMagnitude: 1.0,
                strongMagnitude: 1.0,
            })
        }
    }

    const usage: Record<number, number> = {}
    for (const btn of XBOX_BUTTONS) usage[mapping[btn]] = (usage[mapping[btn]] || 0) + 1

    const selectedPad = gamepads.find((p) => p.index === selectedIndex)
    const hasRumble = !!(selectedPad as any)?.vibrationActuator

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('settings.controller.pageTitle')}</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>{t('settings.controller.testTitle')}</h1>

                    { reconnectSupported ? (
                        <p>
                            <Button
                                label={<span><i className="fa-solid fa-plug-circle-bolt"></i> {reconnecting ? t('settings.controller.reconnecting') : t('settings.controller.reconnectBtn')}</span>}
                                className="btn-primary"
                                disabled={reconnecting}
                                onClick={reconnectControllers}
                            />
                            <br />
                            <small>{ reconnectMessage || t('settings.controller.reconnectDescription') }</small>
                        </p>
                    ) : null }

                    { gamepads.length === 0 ? (
                        <p>{t('settings.controller.noController')}</p>
                    ) : (
                        <React.Fragment>
                            <p>
                                <label>{t('settings.controller.selectController')}</label>
                                <label style={{ minWidth: 0 }}>
                                    <select value={selectedIndex} onChange={(e) => setSelectedIndex(parseInt(e.target.value))}>
                                        { gamepads.map((pad) => (
                                            <option key={pad.index} value={pad.index}>#{pad.index} - {pad.id}</option>
                                        )) }
                                    </select>
                                </label>
                            </p>

                            <p>
                                <label>{t('settings.controller.showMapped')}</label>
                                <label style={{ minWidth: 0 }}>
                                    <input type="checkbox" checked={showMapped} onChange={() => setShowMapped(!showMapped)} />
                                </label>
                            </p>

                            <ControllerView
                                gamepadIndex={selectedIndex}
                                mapping={showMapped ? mapping : DEFAULT_GAMEPAD_MAPPING}
                                highlight={listening}
                            />

                            <p>
                                <Button
                                    label={t('settings.controller.testRumble')}
                                    onClick={testRumble}
                                    disabled={!hasRumble}
                                    title={hasRumble ? '' : t('settings.controller.noRumble')}
                                />
                            </p>
                        </React.Fragment>
                    ) }
                </Card>

                <Card>
                    <h1>{t('settings.controller.remapTitle')}</h1>
                    <p><small>{t('settings.controller.remapDescription')}</small></p>

                    <table className="component_controllermapping">
                        <tbody>
                            { XBOX_BUTTONS.map((btn) => {
                                const isChanged = userMapping[btn] !== undefined && userMapping[btn] !== DEFAULT_GAMEPAD_MAPPING[btn]
                                const isDuplicate = usage[mapping[btn]] > 1
                                return (
                                    <tr key={btn} className={(isChanged ? 'changed ' : '') + (isDuplicate ? 'duplicate' : '')}>
                                        <td>{t('settings.controller.buttons.' + btn)}</td>
                                        <td>
                                            { listening === btn
                                                ? t('settings.controller.pressButton')
                                                : t('settings.controller.physicalButton', { index: mapping[btn] }) }
                                            { isDuplicate ? ' ⚠' : '' }
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <Button
                                                label={listening === btn ? t('settings.controller.cancel') : t('settings.controller.remap')}
                                                disabled={gamepads.length === 0}
                                                onClick={() => setListening(listening === btn ? undefined : btn)}
                                            />
                                            &nbsp;
                                            <Button
                                                label={t('settings.controller.reset')}
                                                disabled={!isChanged}
                                                onClick={() => resetButton(btn)}
                                            />
                                        </td>
                                    </tr>
                                )
                            }) }
                        </tbody>
                    </table>

                    { Object.values(usage).some((n) => n > 1) ? (
                        <p><small style={{ color: 'orange' }}>{t('settings.controller.duplicateWarning')}</small></p>
                    ) : null }

                    <p>
                        <Button label={t('settings.controller.resetAll')} onClick={resetAll} />
                    </p>
                </Card>
            </SettingsSidebar>
        </React.Fragment>
    )
}

export default SettingsController
