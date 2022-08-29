import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router'
import { ipcRenderer } from 'electron'
import xCloudPlayer from 'xbox-xcloud-player'

import Header from '../../components/header'
import StreamComponent from '../../components/ui/streamcomponent'


function Stream() {
  const router = useRouter()
  // const [streamStarted, setStreamStarted] = React.useState(false)
  // const [xPlayer, setxPlayer] = React.useState(new xCloudPlayer('videoHolder', {
  //   ui_systemui: [19]
  // }));

  let rerenderTimeout

  let xPlayer = new xCloudPlayer('streamComponent', {
    ui_systemui: [19]
  })

  React.useEffect(() => {
    document.getElementById('streamComponentHolder').innerHTML = '<div id="streamComponent"></div>'

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

    ipcRenderer.on(ipc_channel, (event, args) => {
      if(args.type === 'error') {
        alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)

      } else if(args.type === 'start_stream'){
        if(args.data.state === 'Provisioned'){
          xPlayer.createOffer().then((offer:any) => {
            ipcRenderer.send(ipc_channel, {
              type: 'start_stream_sdp',
              data: {
                sdp: offer.sdp
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

    return () => {
      ipcRenderer.removeAllListeners(ipc_channel);
      // xPlayer.reset()

      if(rerenderTimeout){ clearTimeout(rerenderTimeout) }
    };
  })

  // Keyboard controls
  // React.useEffect(() => {

  //   return () => {
  //     //
  //   };
  // })

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
      <StreamComponent onMenu={ () => { gamepadSend('nexus') } }></StreamComponent>
    </React.Fragment>
  );
};

export default Stream;
