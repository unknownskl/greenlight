import React, { useContext, useEffect, useState } from 'react'
import Ipc from '../lib/ipc'
import { defaultSettings } from './userContext.defaults'

export const SettingsContext = React.createContext({
    settings: defaultSettings,
    setSettings: (settings) => null, // eslint-disable-line no-unused-vars
})
export const useSettings = () => useContext(SettingsContext)

export const UserProvider = ({ children }) => {
    const [settings, setSettings] = useState(defaultSettings)

    function setSettingsAndSaveToLocalStorage(newSettings: any) {
        setSettings(newSettings)
        Ipc.send('settings', 'setSettings', newSettings)

        return newSettings
    }

    useEffect(() => {

        const localSettings = localStorage.getItem('settings')
        if(localSettings !== null) {
            // We have a local settings item. Lets migrate to backend.
            console.log('Settings found in localStorage. migrating to backend:', localSettings)
            const migSetting = JSON.parse(localSettings)
            Ipc.send('settings', 'setSettings', migSetting).then(() => {
                console.log('Settings migrated. Removing from localStorage and loading from backend')
                localStorage.removeItem('settings')
                Ipc.send('settings', 'getSettings').then((settings) => {
                    setSettings(settings)
                }).catch((error) => {
                    console.log('Failed to migrate settings. Error:', error)
                })
            })
        } else {
            Ipc.send('settings', 'getSettings').then((settings) => {
                setSettings(settings)
            })
        }
        
    }, [])

    return <SettingsContext.Provider value={{ settings, setSettings: setSettingsAndSaveToLocalStorage }}>
        {children}
    </SettingsContext.Provider>
}
