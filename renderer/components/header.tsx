import React from 'react';
import Link from 'next/link';

import { ipcRenderer } from 'electron'

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

  console.log('level:', level)
  const [headerLinks, setHeaderLinks] = React.useState((level > 1) ? [
    {
      name: 'My Consoles',
      title: 'View consoles',
      url: '/home',
      active: true,
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
      url: '/settings'
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
      url: '/settings'
    },{
      name: gamertag,
      title: 'View profile',
      url: '/profile'
    }
  ])

  function setMenuActive(id) {
    for(const link in headerLinks){
      headerLinks[link].active = false
    }
    headerLinks[id].active = true
    return null
  }

  function drawMenu() {
    let linksHtml = []

    for(const link in headerLinks){
      linksHtml.push(<li key={ link }>
        <Link href={ headerLinks[link].url }>
          <a title={ headerLinks[link].title } onClick={ () => {setMenuActive(link)} } className={headerLinks[link].active === true ? 'active' : ''}>{ headerLinks[link].name }</a>
        </Link>
      </li>)
    }

    return linksHtml
  }

  function confirmQuit() {
    if(confirm('Are you sure you want to quit?')){
      ipcRenderer.send('auth', {
        type: 'quit'
      })
    }
  }
  
  return (
    <React.Fragment>
        <div id="component_header" className={hidden === true ? 'disabled' : ''}>
          <a onClick={ confirmQuit } id="actionBarLogo" title="Home">
              <svg viewBox="0 0 2048 2048" width="30" height="30"><path d="M492 158q-4 0-5-1v-2l2-3Q614 77 746 39t278-39q143 0 277 38t256 113l3 2q-3 5-6 5-8 0-17-2t-17-4q-9-1-18-1t-18 0q-47 0-95 9t-96 24-92 34-88 39q-22 11-44 21t-43 25h-5q-43-27-100-54t-120-49-123-36-113-14q-19 0-39 4t-34 4zm251 412q-44 53-101 128T525 862t-117 184-102 189-72 180-28 156q0 17 2 37t8 36l-1 2-2 1-4-2q-103-139-156-293T0 1024q0-98 20-199t60-196 96-180 130-153q5-4 15-5t15-2q30 0 66 14t75 38 76 53 74 60 65 59 51 50l1 4-1 3zm968-281q7 0 16 1t15 6q73 71 130 155t96 178 59 194 21 201q0 173-53 328t-156 293l-6 1-2-3q3-4 5-14t3-21 2-22 1-16q0-69-27-155t-72-180-102-190-117-184-117-163-102-129l-1-3 1-3q21-21 50-49t65-58 73-61 77-53 75-38 66-15zm-687 533q29 18 56 42t54 47q42 37 102 94t127 128 131 149 117 155 84 149 32 129q0 23-6 43t-23 37q-31 31-69 57t-76 49q-120 72-254 109t-275 38q-141 0-274-37t-255-110q-17-10-43-26t-51-37-47-40-27-39q-7-20-7-45 0-54 30-122t78-142 110-149 123-142 118-123 97-92q34-30 72-64t76-58z"></path></svg>
          </a>

          <ul className="menu">
            { drawMenu() }
          </ul>
        </div>
    </React.Fragment>
  );
};

export default Header;
