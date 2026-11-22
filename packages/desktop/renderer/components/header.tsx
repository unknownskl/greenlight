import React from 'react'
import Link from 'next/link'
import Ipc from '../lib/ipc'
import { confirmDialog } from '../lib/gamepad/dialog'
import { useTranslation } from 'react-i18next'

// import { ipcRenderer } from 'electron'

interface HeaderProps {
  hidden?: boolean;
  gamertag: string;
  gamerpic?: string;
  gamerscore?: string | number;
  level: number;
}

function formatClock(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function Header({
    hidden = false,
    gamertag,
    gamerpic,
    gamerscore,
    level = 0,
}: HeaderProps) {
    const { t } = useTranslation()

    // Clock in the corner, like on a console dashboard
    const [clock, setClock] = React.useState('')
    React.useEffect(() => {
        setClock(formatClock())
        const clockInterval = setInterval(() => setClock(formatClock()), 15*1000)

        return () => clearInterval(clockInterval)
    }, [])

    // console.log('level:', level)
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [headerLinks, setHeaderLinks] = React.useState([]);

    function createLinks(level){
        return (level > 1) ? [
            {
                name: t('header.myConsoles'),
                title: t('header.viewConsoles'),
                url: '/home',
                icon: 'fa-gamepad',
                active: false,
            }, {
                name: t('header.xCloudLibrary'),
                title: t('header.browseXCloudLibrary'),
                url: '/xcloud/home',
                icon: 'fa-cloud',
                active: false,
                // },{
                //   name: 'Debug',
                //   title: 'Debug page',
                //   url: '/debug'
            }, {
                name: t('header.settings'),
                title: t('header.changeSettings'),
                url: '/settings/home',
                icon: 'fa-gear',
                active: false,
            }, {
                name: gamertag,
                title: t('header.viewProfile'),
                url: '/profile',
                profile: true,
                active: false,
            },
        ] : [
            {
                name: t('header.myConsoles'),
                title: t('header.viewConsoles'),
                url: '/home',
                icon: 'fa-gamepad',
                active: false,
            }, {
                name: t('header.settings'),
                title: t('header.changeSettings'),
                url: '/settings/home',
                icon: 'fa-gear',
                active: false,
            }, {
                name: gamertag,
                title: t('header.viewProfile'),
                url: '/profile',
                profile: true,
                active: false,
            },
        ]
    }

    function setMenuActive(id) {
        setActiveIndex(id);
    }

    function drawMenu() {
        return headerLinks.map((link, idx) => (
            <li key={idx} className={link.profile ? 'header-profile' : ''}>
                <Link legacyBehavior href={link.url} key={link.url}>
                    <a title={link.title} onClick={() => setMenuActive(idx)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setMenuActive(idx) } }} className={idx === activeIndex ? 'active' : ''}>
                        { link.profile ? (gamerpic ? <img className="header-gamerpic" src={gamerpic} alt="" /> : <i className="fa-solid fa-user"></i>) : <i className={'fa-solid ' + link.icon}></i> }
                        <span>{link.name}</span>
                    </a>
                </Link>
            </li>
        ));
    }

    function confirmQuit() {
        if(window.Greenlight.isWebUI() === true)
            return

        confirmDialog(t('header.quitQuestion'), t('gamepad.yes'), t('gamepad.no')).then((confirmed) => {
            if(confirmed){
                Ipc.send('app', 'quit')
            }
        })
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
                <a onClick={ confirmQuit } id="actionBarLogo" title={t('header.home')}>
                    <i className="fa-brands fa-xbox"></i>
                </a>

                <ul className="menu">
                    { drawMenu() }
                </ul>

                <div className="header-status">
                    { (gamerscore !== undefined && gamerscore !== '') ? <span className="header-gamerscore"><b>G</b>{ gamerscore }</span> : '' }
                    <span className="header-clock">{ clock }</span>
                </div>
            </div>
        </React.Fragment>
    )
}

export default Header
