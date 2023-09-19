import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
// import { ipcRenderer } from 'electron'
import Ipc from '../lib/ipc'

import { useSettings } from '../context/userContext'

import Card from '../components/ui/card'
import Button from '../components/ui/button'

function Settings() {
  const [gamertag, setGamertag] = React.useState('Loading...');
  const { settings, setSettings} = useSettings()

  React.useEffect(() => {

    Ipc.send('app', 'loadCachedUser').then((user) => {
      console.log('Set user:', user)
      setGamertag(user.gamertag)
    })



    // ipcRenderer.send('auth', {
    //   type: 'get_user'
    // })

    // ipcRenderer.on('auth', (event, args) => {
    //   if(args.type === 'error'){
    //     alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)

    //   } else if(args.type === 'user') {
    //     setGamertag(args.gamertag)
    //   }
    // })

    const controllerInterval = setInterval(() => {
      drawControllers()
    }, 200)

    return () => {
      // ipcRenderer.removeAllListeners('auth');
      clearInterval(controllerInterval)
    };
  }, []);

  function confirmLogout() {
    if(confirm('Are you sure you want to logout?')){
      Ipc.send('app', 'clearData')
    }
  }

  function setxHomeBitrate(e){
    console.log('Set xHome bitrate to:', e.target.value)
    setSettings({
      ...settings,
      xhome_bitrate: parseInt(e.target.value)
    })
  }

  function setxCloudBitrate(e){
    console.log('Set xCloud bitrate to:', e.target.value)
    setSettings({
      ...settings,
      xcloud_bitrate: parseInt(e.target.value)
    })
  }

  function setControllerVibration(e){
    setSettings({
      ...settings,
      controller_vibration: (! settings.controller_vibration)
    })
  }

  function setTouchInput(e){
    setSettings({
      ...settings,
      input_touch: (! settings.input_touch)
    })
  }

  function setMKBInput(e){
    setSettings({
      ...settings,
      input_mousekeyboard: (! settings.input_mousekeyboard)
    })
  }

  function setLegacyInput(e){
    setSettings({
      ...settings,
      input_newgamepad: (! settings.input_newgamepad)
    })
  }

  function setVideoSize(e){
    setSettings({
      ...settings,
      video_size: e
    })
  }

  function drawControllers(){
    const gamepads = navigator.getGamepads()
    let controllerHtml = '<h1>Gamepads detected</h1> '
    controllerHtml += '<p>Below you can view the detected controllers with the amount of axes and buttons. The default Xbox controller has 4 axes, 17 buttons and dual-rumble. Press a button on the controller to active it</p> <div style="padding-left: 20px; padding-top: 10px;">'
    for(const gamepad in gamepads){

      if(gamepads[gamepad] !== null){
        // console.log(gamepads[gamepad])
        controllerHtml += '<p>#'+(parseInt(gamepad)+1)+' - '+ gamepads[gamepad].id +' (axes: '+ gamepads[gamepad].axes.length +', buttons: '+ gamepads[gamepad].buttons.length +', rumble: '+ ((gamepads[gamepad] as any).vibrationActuator !== undefined ? (gamepads[gamepad] as any).vibrationActuator.type : 'Not supported') +')</p>'
      } else {
        controllerHtml += '<p>#'+(parseInt(gamepad)+1)+' - No gamepad detected</p>'
      }
    }

    controllerHtml += '</div>'

    document.getElementById('settings_gamepad_layout').innerHTML = controllerHtml
  }
  
  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - Settings</title>
      </Head>
      <div style={{ paddingTop: '20px' }}>
        <Card className='padbottom'>
          <h1>Current user</h1>

          <p>
            Logged in as: {gamertag}
          </p>

          <Button label="Logout user" className="btn-small" onClick={ () => { confirmLogout() } }></Button>
        </Card>

        <Card className='padbottom'>
          <h1>xCloud</h1>

          <p>
            Below you can find some settings for xCloud.
          </p> <br />

          <p>
            Bitrate: <input type="range" min="0" max="102400" step="1024" value={settings.xcloud_bitrate} onChange={ setxCloudBitrate } />
            ({ settings.xcloud_bitrate == 0 ? settings.xcloud_bitrate + " (unlimited)" : Math.floor(settings.xcloud_bitrate / 1024) + " mbps" })
          </p>
        </Card>

        <Card className='padbottom'>
          <h1>xHomestreaming</h1>

          <p>
            Below you can find some settings for xHomestreaming.
          </p> <br />

          <p>
            Bitrate: <input type="range" min="0" max="102400" step="1024" value={settings.xhome_bitrate} onChange={ setxHomeBitrate } />
            ({ settings.xhome_bitrate == 0 ? settings.xhome_bitrate + " (unlimited)" : Math.floor(settings.xhome_bitrate / 1024) + " mbps" })
          </p>
        </Card>

        <Card className='padbottom'>
          <h1>Inputs</h1>

          <p>
            Enable vibration: &nbsp; 
            <label>
              <input type='checkbox' onChange={ setControllerVibration } checked={settings.controller_vibration} />&nbsp;
              Enable
            </label>
          </p>

          <p>
            Enable Touch input: &nbsp; 
            <label>
              <input type='checkbox' onChange={ setTouchInput } checked={settings.input_touch} />&nbsp;
              Enable
            </label>
          </p>

          <p>
            Enable Mouse & Keyboard: &nbsp; 
            <label>
              <input type='checkbox' onChange={ setMKBInput } checked={settings.input_mousekeyboard} />&nbsp;
              Enable
            </label>
          </p>

          <p>
            Enable new Gamepad driver: &nbsp; 
            <label>
              <input type='checkbox' onChange={ setLegacyInput } checked={settings.input_newgamepad} />&nbsp;
              Enable
            </label> <small>(Enable this if you want to use the Keyboard & Mouse input to avoid double input)</small>
          </p>

          <br />
          <div id='settings_gamepad_layout'>

          </div>
        </Card>

        <Card className='padbottom'>
          <h1>Video</h1>

          <p>
            Video size: &nbsp; 
            <select value={settings.video_size} onChange={(e) => {setVideoSize(e.target.value)}}>
              <option value='default'>Default</option>
              <option value='stretch'>Stretch</option>
              <option value='zoom'>Zoom</option>
            </select>
          </p>
        </Card>
      </div>
    </React.Fragment>
  );
};

export default Settings;
