import Link from 'next/link';
import React from 'react';
import Button from '../ui/button';
import Image from 'next/image';

interface SidebarFriendItemProps {
  userinfo;
}

function SidebarFriendItem({
  userinfo,
  ...props
}: SidebarFriendItemProps) {
  // console.log(userinfo)

  function drawPresence(){

    for(const app in userinfo.presenceDetails){
      if(userinfo.presenceDetails[app].IsGame && userinfo.presenceDetails[app].IsPrimary){
        return userinfo.presenceDetails[app].PresenceText
        // return userinfo.presenceDetails[app].RichPresenceText || userinfo.presenceDetails[app].PresenceText
      }
    }
    
    return userinfo.presenceText
  }

  return (
    <React.Fragment>
      <div className='components_sidebarfrienditem' key={userinfo.xuid}>
        <div style={ { display: 'flex' }}>
          <div className="components_sidebarfrienditem_gamerpic" style={ {
            borderColor: '#' + userinfo.preferredColor.primaryColor
          }}>
            <Image alt="Gamerpic" className='components_sidebarfrienditem_gamerpic_img' width='45' height='45' loading='lazy' src={userinfo.displayPicRaw.replace('&mode=Padding', '')} />
          </div>
          
          <div className='components_sidebarfrienditem_userdetails'>
            <div>
              <h1>{userinfo.displayName}</h1>
              <p>{drawPresence()}</p>
            </div>
            {/* <div className='components_sidebarfrienditem_useroptions'>
              <Link href={ '/profile/'+userinfo.xuid }>
                <Button label="profile" className='btn-small'></Button>
              </Link>
            </div> */}
            {/* <p style={ { color: '#'+userinfo.preferredColor.primaryColor }}>{userinfo.preferredColor.primaryColor}</p>
            <p style={ { color: '#'+userinfo.preferredColor.secondaryColor }}>{userinfo.preferredColor.secondaryColor}</p>
            <p style={ { color: '#'+userinfo.preferredColor.tertiaryColor }}>{userinfo.preferredColor.tertiaryColor}</p> */}
          </div>
        </div>
        
      </div>
    </React.Fragment>
  );
};

export default SidebarFriendItem;
