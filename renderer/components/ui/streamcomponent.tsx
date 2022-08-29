import { ipcRenderer } from 'electron'
import Link from 'next/link';
import Router from 'next/router';
import React from 'react';
import Button from './button'

interface StreamComponentProps {
  hidden?: boolean;
  onDisconnect?: () => void;

}

function StreamComponent({
  hidden = true,
  onDisconnect,
  ...props
}: StreamComponentProps) {

  let lastMovement = 0
  let gamebarElement = document.getElementById('component_streamcomponent_gamebar')
  let debugElement = document.getElementById('component_streamcomponent_debug')

  React.useEffect(() => {

    const mouseEvent = (e) => {
      lastMovement = Date.now()
    }
    window.addEventListener('mousemove', mouseEvent)
    window.addEventListener('mousedown', mouseEvent)
    const mouseInterval = setInterval(() => {
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
  
    // cleanup this component
    return () => {
        window.removeEventListener('mousemove', mouseEvent)
        window.removeEventListener('mousedown', mouseEvent)
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
            <Button label="Menu" onClick={ () => { streamDisconnect() } }></Button>

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
