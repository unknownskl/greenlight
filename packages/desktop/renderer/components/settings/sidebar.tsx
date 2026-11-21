import React from 'react'
import Link from 'next/link'
import {useRouter} from 'next/router'
import { useTranslation } from 'react-i18next'

interface SettingsSidebarProps {
  children: any;
}

function SettingsSidebar({
    children,
}: SettingsSidebarProps) {
    const router = useRouter()
    const { t } = useTranslation()

    return (
        <React.Fragment>
            <div id="component_settings_sidebar">
                <div id="component_settings_sidebar_menu">
                    <ul>
                        <li className={ router.pathname.includes('settings/home') ? 'active' : ''}><Link href="/settings/home">{t('settings.sidebar.about')}</Link></li>
                        <li className={ router.pathname.includes('settings/streaming') ? 'active' : ''}><Link href="/settings/streaming">{t('settings.sidebar.streaming')}</Link></li>
                        <li className={ router.pathname.includes('settings/input') ? 'active' : ''}><Link href="/settings/input">{t('settings.sidebar.input')}</Link></li>
                        <li className={ router.pathname.includes('settings/video') ? 'active' : ''}><Link href="/settings/video">{t('settings.sidebar.videoAudio')}</Link></li>
                        <li className={ router.pathname.includes('settings/translator') ? 'active' : ''}><Link href="/settings/translator">{t('translator.sidebar')}</Link></li>
                        <li className={ router.pathname.includes('settings/webui') ? 'active' : ''}><Link href="/settings/webui">{t('settings.sidebar.webUI')}</Link></li>
                        <li className={ router.pathname.includes('settings/debug') ? 'active' : ''}><Link href="/settings/debug">{t('settings.sidebar.debug')}</Link></li>
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
