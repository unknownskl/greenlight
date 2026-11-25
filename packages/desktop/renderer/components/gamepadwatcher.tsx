import React from 'react'
import { useTranslation } from 'react-i18next'
import Ipc from '../lib/ipc'
import Button from './ui/button'

interface GamepadHolder {
    pid: number;
    name: string;
    appPath?: string;
    devices: string[];
}

const CHECK_INTERVAL = 5000

function visibleGamepadCount(): number {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return 0
    return Array.from(navigator.getGamepads()).filter((p) => p !== null).length
}

// Background watcher: when Greenlight can't see any controller but another app is
// holding a USB controller open, show a banner offering to quit that app.
function GamepadWatcher() {
    const { t } = useTranslation()
    const [holders, setHolders] = React.useState<GamepadHolder[]>([])
    const [dismissed, setDismissed] = React.useState<number[]>([])
    const [busyPid, setBusyPid] = React.useState<number | undefined>(undefined)
    const [message, setMessage] = React.useState<string | undefined>(undefined)

    const check = React.useCallback(() => {
        if (visibleGamepadCount() > 0) {
            setHolders([])
            return
        }
        Ipc.send('gamepad', 'getHolders').then((result: { holders: GamepadHolder[] }) => {
            // Re-check: a pad may have appeared while we were waiting
            setHolders(visibleGamepadCount() > 0 ? [] : (result.holders || []))
        }).catch((error) => {
            console.log('[gamepad] Failed to check controller holders:', error)
        })
    }, [])

    React.useEffect(() => {
        check()
        const interval = setInterval(check, CHECK_INTERVAL)
        const onConnect = () => setHolders([])
        window.addEventListener('gamepadconnected', onConnect)
        window.addEventListener('gamepaddisconnected', check)
        return () => {
            clearInterval(interval)
            window.removeEventListener('gamepadconnected', onConnect)
            window.removeEventListener('gamepaddisconnected', check)
        }
    }, [check])

    function quitApp(holder: GamepadHolder) {
        if (!confirm(t('gamepadWatcher.confirmQuit', { app: holder.name }))) return
        setBusyPid(holder.pid)
        Ipc.send('gamepad', 'quitHolder', { pid: holder.pid }).then(() => {
            setMessage(t('gamepadWatcher.quitDone', { app: holder.name }))
            setTimeout(() => { setMessage(undefined); check() }, 4000)
        }).catch((error) => {
            setMessage(t('gamepadWatcher.quitFailed', { app: holder.name }) + ' ' + (typeof error === 'string' ? error : ''))
        }).finally(() => {
            setBusyPid(undefined)
        })
    }

    const visible = holders.filter((h) => !dismissed.includes(h.pid))
    if (visible.length === 0 && !message) return null

    return (
        <div id="component_gamepadwatcher">
            { message ? <p>{message}</p> : null }
            { visible.map((holder) => (
                <div key={holder.pid} className="component_gamepadwatcher_item">
                    <i className="fa-solid fa-gamepad"></i>
                    <div>
                        <strong>{t('gamepadWatcher.title')}</strong><br />
                        <small>{t('gamepadWatcher.message', { app: holder.name, device: holder.devices.join(', ') })}</small>
                    </div>
                    <div className="component_gamepadwatcher_actions">
                        <Button label={t('gamepadWatcher.quitBtn', { app: holder.name })} className="btn-primary" disabled={busyPid === holder.pid} onClick={() => quitApp(holder)} />
                        &nbsp;
                        <Button label={t('gamepadWatcher.dismissBtn')} onClick={() => setDismissed([...dismissed, holder.pid])} />
                    </div>
                </div>
            )) }
            { visible.length > 0 ? <small className="component_gamepadwatcher_hint">{t('gamepadWatcher.hint')}</small> : null }
        </div>
    )
}

export default GamepadWatcher
