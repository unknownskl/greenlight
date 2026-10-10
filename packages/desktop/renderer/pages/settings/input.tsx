import React from 'react'
import Head from 'next/head'

import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import Button from '../../components/ui/button'

import { useSettings } from '../../context/userContext'
import { STICK_KEYS } from '../../lib/stickkeys'
import { MOUSE_SENSITIVITY_MAX, MOUSE_SENSITIVITY_MIN, normalizeMouseSensitivity } from '../../lib/mousesensitivity'

import { useTranslation } from 'react-i18next'

function invert(obj) {
    const new_obj = {}
    for (const prop in obj) {
        new_obj[obj[prop]] = prop
    }
    return new_obj
}

function KeySettings({keyConfigs, setKeyConfig}) {
    const { t } = useTranslation()
    const mappableButtons = ['DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight', 'A', 'B', 'X', 'Y', 'View', 'Menu', 'Nexus', 'LeftShoulder', 'RightShoulder', 'LeftTrigger', 'RightTrigger', 'LeftThumb', 'RightThumb', ...STICK_KEYS]
    // console.log('KEYS:', keyConfigs, mappableButtons)
    keyConfigs = invert(keyConfigs)
    return <p>
        {
            mappableButtons.map(
                (btn:string) => {
                    let fullBtnText = ''

                    switch(btn){
                        case 'DPadUp':
                            fullBtnText = t('settings.input.dPadUp')
                            break
                        case 'DPadDown':
                            fullBtnText = t('settings.input.dPadDown')
                            break
                        case 'DPadLeft':
                            fullBtnText = t('settings.input.dPadLeft')
                            break
                        case 'DPadRight':
                            fullBtnText = t('settings.input.dPadRight')
                            break
                        case 'LeftShoulder':
                            fullBtnText = t('settings.input.leftShoulder')
                            break
                        case 'RightShoulder':
                            fullBtnText = t('settings.input.rightShoulder')
                            break
                        case 'LeftTrigger':
                            fullBtnText = t('settings.input.leftTrigger')
                            break
                        case 'RightTrigger':
                            fullBtnText = t('settings.input.rightTrigger')
                            break
                        case 'LeftThumb':
                            fullBtnText = t('settings.input.leftThumb')
                            break
                        case 'RightThumb':
                            fullBtnText = t('settings.input.rightThumb')
                            break
                        case 'LeftStickUp':
                            fullBtnText = t('settings.input.leftStickUp')
                            break
                        case 'LeftStickDown':
                            fullBtnText = t('settings.input.leftStickDown')
                            break
                        case 'LeftStickLeft':
                            fullBtnText = t('settings.input.leftStickLeft')
                            break
                        case 'LeftStickRight':
                            fullBtnText = t('settings.input.leftStickRight')
                            break
                        case 'RightStickUp':
                            fullBtnText = t('settings.input.rightStickUp')
                            break
                        case 'RightStickDown':
                            fullBtnText = t('settings.input.rightStickDown')
                            break
                        case 'RightStickLeft':
                            fullBtnText = t('settings.input.rightStickLeft')
                            break
                        case 'RightStickRight':
                            fullBtnText = t('settings.input.rightStickRight')
                            break
                        case 'View':
                            fullBtnText = t('settings.input.view')
                            break
                        case 'Menu':
                            fullBtnText = t('settings.input.menu')
                            break
                        case 'Nexus':
                            fullBtnText = t('settings.input.nexus')
                        default:
                            fullBtnText = btn
                            break
                    }

                    return <p key={btn}>
                        <label>{fullBtnText}</label>
                        <label style={{minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <input type='text' className='text' onKeyUp={(e) => setKeyConfig(btn, e)} value={keyConfigs[btn] ?? t('settings.input.none')}/>
                            { keyConfigs[btn] !== undefined ? <Button label={<i className="fa-solid fa-xmark"></i>} title={t('settings.input.none')} className='btn-small' onClick={() => setKeyConfig(btn, { key: 'Escape', target: { blur: () => undefined } })}></Button> : '' }
                        </label>
                    </p>
                }
            )
        }
    </p>
}

function SettingsInput() {
    const { settings, setSettings} = useSettings()
    const [ controllerPing, setControllerPing] = React.useState(0)

    const [controllerKeys, setControllerKeys] = React.useState(settings.input_mousekeyboard_config)

    const { t } = useTranslation()

    React.useEffect(() => {
        console.log('Last controller check:', controllerPing)
        const controllerInterval = setInterval(() => {
            setControllerPing(Date.now())
        }, 1000)

        return () => {
            clearInterval(controllerInterval)
        }
    })

    function setControllerVibration(){
        setSettings({
            ...settings,
            controller_vibration: (! settings.controller_vibration),
        })
    }

    function setTouchInput(){
        setSettings({
            ...settings,
            input_touch: (! settings.input_touch),
        })
    }

    function setMKBInput(){
        setSettings({
            ...settings,
            input_mousekeyboard: (! settings.input_mousekeyboard),
        })
    }

    function setMouseSensitivityInput(e){
        setSettings({
            ...settings,
            input_mouse_sensitivity: normalizeMouseSensitivity(Number(e.target.value)),
        })
    }

    function setLegacyInput(){
        setSettings({
            ...settings,
            input_newgamepad: (! settings.input_newgamepad),
        })
    }

    function setKeyConfig(button:string, event) {
        let ckeys = controllerKeys
        if(ckeys === undefined) {
            ckeys = {} as any
        }


        for (const ckeysKey of Object.keys(ckeys)) {
            if(ckeys[ckeysKey] === button) delete ckeys[ckeysKey]
        }

        if (event.key !== 'Escape')
            ckeys[event.key] = button

        setControllerKeys(ckeys)

        event.target.blur()

        setSettings({
            ...settings,
            input_mousekeyboard_config: ckeys,
        })
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('settings.input.pageTitle')}</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>{t('settings.input.title')}</h1>

                    <p>
                        <label>{t('settings.input.enableVibration')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setControllerVibration } checked={settings.controller_vibration} />&nbsp; ({ settings.controller_vibration ? t('settings.input.enabledLabel') : t('settings.input.disabledLabel')})
                        </label>
                    </p>

                    <p>
                        <label>{t('settings.input.enableTouch')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setTouchInput } checked={settings.input_touch} />&nbsp; ({ settings.input_touch ? t('settings.input.enabledLabel') : t('settings.input.disabledLabel')})
                        </label>
                    </p>

                    <p>
                        <label>{t('settings.input.enableMouseKeyboard')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setMKBInput } checked={settings.input_mousekeyboard} />&nbsp; ({ settings.input_mousekeyboard ? t('settings.input.enabledLabel') : t('settings.input.disabledLabel')})
                        </label> <br />
                        { (!settings.input_newgamepad && settings.input_mousekeyboard) ? <small style={{ color: 'orange' }}>{t('settings.input.legacyWarning')}</small> : '' }
                    </p>

                    <p>
                        <label>{t('settings.input.enableLegacy')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setLegacyInput } checked={!settings.input_newgamepad} />&nbsp; ({ !settings.input_newgamepad ? t('settings.input.enabledLabel') : t('settings.input.disabledLabel')})
                        </label><br />
                        <small>{t('settings.input.enableLegacyDescription')}</small>
                    </p>
                </Card>

                <Card hidden={ !settings.input_mousekeyboard }>
                    <p>
                        <label>{t('settings.input.mouseSensitivity')}</label>
                        <input type='range' min={ MOUSE_SENSITIVITY_MIN } max={ MOUSE_SENSITIVITY_MAX } step='1' value={ normalizeMouseSensitivity(settings.input_mouse_sensitivity) } onChange={ setMouseSensitivityInput } />
                        ({ normalizeMouseSensitivity(settings.input_mouse_sensitivity) }%)<br />
                        <small>{t('settings.input.mouseSensitivityDescription')}</small>
                    </p>
                </Card>

                <Card>
                    <h1>{t('settings.input.controllerDetectedTitle')}</h1>

                    <p>{t('settings.input.controllerDetectedDescription')}</p>

                    <div>
                        {
                            navigator.getGamepads().map((item, index) => {
                                return (
                                    <p key={ index }>
                                #{ index+1 } &nbsp;

                                        { (item) ?
                                            item.id + ' ' + t('settings.input.axesLabel') + ': ' + item.axes.length + ', ' + t('settings.input.buttonsLabel') + ': ' + item.buttons.length + ', ' + t('settings.input.rumbleLabel') + ': ' + ((item.vibrationActuator !== null) ? (item.vibrationActuator as any).type : t('settings.input.notSupportedLabel'))
                                            : t('settings.input.noControllerDetected')
                                        }
                                    </p>
                                )
                            })
                        }
                    </div>
                </Card>

                <Card hidden={ settings.input_newgamepad }>
                    <h1>{t('settings.input.keyboardMappingsTitle')}</h1>
                    <p>
                        {
                            <KeySettings keyConfigs={controllerKeys} setKeyConfig={setKeyConfig} />
                        }
                    </p>
                </Card>
            </SettingsSidebar>


        </React.Fragment>
    )
}

export default SettingsInput
