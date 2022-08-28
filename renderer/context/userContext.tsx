import React, { useContext, useState } from 'react'

export const UserContext = React.createContext({
    consoles: [],
    setConsoles: async (consoles) => null,
})

export const settingsContext = React.createContext({
    settings: undefined,
    setSettings: async (settings) => null,
})

export const useUser = () => useContext(UserContext)
export const useSettings = () => useContext(settingsContext)

export const UserProvider = ({ children }) => {
    const [consoles, setConsoles] = useState([])

    return <UserContext.Provider value={{ consoles, setConsoles }}>
                    {children}
            </UserContext.Provider>
}

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({})

    return <settingsContext.Provider value={{ settings, setSettings }}> {children} </settingsContext.Provider>
}