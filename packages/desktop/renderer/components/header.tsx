import React from 'react'
import Link from 'next/link'
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

    // console.log('level:', level)
    const [activeIndex, setActiveIndex] = React.useState(0);
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

    function setMenuActive(id) {
        setActiveIndex(id);
    }

    function drawMenu() {
        return headerLinks.map((link, idx) => (
            <li key={idx}>
                <Link legacyBehavior href={link.url} key={link.url}>
                    <a href={link.url} title={link.title} onClick={() => setMenuActive(idx)} className={idx === activeIndex ? 'active' : ''}>{link.name}</a>
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

    function handleLogoKeyDown(e: React.KeyboardEvent<HTMLAnchorElement>) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            confirmQuit()
        }
    }

    React.useEffect(() => {
        if (!isNaN(level)) {
            const links = createLinks(level).map((link, idx) => ({ ...link, active: idx === activeIndex }));
            setHeaderLinks(links);
        }
    }, [level, t, activeIndex]);

    return (
        <React.Fragment>
            <div id="component_header" className={hidden === true ? 'disabled' : ''}>
                <a onClick={ confirmQuit } onKeyDown={ handleLogoKeyDown } id="actionBarLogo" title={t('header.home')} role="button" tabIndex={0}>
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
