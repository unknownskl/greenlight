import React from 'react';
import Link from 'next/link';

import Card from '../components/ui/card'

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

  // const [loginCounter, setLoginCounter] = React.useState(0);

  // React.useEffect(() => { 
  //   const loginInterval = setInterval(() => {
  //     console.log(loginCounter)
  //     if(loginCounter >= 3){
  //       setLoginCounter(0)
  //     } else {
  //       const newCounter = loginCounter+1
  //       console.log('new counter:', newCounter)
  //       setLoginCounter(newCounter)
  //     }
  //   }, 1000)

  //   return () => {
  //       clearInterval(loginInterval)
  //   };
  // }, []);
  
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
                  <p>
                    { 'Logging in...' }
                  </p>
                </div>

              </div>) : (<div>Login</div>) }
            </Card>
          </div>
        </div>
    </React.Fragment>
  );
};

export default Auth;
