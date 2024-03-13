import React from 'react'
import Head from 'next/head'

import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'

import { useSettings } from '../../context/userContext'
import {InputFrame} from 'xbox-xcloud-player/dist/Channel/Input'

const emptyInputFrame = () => ({
    GamepadIndex: 0,
    Nexus: 0,
    Menu: 0,
    View: 0,
    A: 0,
    B: 0,
    X: 0,
    Y: 0,
    DPadUp: 0,
    DPadDown: 0,
    DPadLeft: 0,
    DPadRight: 0,
    LeftShoulder: 0,
    RightShoulder: 0,
    LeftThumb: 0,
    RightThumb: 0,

    LeftThumbXAxis: 0.0,
    LeftThumbYAxis: 0.0,
    RightThumbXAxis: 0.0,
    RightThumbYAxis: 0.0,
    LeftTrigger: 0.0,
    RightTrigger: 0.0,
}) as InputFrame

function invert(dict) {
    const inv = {}
    for(const [k, v] of Object.entries(dict)) {
        inv[v.toString()] = k
    }
    return inv
}

function KeySettings({keyConfigs, setKeyConfig}) {
    const keys = Object.keys(emptyInputFrame())
    keyConfigs = invert(keyConfigs)
    return <p>
        {
            keys.map(
                (btn: keyof InputFrame) =>(
                    <p key={btn}>
                        <label>{btn}</label>
                        <label style={{minWidth: 0}}>
                            <input type='text' className='text' onKeyUp={(e) => setKeyConfig(btn, e.key)} value={keyConfigs[btn] ?? 'None'}/>
                        </label>
                    </p>
                )
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

    function setKeyConfig(button: keyof InputFrame, keymap: string) {
        let ckeys = controllerKeys
        if(ckeys === undefined) {
            ckeys = {}
        }


        for (const ckeysKey of Object.keys(ckeys)) {
            if(ckeys[ckeysKey] === button) delete ckeys[ckeysKey]
        }

        if (keymap !== 'Backspace')
            ckeys[keymap] = button

        setControllerKeys(ckeys)

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
                        </label>
                    </p>

                    {
                        settings.input_mousekeyboard ? <KeySettings keyConfigs={controllerKeys} setKeyConfig={setKeyConfig}></KeySettings> : <></>
                    }

                    <p>
                        <label>Enable new Gamepad driver</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setLegacyInput } checked={settings.input_newgamepad} />&nbsp; ({ settings.input_newgamepad ? 'Enabled' : 'Disabled'})
                        </label><br />
                        <small>(Enable this if you want to use the Keyboard & Mouse input to avoid double input. The default keyboard controls will be disabled.)</small>
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
            </SettingsSidebar>
      

        </React.Fragment>
    )
}

export default SettingsInput
