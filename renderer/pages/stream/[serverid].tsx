import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
// import { ipcRenderer } from 'electron'
import xCloudPlayer from 'xbox-xcloud-player'

import { useSettings } from '../../context/userContext'
import StreamComponent from '../../components/ui/streamcomponent'
import Ipc from '../../lib/ipc'

function Stream() {
    const router = useRouter()
    const { settings} = useSettings()
    // const [sessionId, setSessionId] = React.useState('')
    let sessionId = ''
    const [xPlayer] = React.useState(new xCloudPlayer('streamComponent', {
        ui_systemui: [],
        input_touch: settings.input_touch || false,
        input_mousekeyboard: settings.input_mousekeyboard || false,
        input_legacykeyboard: (settings.input_newgamepad) ? false : true,
    }))

    // let rerenderTimeout
    let keepaliveInterval

    xPlayer.setControllerRumble(settings.controller_vibration)
    xPlayer.setSdpHandler((client, offer) => {
        Ipc.send('streaming', 'sendChatSdp', {
            sessionId: sessionId,
            sdp: offer.sdp,
        }).then((sdpResponse) => {
            xPlayer.setRemoteOffer(sdpResponse.sdp)

        }).catch((error) => {
            console.log('ChatSDP Exchange error:', error)
            alert('ChatSDP Exchange error:'+ JSON.stringify(error))
        })
    })

    xPlayer.getEventBus().on('connectionstate', (event) => {
        console.log('connectionstate changed:', event)

        const connStatus = document.getElementById('component_streamcomponent_connectionstatus')
        if(connStatus !== null){
            if(event.state === 'connected'){
                connStatus.innerText = 'Client has been connected!'
                document.getElementById('component_streamcomponent_loader').className = 'hidden'

                // Set audio / Video settings
                // @TODO: Implement api's in xbox-xcloud-player
                if(settings.audio_enabled === false){
                    xPlayer._audioComponent._audioRender.muted = true
                }

                if(settings.video_enabled === false){
                    xPlayer._videoComponent._videoRender.style.opacity = 0
                }

                // Start keepalive loop
                keepaliveInterval = setInterval(() => {
                    Ipc.send('streaming', 'sendKeepalive', {
                        sessionId: sessionId,
                    }).then((result) => {
                        console.log('StartStream keepalive:', result)
                    }).catch((error) => {
                        console.error('Failed to send keepalive. Error details:\n'+JSON.stringify(error))
                    })
                }, 30000) // Send every 30 seconds

            } else if(event.state === 'new'){
                connStatus.innerText = 'Starting connection...'

            } else if(event.state === 'connecting'){
                connStatus.innerText = 'Connecting to console...'

            } else if(event.state === 'closed') {
                // Client has been disconnected. Lets return to home.
                // xPlayer.close()
                console.log('Client has been disconnected. Returning to prev page.')
                window.history.back()
            }
        }
    })

    React.useEffect(() => {
        document.getElementById('streamComponentHolder').innerHTML = '<div id="streamComponent" class="size_'+settings.video_size+'"></div>'

        // Detect stream type and title / server id
        let streamType = 'home'
        let ipc_channel = 'stream'
        let serverId = router.query.serverid
        if((router.query.serverid as string).substr(0, 6) === 'xcloud'){
            streamType = 'cloud'
            ipc_channel = 'xcloud'
            serverId = (router.query.serverid as string).substr(7)
        }

        // Set bitrates & video codec profiles
        if((ipc_channel === 'xcloud') ? settings.xcloud_bitrate : settings.xhome_bitrate > 0){
            xPlayer.setVideoBitrate((ipc_channel === 'xcloud') ? settings.xcloud_bitrate : settings.xhome_bitrate)
        }
        xPlayer.setCodecPreferences('video/H264', { profiles: settings.video_profiles || [] }) // 4d = high, 42e = mid, 420 = low
    
        // Send the start stream command
        Ipc.send('streaming', 'startStream', {
            type: streamType,
            target: serverId,
        }).then((result:string) => {
            console.log('StartStream session:', result)
            sessionId = result

            const streamStateInterval = setInterval(() => {
                Ipc.send('streaming', 'getPlayerState', {
                    sessionId: sessionId,
                }).then((session:any) => {

                    console.log('Player state:', session)


                    switch(session.playerState){
                        case 'pending':
                            // Waiting for console to start
                            break
                        case 'started':
                            clearInterval(streamStateInterval)
                            // Console is ready
                            xPlayer.createOffer().then((offer:any) => {
                                Ipc.send('streaming', 'sendSdp', {
                                    sessionId: session.id,
                                    sdp: offer.sdp,
                                }).then((sdpResult:any) => {
                                    xPlayer.setRemoteOffer(sdpResult.sdp)
      
                                    // Gather candidates
                                    const iceCandidates = xPlayer.getIceCandidates()
                                    const candidates = []
                                    for(const candidate in iceCandidates){
                                        candidates.push({
                                            candidate: iceCandidates[candidate].candidate,
                                            sdpMLineIndex: iceCandidates[candidate].sdpMLineIndex,
                                            sdpMid: iceCandidates[candidate].sdpMid,
                                        })
                                    }
      
                                    Ipc.send('streaming', 'sendIce', {
                                        sessionId: session.id,
                                        ice: candidates,
                                    }).then((iceResult:any) => {
                                        console.log(iceResult)
                                        xPlayer.setIceCandidates(iceResult)

                                        // All done. Waiting for the connection to appear
      
                                    }).catch((error) => {
                                        console.log('ICE Exchange error:', error)
                                        alert('ICE Exchange error:'+ JSON.stringify(error))
                                    })
      
                                }).catch((error) => {
                                    console.log('SDP Exchange error:', error)
                                    alert('SDP Exchange error:'+ JSON.stringify(error))
                                })
                            })
                            break
                        case 'failed':
                            // Error
                            alert('Stream error result: '+session.state+'\nDetails: ['+session.errorDetails.code+'] '+session.errorDetails.message)
                            break
                        case 'queued':
                            // Waiting in queue
                            // @TODO: Show queue position
                            break
                    }

                }).catch((error) => {
                    alert('Failed to get player state. Error details:\n'+JSON.stringify(error))
                })
            }, 1000)

        }).catch((error) => {
            alert('Failed to start new stream. Error details:\n'+JSON.stringify(error))
        })




    

        // ipcRenderer.on(ipc_channel, (event, args) => {
        //   if(args.type === 'error') {
        //     alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)

        //   } else if(args.type === 'start_stream'){
        //     if(args.data.state === 'Provisioned'){
        //       xPlayer.createOffer().then((offer:any) => {
        //         // console.log('sdp:', setMediaBitrates(offer.sdp, (ipc_channel === 'home') ? settings.xhome_bitrate || 4096 : settings.xcloud_bitrate || 2048))

        //         ipcRenderer.send(ipc_channel, {
        //           type: 'start_stream_sdp',
        //           data: {
        //             sdp: offer.sdp
        //             // sdp: (ipc_channel === 'home') ? setMediaBitrates(offer.sdp, settings.xhome_bitrate || 4096) : offer.sdp
        //           }
        //         })
        //       })
        //     } else {
        //       alert('Console state is '+args.data.state+', expected Provisioned.\n'+args.data.errorDetails.message)
        //     }
        //   } else if(args.type === 'start_stream_sdp'){
        //     if(args.data.status === 'success'){
        //       xPlayer.setRemoteOffer(args.data.sdp)

        //       const ice_candidates = xPlayer.getIceCandidates()
        //       const candidates = []
        //       for(const candidate in ice_candidates){
        //         candidates.push({
        //           candidate: ice_candidates[candidate].candidate,
        //           sdpMLineIndex: ice_candidates[candidate].sdpMLineIndex,
        //           sdpMid: ice_candidates[candidate].sdpMid,
        //         })
        //       }

        //       ipcRenderer.send(ipc_channel, {
        //         type: 'start_stream_ice',
        //         data: {
        //           ice: candidates
        //         }
        //       })
        //     } else {
        //       alert('SDP Answer state is '+args.data.status+', expected success')
        //     }
        //   } else if(args.type === 'start_stream_ice'){
        //     xPlayer.setIceCandidates(args.data)
        //   } else {
        //     console.log('Unknown event:', args)
        //   }
        // })

        // Modal window
        return () => {
            // ipcRenderer.removeAllListeners(ipc_channel);
            // window.removeEventListener('keydown', keyboardDownEvent)
            // xPlayer.reset()

            if(keepaliveInterval){
                clearInterval(keepaliveInterval) 
            }
        }
    })

    function gamepadSend(){
        console.log('Pressed nexus...')
        xPlayer.getChannelProcessor('input').pressButton(0, 'Nexus')
    }

    function onDisconnect(){  
        Ipc.send('streaming', 'stopStream', {
            sessionId: sessionId,
        }).then((result) => {
            console.log('Stream stopped:', result)
        })
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - Streaming {router.query.serverid}</title>
            </Head>

            <StreamComponent onDisconnect={ () => {
                onDisconnect() 
            }} onMenu={ () => {
                gamepadSend('nexus') 
            } } xPlayer={ xPlayer } sessionId={ sessionId }></StreamComponent>
        </React.Fragment>
    )
}

export default Stream
