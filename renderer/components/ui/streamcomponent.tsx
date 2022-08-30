import { ipcRenderer } from 'electron'
import Link from 'next/link';
import Router from 'next/router';
import React from 'react';
import Button from './button'
import xPlayer from 'xbox-xcloud-player'

interface StreamComponentProps {
  hidden?: boolean;
  onDisconnect?: () => void;
  onMenu?: () => void;
  xPlayer: xPlayer;
}

function StreamComponent({
  hidden = true,
  onDisconnect,
  onMenu,
  xPlayer,
  ...props
}: StreamComponentProps) {

  let lastMovement = 0
  let gamebarElement = document.getElementById('component_streamcomponent_gamebar')
  let debugElement = document.getElementById('component_streamcomponent_debug')

  React.useEffect(() => {

    // Gamebar menu mouse events
    const mouseEvent = (e) => {
      lastMovement = Date.now()
    }
    window.addEventListener('mousemove', mouseEvent)
    window.addEventListener('mousedown', mouseEvent)

    const mouseInterval = setInterval(() => {
      if(gamebarElement === null){
        gamebarElement = document.getElementById('component_streamcomponent_gamebar')
        return;
      }

      if((Date.now()-lastMovement) >= 2000){
        if(! gamebarElement.className.includes('hidden')){
          gamebarElement.className = 'hidden'
        }
      } else {
        if(gamebarElement.className.includes('hidden')){
          gamebarElement.className = ''
        }
      }
    }, 100)

    // Keyboard events
    const keyboardPressEvent = (e) => {
      switch(e.keyCode){
        case 126:
            toggleDebug()
            break;
      }
    }
    window.addEventListener('keypress', keyboardPressEvent)
  
    // cleanup this component
    return () => {
        window.removeEventListener('mousemove', mouseEvent)
        window.removeEventListener('mousedown', mouseEvent)
        window.removeEventListener('keypress', keyboardPressEvent)
        clearInterval(mouseInterval)
    };
  }, []);

  function streamDisconnect(){
    // ipcRenderer.send('stream', {
    //   type: 'stop_stream'
    // })
    document.getElementById('streamComponentHolder').innerHTML = ''
    Router.push('/home')
  }

  function toggleDebug(){
    if(debugElement === null){
      debugElement = document.getElementById('component_streamcomponent_debug')
    }

    if(debugElement.className.includes('hidden')){
      debugElement.className = ''
    } else {
      debugElement.className = 'hidden'
    }
  }

  return (
    <React.Fragment>
      <div>
        <div id="streamComponentHolder">
        </div>

        <div id="component_streamcomponent_gamebar">
          <div id="component_streamcomponent_gamebar_menu">
            <Button label="Disconnect" className='btn-cancel' onClick={ () => { streamDisconnect() } }></Button>
            <Button label="Menu" onClick={ onMenu }></Button>

            <div style={{
              marginLeft: 'auto',
              marginRight: 20
            }}>
              <Button label="Debug" onClick={ () => { toggleDebug() } }></Button>
            </div>
          </div>
        </div>

        <div id="component_streamcomponent_debug" className='hidden'>
          Debug:<br />

          <Button label="Disconnect" onClick={ () => { streamDisconnect() } }></Button>
        </div>
      </div>
    </React.Fragment>
  );
};

export default StreamComponent;
