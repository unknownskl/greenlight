import React from 'react'
import Link from 'next/link'
import {useRouter} from 'next/router'

interface SettingsSidebarProps {
  children: any;
}

function SettingsSidebar({
    children,
    ...props
}: SettingsSidebarProps) {
    const router = useRouter()

    // console.log(router.pathname, router.pathname.includes('settings/home'))

    return (
        <React.Fragment>
            <div id="component_settings_sidebar">
                <div id="component_settings_sidebar_menu">
                    <ul>
                        <li className={ router.pathname.includes('settings/home') ? 'active' : ''}><Link href="/settings/home">About</Link></li>
                        <li className={ router.pathname.includes('settings/streaming') ? 'active' : ''}><Link href="/settings/streaming">Streaming</Link></li>
                        <li className={ router.pathname.includes('settings/input') ? 'active' : ''}><Link href="/settings/input">Input</Link></li>
                        <li className={ router.pathname.includes('settings/video') ? 'active' : ''}><Link href="/settings/video">Video & Audio</Link></li>
                        <li className={ router.pathname.includes('settings/webui') ? 'active' : ''}><Link href="/settings/webui">Web UI</Link></li>
                        <li className={ router.pathname.includes('settings/debug') ? 'active' : ''}><Link href="/settings/debug">Debug</Link></li>
                    </ul>
                </div>

                <div id="component_settings_sidebar_content">
                    { children }
                </div>
            </div>
        </React.Fragment>
    )
}

export default SettingsSidebar
