import React, { useContext, useState } from 'react'

export const UserContext = React.createContext({
    consoles: [],
    setConsoles: async (consoles) => null,
})
export const useUser = () => useContext(UserContext)



export const XcloudContext = React.createContext({
    xcloudTitles: [],
    setXcloudTitles: async (titles) => null,
})
export const useXcloud = () => useContext(XcloudContext)



export const SettingsContext = React.createContext({
    settings: undefined,
    setSettings: async (settings) => null,
})
export const useSettings = () => useContext(SettingsContext)

export const AchievementsContext = React.createContext({
    achievements: undefined,
    setAchievements: async (settings) => null,
})
export const useAchievements = () => useContext(AchievementsContext)



export const UserProvider = ({ children }) => {
    const [consoles, setConsoles] = useState([])
    const [xcloudTitles, setXcloudTitles] = useState([])
    const [settings, setSettings] = useState({
        xhome_bitrate: 0,
        xcloud_bitrate: 0,
        controller_vibration: true
    })
    const [achievements, setAchievements] = useState([])


    return <UserContext.Provider value={{ consoles, setConsoles }}>
        <XcloudContext.Provider value={{ xcloudTitles, setXcloudTitles }}>
            <SettingsContext.Provider value={{ settings, setSettings }}>
                <AchievementsContext.Provider value={{ achievements, setAchievements }}>
                    {children}
                </AchievementsContext.Provider>
            </SettingsContext.Provider>
        </XcloudContext.Provider>
    </UserContext.Provider>
}