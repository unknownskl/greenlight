import React from 'react'
import { useTranslation } from 'react-i18next'

import { useSettings } from '../context/userContext'
import GamepadNavigator from '../lib/gamepad/navigator'
import { gamepadState, pushBackHandler } from '../lib/gamepad/state'
import { DialogRequest, alertDialog, closeCurrentDialog, subscribeDialogs } from '../lib/gamepad/dialog'

function isStreamPage(): boolean {
    return /(^|\/)stream(\/|$)/.test(window.location.pathname)
}

/**
 * Makes the whole interface usable with a gamepad (d-pad / left stick to move, A to select, B to go back,
 * LB / RB to switch sections) and hosts the in-app dialogs that replace the native alert() windows.
 */
function GamepadNav() {
    const { t } = useTranslation()
    const { settings } = useSettings()

    const [dialog, setDialog] = React.useState<DialogRequest | null>(null)
    const [padActive, setPadActive] = React.useState(false)

    // The navigator is created once, so it reads the current settings through a ref
    const enabledRef = React.useRef(true)
    enabledRef.current = settings.gamepad_navigation !== false

    const okLabelRef = React.useRef('OK')
    okLabelRef.current = t('gamepad.ok')

    // Dialogs: render the current request and replace window.alert
    React.useEffect(() => {
        const unsubscribe = subscribeDialogs(setDialog)

        const nativeAlert = window.alert
        window.alert = (message?: any) => {
            void alertDialog(String(message ?? ''), okLabelRef.current)
        }

        return () => {
            unsubscribe()
            window.alert = nativeAlert
        }
    }, [])

    // B / Escape dismisses the dialog
    React.useEffect(() => {
        if(dialog === null){
            return
        }

        return pushBackHandler(() => {
            closeCurrentDialog(dialog.cancelValue)
            return true
        })
    }, [dialog])

    // Gamepad navigation
    React.useEffect(() => {
        const gamepadNavigator = new GamepadNavigator({
            getRoot: () => {
                const dialogElement = document.getElementById('gp_dialog')
                if(dialogElement !== null){
                    return dialogElement
                }

                if(isStreamPage()){
                    // While streaming only the Greenlight menu can be navigated (the pad belongs to the game)
                    return gamepadState.streamMenuOpen ? document.getElementById('component_streamcomponent_gamebar') : null
                }

                return document
            },
            isEnabled: () => {
                if(enabledRef.current === false){
                    return false
                }

                return document.getElementById('gp_dialog') !== null || !isStreamPage() || gamepadState.streamMenuOpen
            },
            onActivity: setPadActive,
        })

        gamepadNavigator.start()

        return () => {
            gamepadNavigator.stop()
        }
    }, [])

    return (
        <React.Fragment>
            { (padActive && enabledRef.current && !isStreamPage()) ? <div id="gp_hints" data-gp-ignore>
                <span><b>A</b> {t('gamepad.hintSelect')}</span>
                <span><b>B</b> {t('gamepad.hintBack')}</span>
                <span><b>LB</b><b>RB</b> {t('gamepad.hintSections')}</span>
                <span><b>LT</b><b>RT</b> {t('gamepad.hintSubSections')}</span>
            </div> : '' }

            { (dialog !== null) ? <div id="gp_dialog_backdrop">
                <div id="gp_dialog" role="dialog">
                    <p className="gp-dialog-message">{dialog.message}</p>
                    <div className="gp-dialog-buttons">
                        { dialog.buttons.map((button, index) => (
                            <button key={index} className={'btn ' + (button.default ? 'btn-primary' : '')}
                                data-gp-default={button.default ? '' : undefined}
                                onClick={() => closeCurrentDialog(button.value)}>{button.label}</button>
                        )) }
                    </div>
                </div>
            </div> : '' }
        </React.Fragment>
    )
}

export default GamepadNav
