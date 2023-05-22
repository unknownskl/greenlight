import React from 'react';
import Head from 'next/head'
import Link from 'next/link'
import { Router, useRouter } from 'next/router'
import { ipcRenderer } from 'electron'
import xCloudPlayer from 'xbox-xcloud-player'

import { useSettings } from '../../context/userContext'

import Header from '../../components/header'
import StreamComponent from '../../components/ui/streamcomponent'


function Stream() {
  const router = useRouter()
  // const [streamStarted, setStreamStarted] = React.useState(false)
  // const [xPlayer, setxPlayer] = React.useState(new xCloudPlayer('videoHolder', {
  //   ui_systemui: [19]
  // }));
  const { settings, setSettings} = useSettings()

  // let rerenderTimeout
  let keepaliveInterval

  let xPlayer = new xCloudPlayer('streamComponent', {
    ui_systemui: []
  })

  xPlayer.setControllerRumble(settings.controller_vibration)

  xPlayer.getEventBus().on('connectionstate', (event) => {
    console.log('connectionstate changed:', event)

    const connStatus = document.getElementById('component_streamcomponent_connectionstatus')
    if(connStatus !== null){
      if(event.state == 'connected'){
        connStatus.innerText = 'Client has been connected!'
        document.getElementById('component_streamcomponent_loader').className = 'hidden'

        // Start keepalive loop

        keepaliveInterval = setInterval(() => {
          ipcRenderer.send(((router.query.serverid as string).substr(0, 6) == 'xcloud') ? 'xcloud' : 'stream', {
            type: 'keepalive'
          })
        }, 30000) // Send every 30 seconds

      } else if(event.state == 'new'){
        connStatus.innerText = 'Starting connection...'

      } else if(event.state == 'connecting'){
        connStatus.innerText = 'Connecting to console...'

      } else if(event.state == 'closed') {
        // Client has been disconnected. Lets return to home.
        // (Router as any).back()
        xPlayer.reset()
      }
    }
  })

  React.useEffect(() => {
    document.getElementById('streamComponentHolder').innerHTML = '<div id="streamComponent" class="size_'+settings.video_size+'"></div>'

    let ipc_channel = 'stream'
    let serverId = router.query.serverid
    if((router.query.serverid as string).substr(0, 6) == 'xcloud'){
      ipc_channel = 'xcloud'
      serverId = (router.query.serverid as string).substr(7)
    }

    ipcRenderer.send(ipc_channel, {
      type: 'start_stream',
      data: {
        type: 'home',
        serverId: serverId
      }
    })

    if((ipc_channel === 'xcloud') ? settings.xcloud_bitrate : settings.xhome_bitrate > 0){
      xPlayer.setVideoBitrate((ipc_channel === 'xcloud') ? settings.xcloud_bitrate : settings.xhome_bitrate)
    }

    ipcRenderer.on(ipc_channel, (event, args) => {
      if(args.type === 'error') {
        alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)

      } else if(args.type === 'start_stream'){
        if(args.data.state === 'Provisioned'){
          xPlayer.createOffer().then((offer:any) => {
            // console.log('sdp:', setMediaBitrates(offer.sdp, (ipc_channel == 'home') ? settings.xhome_bitrate || 4096 : settings.xcloud_bitrate || 2048))

            ipcRenderer.send(ipc_channel, {
              type: 'start_stream_sdp',
              data: {
                sdp: offer.sdp
                // sdp: (ipc_channel == 'home') ? setMediaBitrates(offer.sdp, settings.xhome_bitrate || 4096) : offer.sdp
              }
            })
          })
        } else {
          alert('Console state is '+args.data.state+', expected Provisioned.\n'+args.data.errorDetails.message)
        }
      } else if(args.type === 'start_stream_sdp'){
        if(args.data.status === 'success'){
          xPlayer.setRemoteOffer(args.data.sdp)

          const ice_candidates = xPlayer.getIceCandidates()
          const candidates = []
          for(const candidate in ice_candidates){
            candidates.push({
              candidate: ice_candidates[candidate].candidate,
              sdpMLineIndex: ice_candidates[candidate].sdpMLineIndex,
              sdpMid: ice_candidates[candidate].sdpMid,
            })
          }

          ipcRenderer.send(ipc_channel, {
            type: 'start_stream_ice',
            data: {
              ice: candidates
            }
          })
        } else {
          alert('SDP Answer state is '+args.data.status+', expected success')
        }
      } else if(args.type === 'start_stream_ice'){
        xPlayer.setIceCandidates(args.data)
      } else {
        console.log('Unknown event:', args)
      }
    })

    // Keyboard events
    const keyboardDownEvent = (e) => {
      switch(e.keyCode){
        case 48:
          xPlayer.getChannelProcessor('audio')._softReset()
          break;
      }
    }
    window.addEventListener('keydown', keyboardDownEvent)

    // Modal window

    return () => {
      ipcRenderer.removeAllListeners(ipc_channel);
      window.removeEventListener('keydown', keyboardDownEvent)
      // xPlayer.reset()

      if(keepaliveInterval){ clearInterval(keepaliveInterval) }
    };
  })

  function gamepadSend(button){
    console.log('Press button:', button)
    xPlayer.getChannelProcessor('input').pressButton(0, { Nexus: 1 })
  }

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - Streaming {router.query.serverid}</title>
      </Head>

      {/* <StreamComponent onDisconnect={ () => { xPlayer.reset() }}></StreamComponent> */}
      <StreamComponent onMenu={ () => { gamepadSend('nexus') } } xPlayer={ xPlayer }></StreamComponent>
    </React.Fragment>
  );
};

export default Stream;
