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

  function streamDisconnect(){
    // ipcRenderer.send('stream', {
    //   type: 'stop_stream'
    // })
    document.getElementById('streamComponentHolder').innerHTML = ''
    Router.push('/home')
  }

  return (
    <React.Fragment>
      <div>
        <div id="streamComponentHolder">
        </div>

        {/* <div id="component_streamcomponent_debug">
          Debug:<br />

          <Button label="Disconnect" onClick={ () => { streamDisconnect() } }></Button>
        </div> */}
      </div>
    </React.Fragment>
  );
};

export default StreamComponent;
