import React from 'react'
import Head from 'next/head'

import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'

import { useSettings } from '../../context/userContext'
import { MouseKeyboardConfig } from 'xbox-xcloud-player/dist/Driver/Keyboard'

function getUniqueButtons(keyMapping) {
    const buttons = []
    for(const button in keyMapping) {
        // k = actualButton,  v = gamepadButton
        buttons.push(keyMapping[button])
    }
    const uniqueButtons = buttons.filter((v, i, a) => a.indexOf(v) === i)
    return uniqueButtons
}

function invert(obj) {
    var new_obj = {};
    for (var prop in obj) {
        if(obj.hasOwnProperty(prop)) {
            new_obj[obj[prop]] = prop;
        }
    }
    return new_obj;
}

function KeySettings({keyConfigs, setKeyConfig}) {
    // const mappableButtons = getUniqueButtons(MouseKeyboardConfig.default()._keymapping)
    const mappableButtons = ['DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight', 'A', 'B', 'X', 'Y', 'View', 'Menu', 'Nexus', 'LeftShoulder', 'RightShoulder', 'LeftTrigger', 'RightTrigger', 'LeftThumb', 'RightThumb']
    console.log('KEYS:', keyConfigs, mappableButtons)
    keyConfigs = invert(keyConfigs)
    return <p>
        {
            mappableButtons.map(
                (btn:string) => {
                    let fullBtnText = '';

                    switch(btn){
                        case 'DPadUp':
                            fullBtnText = 'DPad Up'
                            break;
                        case 'DPadDown':
                            fullBtnText = 'DPad Down'
                            break;
                        case 'DPadLeft':
                            fullBtnText = 'DPad Left'
                            break;
                        case 'DPadRight':
                            fullBtnText = 'DPad Right'
                            break;
                        case 'LeftShoulder':
                            fullBtnText = 'Left Shoulder'
                            break;
                        case 'RightShoulder':
                            fullBtnText = 'Right Shoulder'
                            break;
                        case 'LeftTrigger':
                            fullBtnText = 'Left Trigger'
                            break;
                        case 'RightTrigger':
                            fullBtnText = 'Right Trigger'
                            break;
                        case 'LeftThumb':
                            fullBtnText = 'Left Thumbstick'
                            break;
                        case 'RightThumb':
                            fullBtnText = 'Right Thumbstick'
                            break;
                        default:
                            fullBtnText = btn
                            break;
                    }

                    return <p key={btn}>
                        <label>{fullBtnText}</label>
                        <label style={{minWidth: 0}}>
                            <input type='text' className='text' onKeyUp={(e) => setKeyConfig(btn, e)} value={keyConfigs[btn] ?? 'None'}/>
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

        if (event.key !== 'Backspace')
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
                <title>Greenlight - Settings: Input</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>Input</h1>

                    <p>
                        <label>Enable vibration</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setControllerVibration } checked={settings.controller_vibration} />&nbsp; ({ settings.controller_vibration ? 'Enabled' : 'Disabled'})
                        </label>
                    </p>

                    <p>
                        <label>Enable Touch input</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setTouchInput } checked={settings.input_touch} />&nbsp; ({ settings.input_touch ? 'Enabled' : 'Disabled'})
                        </label>
                    </p>

                    <p>
                        <label>Enable Mouse & Keyboard</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setMKBInput } checked={settings.input_mousekeyboard} />&nbsp; ({ settings.input_mousekeyboard ? 'Enabled' : 'Disabled'})
                        </label> <br />
                        { (!settings.input_newgamepad && settings.input_mousekeyboard) ? <small style={{ color: 'orange' }}>Using the Mouse & Keyboard driver together with the Gamepad keyboard mappings will cause conflicts</small> : '' }
                    </p>

                    <p>
                        <label>Enable Keyboard to Gamepad</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setLegacyInput } checked={!settings.input_newgamepad} />&nbsp; ({ !settings.input_newgamepad ? 'Enabled' : 'Disabled'})
                        </label><br />
                        <small>(Disabling this feature will disable the keyboard to gamepad mapping and only allows controls from the gamepad.)</small>
                    </p>
                </Card>

                <Card>
                    <h1>Controllers detected</h1>

                    <p>
                        If you have a gamepad connected but it is not showing up, try to press a button on the controller to detect it.
                    </p>

                    <div>
                        {
                            navigator.getGamepads().map((item, index) => {
                                return (
                                    <p key={ index }>
                                #{ index+1 } &nbsp;

                                        { (item) ?
                                            item.id + ' axes: ' + item.axes.length + ', buttons: ' + item.buttons.length + ', rumble: ' + ((item.vibrationActuator !== null) ? item.vibrationActuator.type : 'Not supported')
                                            : 'No controller detected'
                                        }
                                    </p>
                                )
                            })
                        }
                    </div>
                </Card>

                <Card hidden={ settings.input_newgamepad }>
                    <h1>Keyboard mappings</h1>
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
