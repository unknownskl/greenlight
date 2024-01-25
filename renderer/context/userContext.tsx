import React, { useContext, useEffect, useState } from 'react'

// export const UserContext = React.createContext({
//     consoles: [],
//     setConsoles: (consoles) => null,
// })
// export const useUser = () => useContext(UserContext)

// export const XcloudContext = React.createContext({
//     xcloudTitles: [],
//     setXcloudTitles: (titles) => null,
// })
// export const useXcloud = () => useContext(XcloudContext)

export const SettingsContext = React.createContext({
    settings: undefined,
    setSettings: (settings) => null,
})
export const useSettings = () => useContext(SettingsContext)

// export const AchievementsContext = React.createContext({
//     achievements: undefined,
//     setAchievements: (settings) => null,
// })
// export const useAchievements = () => useContext(AchievementsContext)

export const UserProvider = ({ children }) => {
    const [consoles, setConsoles] = useState([])
    const [xcloudTitles, setXcloudTitles] = useState([])
    const [settings, setSettings] = useState({
        xhome_bitrate: 0,
        xcloud_bitrate: 0,
        video_profiles: [],
        controller_vibration: true,
        video_size: 'default',
        force_region_ip: '',
	    input_touch: false,
        input_mousekeyboard: false,
        input_newgamepad: false,
    })
    const [achievements, setAchievements] = useState([])

    function setSettingsAndSaveToLocalStorage(newSettings: any) {
        console.log('Saving settings to localStorage', newSettings)
        setSettings(newSettings)
        localStorage.setItem("settings", JSON.stringify(newSettings))
        return newSettings
    }

    // Check for missing keys and update if needed.


    useEffect(() => {
        const localSettings = localStorage.getItem('settings')
        const mergedSettings = { ...settings, ...JSON.parse(localSettings) }
        console.log('Loading settings from localStorage', mergedSettings)
        if (localSettings) {
            setSettings(mergedSettings)
	    }
    }, [])

    // return <UserContext.Provider value={{ consoles, setConsoles }}>
    //     <XcloudContext.Provider value={{ xcloudTitles, setXcloudTitles }}>
    //         <SettingsContext.Provider value={{ settings, setSettings: setSettingsAndSaveToLocalStorage }}>
    //             <AchievementsContext.Provider value={{ achievements, setAchievements }}>
    //                 {children}
    //             </AchievementsContext.Provider>
    //         </SettingsContext.Provider>
    //     </XcloudContext.Provider>
    // </UserContext.Provider>

    return <SettingsContext.Provider value={{ settings, setSettings: setSettingsAndSaveToLocalStorage }}>
        {/* <AchievementsContext.Provider value={{ achievements, setAchievements }}> */}
            {children}
        {/* </AchievementsContext.Provider> */}
    </SettingsContext.Provider>
}
