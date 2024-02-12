import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Ipc from '../../lib/ipc';

import SettingsSidebar from '../../components/settings/sidebar';
import Image from 'next/image';
import GreenlightLogo from '../../public/images/logo.png';
import Card from '../../components/ui/card';
import Button from '../../components/ui/button';

interface userData {
  gamerpic?: string
  gamerscore?: string
  gamertag?: string
  level?: number
  signedIn?: boolean
  type?: string
}

function SettingsHome() {
  const [user, setUser] = React.useState<userData>({});

  React.useEffect(() => {
    if(Object.keys(user).length == 0){
      Ipc.send('app', 'loadCachedUser').then((user) => {
        console.log('Set user:', user)
        setUser(user)
      })
    }
  })

  function logout(){
    if(confirm('Are you sure you want to logout?')){
      Ipc.send('app', 'clearData')
    }
  }

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - Settings</title>
      </Head>

      <SettingsSidebar>
          <Card>
            <div id="component_auth_modal">
              <div className="component_auth_profile_gamerpic" style={{
                float: 'left',
                marginTop: 20,
                marginLeft: 20,
                marginRight: 40
              }}>
              <Image src={ user.gamerpic } alt={ user.gamertag } width='100' height='100' className="component_auth_profile_gamerpic_img" />
              </div>

              <div className="component_auth_profile_userdetails">
                <h1 style={{ paddingBottom: 5 }}>{ user.gamertag }</h1>
                <p>
                  Gamerscore: { user.gamerscore }
                </p>
                <Button label="Logout" className='btn' disabled={(window.Greenlight.isWebUI() === false) ? false : true } onClick={ () => { logout() } }></Button>
              </div>

              <br style={{ clear: 'both' }} />
            </div>
          </Card>

          <Card>
              <div style={{ textAlign: 'center' }}>
                  <Image src={ GreenlightLogo } width="100" height="100" alt="Greenlight" />

                  <h2>Greenlight</h2>
                  <p>
                    Version: { window.Greenlight.getVersion() }<br /><br />
                    <small>Website: <Link href="#" title="Open link in external browser" onClick={ () => {
                      window.Greenlight.openExternal('https://www.github.com/unknownskl/greenlight')
                  }}>github.com/unknownskl/greenlight</Link></small>
                  </p>
              </div>
          </Card>
      </SettingsSidebar>
      

    </React.Fragment>
  );
};

export default SettingsHome;
