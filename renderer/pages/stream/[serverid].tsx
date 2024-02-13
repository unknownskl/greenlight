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
    const { settings } = useSettings()

    let sessionId = ''
    let streamStateInterval
    let keepaliveInterval

    const [xPlayer] = React.useState(new xCloudPlayer('streamComponent', {
        ui_systemui: [],
        input_touch: settings.input_touch || false,
        input_mousekeyboard: settings.input_mousekeyboard || false,
        input_legacykeyboard: (settings.input_newgamepad) ? false : true,
    }))

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

            streamStateInterval = setInterval(() => {
                Ipc.send('streaming', 'getPlayerState', {
                    sessionId: sessionId,
                }).then((session:any) => {
                    console.log('Player state:', session)

                    switch(session.playerState){
                        case 'pending':
                            // Waiting for console to start
                            break

                        case 'started':
                            // Console is ready
                            clearInterval(streamStateInterval)
                            
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
                            clearInterval(streamStateInterval)

                            if(session.errorDetails.code === 'WNSError' && session.errorDetails.message.includes('WaitingForServerToRegister')){
                                // Detected the "WaitingForServerToRegister" error. This means the console is not connected to the xbox servers
                                alert('Unable to start stream session on console. The console is not connected to the Xbox servers. This ocasionally happens then there is an update or when the user is not signed in to the console. Please hard reboot your console and try again.\n\n'+'Stream error result: '+session.state+'\nDetails: ['+session.errorDetails.code+'] '+session.errorDetails.message)
                            } else {
                                alert('Stream error result: '+session.state+'\nDetails: ['+session.errorDetails.code+'] '+session.errorDetails.message)
                            }
                            console.log('Full stream error:', session.errorDetails)
                            onDisconnect()
                            xPlayer.close()
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

        // Modal window
        return () => {
            xPlayer.close()
            if(keepaliveInterval){
                clearInterval(keepaliveInterval) 
            }

            if(streamStateInterval){
                clearInterval(streamStateInterval) 
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

        if(streamStateInterval){
            clearInterval(streamStateInterval)
        }
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
