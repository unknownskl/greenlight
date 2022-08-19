import React from 'react';
import Link from 'next/link';

import Button from './ui/button'

interface HeaderProps {
  hidden?: boolean;
  connected?: boolean;
}

function Footer({
  hidden = true,
  connected,
  ...props
}: HeaderProps) {

  function getStatus(){
    if(connected === true){
      return 'Connected to: XX000000000000'
    } else {
      return 'Not connected'
    }
  }
  function getCurrentApp(){
    return {
      name: 'Subnautica',
      media_logo: 'https://store-images.s-microsoft.com/image/apps.19794.63409341877910445.4fd452e1-c3ee-4448-a0f8-ac6eb6bdaabf.8fe60020-9cc9-42c9-af2a-bf7b08cb5e13'
    }
  }
  
  return (
    <React.Fragment>
        <div id="component_footer" className={hidden === true ? 'disabled' : connected === true ? 'connected' : 'disconnected'}>
          <p className='status'>{getStatus()}</p>

          <div className='current_app'>
            <img className='current_app_logo' src={getCurrentApp().media_logo}></img>

            <p className='current_app_name'>{getCurrentApp().name}</p>

            <div className='current_app_actions'>
              <Button className="btn-primary" label="Open in Store" />
              <Button className="btn-grey" label="Open Smartglass companion" />
              <Button className="btn-grey" label="Start stream" />
            </div>
          </div>
        </div>
    </React.Fragment>
  );
};

export default Footer;
