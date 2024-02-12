import React from 'react'
import Head from 'next/head'

import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'

import { useSettings } from '../../context/userContext'


function SettingsInput() {
    const { settings, setSettings} = useSettings()
    const [ controllerPing, setControllerPing] = React.useState(0)

    React.useEffect(() => {
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

                    <p>
                        <label>Enable new Gamepad driver</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setLegacyInput } checked={settings.input_newgamepad} />&nbsp; ({ settings.input_newgamepad ? 'Enabled' : 'Disabled'})
                        </label><br />
                        <small>(Enable this if you want to use the Keyboard & Mouse input to avoid double input)</small>
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
