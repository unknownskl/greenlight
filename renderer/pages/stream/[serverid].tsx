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
  // const [xPlayer, setxPlayer] = React.useState(new xCloudPlayer('videoHolder', {
  //   ui_systemui: [19]
  // }));

  let xPlayer = new xCloudPlayer('streamComponent', {
    ui_systemui: [19]
  })

  React.useEffect(() => {

    ipcRenderer.send('stream', {
      type: 'start_stream',
      data: {
        type: 'home',
        serverId: router.query.serverid
      }
    })

    ipcRenderer.on('stream', (event, args) => {
      if(args.type === 'error') {
        alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)

      } else if(args.type === 'start_stream'){
        if(args.data.state === 'Provisioned'){
          xPlayer.createOffer().then((offer:any) => {
            ipcRenderer.send('stream', {
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

          ipcRenderer.send('stream', {
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
      }
    })

    return () => {
      ipcRenderer.removeAllListeners('stream');
      xPlayer.reset()
    };
  })

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - Streaming {router.query.serverid}</title>
      </Head>

      <div>
        <p>Streaming View: {router.query.serverid}</p>
      </div>

      <StreamComponent></StreamComponent>
    </React.Fragment>
  );
};

export default Stream;
