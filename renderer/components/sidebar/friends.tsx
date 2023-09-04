import React from 'react';
import { ipcRenderer } from 'electron';
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

    ipcRenderer.on('xbox_friends', (event, friends) => {
      setOnlineFriends(friends)
    })

    return () => {
      ipcRenderer.removeAllListeners('stream');
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
