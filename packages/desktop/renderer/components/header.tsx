import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Ipc from '../lib/ipc'
import { useTranslation } from 'react-i18next'

// import { ipcRenderer } from 'electron'

interface HeaderProps {
  hidden?: boolean;
  gamertag: string;
  level: number;
}

function Header({
    hidden = false,
    gamertag,
    level = 0,
}: HeaderProps) {
    const { t } = useTranslation()
    const router = useRouter()

    // console.log('level:', level)
    const [headerLinks, setHeaderLinks] = React.useState([]);

    function createLinks(level){
        return (level > 1) ? [
            {
                name: t('header.myConsoles'),
                title: t('header.viewConsoles'),
                url: '/home',
                active: false,
            }, {
                name: t('header.xCloudLibrary'),
                title: t('header.browseXCloudLibrary'),
                url: '/xcloud/home',
                active: false,
                // },{
                //   name: 'Debug',
                //   title: 'Debug page',
                //   url: '/debug'
            }, {
                name: t('header.settings'),
                title: t('header.changeSettings'),
                url: '/settings/home',
                active: false,
            }, {
                name: gamertag,
                title: t('header.viewProfile'),
                url: '/profile',
                active: false,
            },
        ] : [
            {
                name: t('header.myConsoles'),
                title: t('header.viewConsoles'),
                url: '/home',
                active: false,
            }, {
                name: t('header.settings'),
                title: t('header.changeSettings'),
                url: '/settings/home',
                active: false,
            }, {
                name: gamertag,
                title: t('header.viewProfile'),
                url: '/profile',
                active: false,
            },
        ]
    }

    // The active entry follows the current page (same first path segment), however the page was opened
    function isActive(url: string) {
        return url.split('/')[1] === router.pathname.split('/')[1]
    }

    function drawMenu() {
        return headerLinks.map((link) => (
            <li key={link.url}>
                <Link legacyBehavior href={link.url} key={link.url}>
                    <a title={link.title} className={isActive(link.url) ? 'active' : ''}>{link.name}</a>
                </Link>
            </li>
        ));
    }

    function confirmQuit() {
        if(window.Greenlight.isWebUI() === true)
            return

        if(confirm(t('header.quitQuestion'))){
            Ipc.send('app', 'quit')
        }
    }

    React.useEffect(() => {
        if (!isNaN(level)) {
            setHeaderLinks(createLinks(level));
        }
    }, [level, t, gamertag]);

    return (
        <React.Fragment>
            <div id="component_header" className={hidden === true ? 'disabled' : ''}>
                <a onClick={ confirmQuit } id="actionBarLogo" title={t('header.home')}>
                    <i className="fa-brands fa-xbox"></i>
                </a>

                <ul className="menu">
                    { drawMenu() }
                </ul>
            </div>
        </React.Fragment>
    )
}

export default Header
