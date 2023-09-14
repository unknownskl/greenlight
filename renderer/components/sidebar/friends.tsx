import React from 'react';
// import { ipcRenderer } from 'electron';
import Ipc from '../../lib/ipc'
import SidebarFriendItem from './frienditem'

interface SidebarFriendsProps {
  // friends:[];
}

function SidebarFriends({
  // friends = [],
  ...props
}: SidebarFriendsProps) {
  const [onlineFriends, setOnlineFriends] = React.useState([])

  React.useEffect(() => {

    // ipcRenderer.on('xbox_friends', (event, friends) => {
    //   setOnlineFriends(friends)
    // })

    const ipcListener = Ipc.onAction('app', 'onlineFriends', (event, onlineFriends) => {
      setOnlineFriends(onlineFriends)
    })

    return () => {
      // ipcRenderer.removeAllListeners('stream');
      Ipc.removeListener('app', ipcListener)
    };
  }, []);
  
  return (
    <React.Fragment>
      <div id="components_sidebarfriends" key="components_sidebarfriends">
        {(onlineFriends.length > 0) ? onlineFriends.map((item:any, i) => {               
           return (
            <SidebarFriendItem key={ item.xuid } userinfo={ item }></SidebarFriendItem>
           ) 
        }) : <div className='components_sidebarfrienditem'><div className='components_sidebarfrienditem_userdetails'><p>All your friends are offline</p></div></div> }
      </div>
    </React.Fragment>
  );
};

export default SidebarFriends;
