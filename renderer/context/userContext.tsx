import React, { useContext, useState } from 'react'

export const UserContext = React.createContext({
    consoles: [],
    setConsoles: async (consoles) => null,
})
export const useUser = () => useContext(UserContext)

export const UserProvider = ({ children }) => {
    const [consoles, setConsoles] = useState([])

    return <UserContext.Provider value={{ consoles, setConsoles }}>
                    {children}
            </UserContext.Provider>
}



export const XcloudContext = React.createContext({
    xcloudTitles: [],
    setXcloudTitles: async (titles) => null,
})
export const useXcloud = () => useContext(XcloudContext)

export const XcloudProvider = ({ children }) => {
    const [xcloudTitles, setXcloudTitles] = useState([])

    return <XcloudContext.Provider value={{ xcloudTitles, setXcloudTitles }}>
                    {children}
            </XcloudContext.Provider>
}



export const SettingsContext = React.createContext({
    settings: undefined,
    setSettings: async (settings) => null,
})
export const useSettings = () => useContext(SettingsContext)

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        xhome_bitrate: 0,
        xcloud_bitrate: 0,
        controller_vibration: true
    })

    return <SettingsContext.Provider value={{ settings, setSettings }}> {children} </SettingsContext.Provider>
}