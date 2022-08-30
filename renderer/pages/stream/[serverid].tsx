import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router'
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
            console.log('sdp:', setMediaBitrates(offer.sdp, (ipc_channel == 'home') ? settings.xhome_bitrate || 4096 : settings.xcloud_bitrate || 2048))

            ipcRenderer.send(ipc_channel, {
              type: 'start_stream_sdp',
              data: {
                sdp: setMediaBitrates(offer.sdp, (ipc_channel == 'home') ? settings.xhome_bitrate || 4096 : settings.xcloud_bitrate || 2048)
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
        case 38:
          xPlayer.getChannelProcessor('input').pressButton(0, { DPadUp: 1 })
          break;
        case 40:
          xPlayer.getChannelProcessor('input').pressButton(0, { DPadDown: 1 })
          break;
        case 37:
          xPlayer.getChannelProcessor('input').pressButton(0, { DPadLeft: 1 })
          break;
        case 39:
          xPlayer.getChannelProcessor('input').pressButton(0, { DPadRight: 1 })
          break;
        case 13:
        case 65:
          xPlayer.getChannelProcessor('input').pressButton(0, { A: 1 })
          break;
        case 8:
        case 66:
          xPlayer.getChannelProcessor('input').pressButton(0, { B: 1 })
          break;
        case 88:
          xPlayer.getChannelProcessor('input').pressButton(0, { X: 1 })
          break;
        case 89:
          xPlayer.getChannelProcessor('input').pressButton(0, { Y: 1 })
          break;
        case 78:
          xPlayer.getChannelProcessor('input').pressButton(0, { Nexus: 1 })
          break;
        case 219:
          xPlayer.getChannelProcessor('input').pressButton(0, { LeftShoulder: 1 })
          break;
        case 221:
          xPlayer.getChannelProcessor('input').pressButton(0, { RightShoulder: 1 })
          break;
        case 86:
          xPlayer.getChannelProcessor('input').pressButton(0, { View: 1 })
          break;
        case 77:
          xPlayer.getChannelProcessor('input').pressButton(0, { Menu: 1 })
          break;
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

  function setMediaBitrates(sdp, videoBitrate) {
    return setMediaBitrate(setMediaBitrate(sdp, "video", videoBitrate), "audio", 512);
  }
   
  function setMediaBitrate(sdp, media, bitrate) {
    var lines = sdp.split("\n");
    var line = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf("m="+media) === 0) {
        line = i;
        break;
      }
    }
    if (line === -1) {
      console.debug("Could not find the m line for", media);
      return sdp;
    }
    console.debug("Found the m line for", media, "at line", line);
   
    // Pass the m line
    line++;
   
    // Skip i and c lines
    while(lines[line].indexOf("i=") === 0 || lines[line].indexOf("c=") === 0) {
      line++;
    }
   
    // If we're on a b line, replace it
    if (lines[line].indexOf("b") === 0) {
      console.debug("Replaced b line at line", line);
      lines[line] = "b=AS:"+bitrate
      return lines.join("\n");
    }
    
    // Add a new b line
    console.debug("Adding new b line before line", line);
    var newLines = lines.slice(0, line)
    newLines.push("b=AS:"+bitrate)
    newLines = newLines.concat(lines.slice(line, lines.length))
    return newLines.join("\n")
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
