import React from 'react';
import Link from 'next/link';
import Ipc from '../lib/ipc'

// import { ipcRenderer } from 'electron'

interface HeaderProps {
  hidden?: boolean;
  gamertag: string;
  level: number;
  /**
   * Optional click handler
   */
  onClick?: () => void;
}

function Header({
  hidden = false,
  gamertag,
  level = 0,
  // links,
  ...props
}: HeaderProps) {

  // console.log('level:', level)
  const [headerLinks, setHeaderLinks] = React.useState([])

  function createLinks(level){
    return (level > 1) ? [
      {
        name: 'My Consoles',
        title: 'View consoles',
        url: '/home',
      },{
        name: 'xCloud Library',
        title: 'Browse xCloud library',
        url: '/xcloud/home'
      // },{
      //   name: 'Debug',
      //   title: 'Debug page',
      //   url: '/debug'
      },{
        name: 'Settings',
        title: 'Change application settings',
        url: '/settings/home'
      },{
        name: gamertag,
        title: 'View profile',
        url: '/profile'
      }
    ] : [
      {
        name: 'My Consoles',
        title: 'View consoles',
        url: '/home',
        active: true,
      },{
        name: 'Settings',
        title: 'Change application settings',
        url: '/settings/home'
      },{
        name: gamertag,
        title: 'View profile',
        url: '/profile'
      }
    ]
  }

  function setMenuActive(id) {
    const links = createLinks(level)
    links[id].active = true

    setHeaderLinks(links)
    return null
  }

  function drawMenu() {
    let linksHtml = []

    for(const link in headerLinks){
      linksHtml.push(<li key={ link }>
        <Link legacyBehavior href={ headerLinks[link].url } key={ headerLinks[link].url }>
          <a title={ headerLinks[link].title } onClick={ () => {setMenuActive(link)} } className={headerLinks[link].active === true ? 'active' : ''}>{ headerLinks[link].name }</a>
        </Link>
      </li>)
    }

    return linksHtml
  }

  function confirmQuit() {
    if(window.Greenlight.isWebUI() === true)
      return;
    
    if(confirm('Are you sure you want to quit?')){
      Ipc.send('app', 'quit')
    }
  }

  React.useEffect(() => {
    if(headerLinks.length <= 0 && !isNaN(level)){
      const links = createLinks(level)
      links[0].active = true
      setHeaderLinks(links)
    }
  })
  
  return (
    <React.Fragment>
        <div id="component_header" className={hidden === true ? 'disabled' : ''}>
          <a onClick={ confirmQuit } id="actionBarLogo" title="Home">
              <i className="fa-brands fa-xbox"></i>
          </a>

          <ul className="menu">
            { drawMenu() }
          </ul>
        </div>
    </React.Fragment>
  );
};

export default Header;
