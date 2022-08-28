import React from 'react';
import Link from 'next/link';
import { ipcRenderer } from 'electron';

import Card from '../components/ui/card'
import Button from './ui/button';

interface AuthProps {
  signedIn: boolean
  gamertag?: string
  gamerpic?: string
  gamerscore?: string
}

function Auth({
  signedIn = false,
  gamertag,
  gamerpic,
  gamerscore,
  ...props
}: AuthProps) {

  function startAuthFlow(){
    ipcRenderer.send('auth', {
      type: 'login'
    })
  }
  
  return (
    <React.Fragment>
        <div id="component_auth">

          <div id="component_auth_modal">
            <Card>
              {signedIn === true ? (<div className="component_auth_profile_container">
                <div className="component_auth_profile_gamerpic">
                  <img src={ gamerpic } className="component_auth_profile_gamerpic_img" />
                </div>

                <div className="component_auth_profile_userdetails">
                  <h1>{ gamertag }</h1>
                  <p>
                    Gamerscore: { gamerscore }
                  </p>
                  {/* <p>
                    { 'Logging in...' }
                  </p> */}
                  <Button label="Login" className='btn-primary' onClick={ () => { startAuthFlow() } }></Button>
                </div>

              </div>) : (<div style={ {
                textAlign: 'center',
                paddingBottom: '20px'
              }}>
                <h1>Login with Xbox</h1>
                
                <p>
                  Please authenticate below to access xCloud and xHome Streaming
                </p>

                <Button label="Login" className='btn-primary' onClick={ () => { startAuthFlow() } }></Button>
              </div>) }
            </Card>
          </div>
        </div>
    </React.Fragment>
  );
};

export default Auth;
