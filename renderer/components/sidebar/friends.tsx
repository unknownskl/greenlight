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

    const updateFriends = () => {
      Ipc.send('app', 'getOnlineFriends').then((onlineFriends) => {
        setOnlineFriends(onlineFriends)
      })
    }
    updateFriends()
    const friendsInterval = setInterval(updateFriends, 1000*15)

    return () => {
      clearInterval(friendsInterval)
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
