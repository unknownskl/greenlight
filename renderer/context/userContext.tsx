import React, { useContext, useState } from 'react'

export const UserContext = React.createContext({
    consoles: undefined,
    setConsoles: async (consoles) => null,
})

export const useUser = () => useContext(UserContext)

export const UserProvider = ({ children }) => {
    const [consoles, setConsoles] = useState([])

    return <UserContext.Provider value={{ consoles, setConsoles }}>{children}</UserContext.Provider>
}