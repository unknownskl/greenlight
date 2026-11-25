import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import xCloudPlayer from 'xbox-xcloud-player'

import { useSettings } from '../../context/userContext'
import StreamComponent from '../../components/ui/streamcomponent'
import StreamPreload, { StreamError } from '../../components/ui/streampreload'
import Ipc from '../../lib/ipc'
import { installGamepadRemap } from '../../lib/gamepadMapping'
import { installNetworkFilter, allowedAddresses, getSelectedRoute, NetworkMode } from '../../lib/networkInterface'
import { useTranslation } from 'react-i18next'
import { addFramerateToSdp, FrameLimiter, VideoSize } from '../../lib/frameLimiter'
import { MotionSmoother } from '../../lib/motionSmoother'
import { applyCodecPreferences, getActiveCodec, getFramesDecoded, VideoCodecChoice } from '../../lib/videoCodec'

function Stream() {
    const router = useRouter()
    const { settings } = useSettings()
    const { t } = useTranslation()

    let streamStateInterval
    let keepaliveInterval

    const [xPlayer, setxPlayer] = React.useState(undefined)
    const [sessionId, setSessionId] = React.useState('')
    const [queueTime, setQueueTime] = React.useState(0)
    const [streamError, setStreamError] = React.useState<StreamError | undefined>(undefined)
    const [networkReady, setNetworkReady] = React.useState(false)
    const allowedRef = React.useRef<Set<string> | undefined>(undefined)
    const frameLimiterRef = React.useRef<FrameLimiter | undefined>(undefined)
    const motionSmoothing = settings.video_motion_smoothing === true
    // Motion smoothing raises the frame rate, so it overrides the 30 fps limit
    const framerate = motionSmoothing ? 0 : (Number(settings.video_framerate) || 0)
    const motionSmootherRef = React.useRef<MotionSmoother | undefined>(undefined)

    // Stop the frame limiter only when leaving the stream page
    React.useEffect(() => {
        return () => {
            frameLimiterRef.current?.stop()
            frameLimiterRef.current = undefined
            motionSmootherRef.current?.stop()
            motionSmootherRef.current = undefined
        }
    }, [])

    // Settings > Network: restrict the WebRTC connection to Wi-Fi / LAN when selected
    const networkMode: NetworkMode = (settings.network_interface || 'nat') as NetworkMode
    React.useEffect(() => {
        if (networkMode === 'nat') {
            allowedRef.current = undefined
            setNetworkReady(true)
            return
        }

        let restore = () => undefined
        let cancelled = false
        setNetworkReady(false)

        Ipc.send('network', 'getStatus').then((status: any) => {
            if (cancelled) return
            const allowed = allowedAddresses(status.interfaces || [], networkMode)
            if (allowed.size === 0) {
                setStreamError({
                    title: t('streamWindow.errorNetworkUnavailableTitle'),
                    message: t('streamWindow.errorNetworkUnavailableMessage', { type: t('settings.network.type.' + networkMode) }),
                })
                return
            }
            if (!status.mdnsDisabled) {
                console.warn('[network] mDNS candidate obfuscation is still active. Restart Greenlight to fully apply the network setting.')
            }
            allowedRef.current = allowed
            restore = installNetworkFilter(networkMode, allowed)
            setNetworkReady(true)
        }).catch((error) => {
            console.log('[network] Failed to get network status, using system default:', error)
            setNetworkReady(true)
        })

        return () => {
            cancelled = true
            restore()
        }
    }, [networkMode])

    // Warn if routes added by Settings > Network > Bypass VPN are no longer taking effect
    React.useEffect(() => {
        Ipc.send('network', 'getVpnBypass').then((state: any) => {
            const stale = (state?.routes || []).filter((r: any) => r.viaVpn === true)
            if (stale.length > 0) {
                // The stream holder only exists once the player has started, so wait for it
                let tries = 0
                const timer = setInterval(() => {
                    if (document.getElementById('streamComponent') || ++tries > 60) {
                        clearInterval(timer)
                        if (document.getElementById('streamComponent')) notify()
                    }
                }, 1000)
            }
            function notify() {
                showStreamNotice(t('streamWindow.noticeBypassNotActive', {
                    defaultValue: 'VPN bypass is set up but {{targets}} still routes through the VPN. Re-apply it in Settings > Network.',
                    targets: stale.map((r: any) => r.target).join(', '),
                }))
            }
        }).catch(() => undefined)
    }, [])

    // Short notice shown over the stream (below the toolbar) for ~12 seconds
    function showStreamNotice(text: string) {
        const holder = document.getElementById('streamComponent')
        if (!holder) return
        const notice = document.createElement('div')
        notice.className = 'stream-notice'
        notice.textContent = text
        holder.appendChild(notice)
        setTimeout(() => notice.remove(), 12000)
    }

    function errorToText(error: any): string {
        if (error === undefined || error === null) return ''
        if (typeof error === 'string') return error
        if (error instanceof Error) return error.message
        if (error.message) return String(error.message)
        try {
            const json = JSON.stringify(error)
            return json === '{}' ? String(error) : json
        } catch {
            return String(error)
        }
    }

    function buildSessionError(errorDetails: any): StreamError {
        const code = errorDetails?.code
        const message = errorDetails?.message || ''

        if (code === 'WNSError' && message.includes('WaitingForServerToRegister')) {
            return {
                title: t('streamWindow.errorConsoleOfflineTitle'),
                message: t('streamWindow.errorConsoleOfflineMessage'),
                hints: [
                    t('streamWindow.errorConsoleOfflineHintPower'),
                    t('streamWindow.errorConsoleOfflineHintSignIn'),
                    t('streamWindow.errorConsoleOfflineHintRemotePlay'),
                    t('streamWindow.errorConsoleOfflineHintReboot'),
                ],
                code,
                details: message,
            }
        }

        return {
            title: t('streamWindow.errorStreamFailedTitle'),
            message: t('streamWindow.errorStreamFailedMessage'),
            code,
            details: message,
        }
    }

    function retryStream() {
        setStreamError(undefined)
        setQueueTime(0)
        setSessionId('')
    }

    // Apply user controller remapping for the lifetime of the stream page.
    // xbox-xcloud-player reads navigator.getGamepads() directly, so we patch it.
    const controllerMappingKey = JSON.stringify(settings.controller_mapping || {})
    React.useEffect(() => {
        return installGamepadRemap(JSON.parse(controllerMappingKey))
    }, [controllerMappingKey])

    React.useEffect(() => {
        // Nothing to do while an error is shown. User can retry or go back.
        if (streamError !== undefined) return
        // Wait until the network filter is in place before creating any connection
        if (!networkReady) return

        // Detect stream type and title / server id
        let streamType = 'home'
        let serverId = router.query.serverid
        if((router.query.serverid as string).substr(0, 6) === 'xcloud'){
            streamType = 'cloud'
            serverId = (router.query.serverid as string).substr(7)
        }

        if(xPlayer !== undefined){
            document.getElementById('streamComponentHolder').innerHTML = '<div id="streamComponent" class="size_'+settings.video_size+'"></div>'
            xPlayer.bind()

            // Set bitrates & video codec profiles
            if((streamType === 'cloud') ? settings.xcloud_bitrate : settings.xhome_bitrate > 0){
                xPlayer.setVideoBitrate((streamType === 'cloud') ? settings.xcloud_bitrate : settings.xhome_bitrate)
            }

            // Settings > Video: preferred codec. H.264 always stays in the list as a fallback.
            const videoCodec = (settings.video_codec || 'auto') as VideoCodecChoice
            if(videoCodec !== 'auto'){
                // Our own codec order (H.265 / AV1 first). The player's setCodecPreferences only
                // supports a single codec type, so we don't use it here.
                applyCodecPreferences(xPlayer._webrtcClient, videoCodec, settings.video_profiles || [])
            } else if(settings.video_profiles.length > 0){
                xPlayer.setCodecPreferences('video/H264', { profiles: settings.video_profiles || [] }) // 4d = high, 42e = mid, 420 = low
            }

            // Stream is ready so we start the player
            xPlayer.setControllerRumble(settings.controller_vibration)
            xPlayer.setSdpHandler((client, offer) => {
                Ipc.send('streaming', 'sendChatSdp', {
                    sessionId: sessionId,
                    sdp: offer.sdp,
                }).then((sdpResponse) => {
                    xPlayer.setRemoteOffer(sdpResponse.sdp)

                }).catch((error) => {
                    console.log('ChatSDP Exchange error:', error)
                    alert(t('errors.chatSDPExchangeError') + ' ' + JSON.stringify(error))
                })
            })

            xPlayer.createOffer().then((offer:any) => {
                Ipc.send('streaming', 'sendSdp', {
                    sessionId: sessionId,
                    // Settings > Video: ask the server for a lower frame rate (it may ignore this)
                    sdp: addFramerateToSdp(offer.sdp, framerate),
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
                        sessionId: sessionId,
                        ice: candidates,
                    }).then((iceResult:any) => {
                        console.log(iceResult)
                        xPlayer.setIceCandidates(iceResult)

                        // All done. Waiting for the event 'connectionstate' to be triggered

                    }).catch((error) => {
                        console.log('ICE Exchange error:', error)
                        alert(t('errors.ICEExchangeError') + ' ' + JSON.stringify(error))
                    })

                }).catch((error) => {
                    console.log('SDP Exchange error:', error)
                    alert(t('errors.SDPExchangeError') + ' ' + JSON.stringify(error))
                })
            })

            xPlayer.getEventBus().on('connectionstate', (event) => {
                console.log('connectionstate changed:', event)

                const connStatus = document.getElementById('component_streamcomponent_connectionstatus')
                if(connStatus !== null){
                    if(event.state === 'connected'){
                        connStatus.innerText = t('streamWindow.clientHasBeenDisconnected')
                        document.getElementById('component_streamcomponent_loader').className = 'hidden'

                        // Set audio / Video settings
                        // @TODO: Implement api's in xbox-xcloud-player
                        if(settings.audio_enabled === false){
                            xPlayer._audioComponent._audioRender.muted = true
                        }

                        if(settings.video_enabled === false){
                            xPlayer._videoComponent._videoRender.style.opacity = 0
                        } else if(motionSmoothing && motionSmootherRef.current === undefined){
                            // Generate in-between frames when the stream runs at ~30 fps
                            const videoRender = xPlayer._videoComponent?._videoRender
                            if(videoRender && 'requestVideoFrameCallback' in videoRender){
                                motionSmootherRef.current = new MotionSmoother(videoRender, settings.video_size as VideoSize)
                            }
                        } else if(framerate > 0 && frameLimiterRef.current === undefined){
                            // Cap the displayed frame rate, whatever the server sends
                            const videoRender = xPlayer._videoComponent?._videoRender
                            if(videoRender && 'requestVideoFrameCallback' in videoRender){
                                frameLimiterRef.current = new FrameLimiter(videoRender, framerate, settings.video_size as VideoSize)
                            }
                        }

                        // Log which codec the server picked (shown in the motion smoothing badge too)
                        setTimeout(() => {
                            getActiveCodec(xPlayer._webrtcClient).then((codec) => {
                                console.log('[codec] Server is streaming with:', codec, '(requested:', settings.video_codec || 'auto', ')')
                                if (codec) document.getElementById('streamComponent')?.setAttribute('data-codec', codec)
                            }).catch(() => undefined)
                        }, 2000)

                        // H.265 is experimental: if it negotiated but no picture arrives, tell the user
                        setTimeout(() => {
                            Promise.all([getActiveCodec(xPlayer._webrtcClient), getFramesDecoded(xPlayer._webrtcClient)]).then(([codec, frames]) => {
                                if (codec === 'H265' && frames === 0) {
                                    console.warn('[codec] H.265 stream is connected but no frames were decoded')
                                    alert(t('errors.codecNoVideo'))
                                }
                            }).catch(() => undefined)
                        }, 6000)

                        // Record which network path the stream is using
                        getSelectedRoute(xPlayer._webrtcClient, allowedRef.current).then((route) => {
                            if (!route) return
                            console.log('[network] Selected stream route:', route)
                            try {
                                localStorage.setItem('greenlight_last_route', JSON.stringify({ ...route, mode: networkMode, at: Date.now() }))
                            } catch (e) {
                                // ignore
                            }
                            if (route.onSelectedInterface === false) {
                                console.warn('[network] Stream is NOT using the selected interface:', networkMode, route)
                                // Typical cause: a full-tunnel VPN (e.g. a company VPN) that routes all traffic,
                                // including traffic from the Wi-Fi / LAN socket. Apps cannot override that.
                                showStreamNotice(t('streamWindow.noticeNotOnSelectedNetwork', { type: t('settings.network.type.' + networkMode) }))
                            }
                        }).catch((error) => {
                            console.log('[network] Unable to read selected route:', error)
                        })

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
                        connStatus.innerText = t('streamWindow.startingConnection')

                    } else if(event.state === 'connecting'){
                        connStatus.innerText = t('streamWindow.connectingToConsole')

                    } else if(event.state === 'closed') {
                        // Client has been disconnected. Lets return to home.
                        // xPlayer.close()
                        console.log('Client has been disconnected. Returning to prev page.')
                        frameLimiterRef.current?.stop()
                        frameLimiterRef.current = undefined
                        motionSmootherRef.current?.stop()
                        motionSmootherRef.current = undefined
                        window.history.back()
                    }
                }
            })
        } else if(sessionId === '') {
            // Stream is not ready yet, lets start it...

            Ipc.send('streaming', 'startStream', {
                type: streamType,
                target: serverId,
            }).then((result:string) => {
                console.log('StartStream session:', result)
                setSessionId(result)

            }).catch((error) => {
                console.log('Failed to start stream:', error)
                setSessionId('failed')
                setStreamError({
                    title: t('streamWindow.errorStartFailedTitle'),
                    message: t('streamWindow.errorStartFailedMessage'),
                    details: errorToText(error),
                })
            })
        } else {

            streamStateInterval = setInterval(() => {
                Ipc.send('streaming', 'getPlayerState', {
                    sessionId: sessionId,
                }).then((session:any) => {
                    console.log('Player state:', session)

                    if(session === undefined || session === null){
                        // Session was removed by the backend (e.g. not found on server)
                        clearInterval(streamStateInterval)
                        setStreamError({
                            title: t('streamWindow.errorStreamFailedTitle'),
                            message: t('streamWindow.errorSessionLostMessage'),
                        })
                        return
                    }

                    switch(session.playerState){
                        case 'pending':
                            // Waiting for console to start
                            break

                        case 'started':
                            // Console is ready
                            clearInterval(streamStateInterval)

                            // Start xPlayer interface
                            setxPlayer(new xCloudPlayer('streamComponent', {
                                ui_systemui: [],
                                input_touch: settings.input_touch || false,
                                input_mousekeyboard: settings.input_mousekeyboard || false,
                                input_legacykeyboard: (settings.input_newgamepad) ? false : true,
                                input_mousekeyboard_config: settings.input_mousekeyboard_config !== undefined ? {
                                    _keymapping: settings.input_mousekeyboard_config,
                                } : undefined as any,
                            }))
                            break

                        case 'failed':
                            // Error
                            clearInterval(streamStateInterval)

                            // Error (e.g. console is off or not connected to Xbox servers)
                            console.log('Full stream error:', session.errorDetails)
                            setStreamError(buildSessionError(session.errorDetails))
                            onDisconnect()
                            break

                        case 'queued':
                            // Waiting in queue
                            // @TODO: Show queue position
                            if(queueTime === 0){
                                setQueueTime(session.waitingTimes.estimatedTotalWaitTimeInSeconds)
                                console.log('Setting queue to:', session.waitingTimes.estimatedTotalWaitTimeInSeconds)


                            }
                            break
                    }

                }).catch((error) => {
                    console.log('Failed to get player state:', error)
                    clearInterval(streamStateInterval)
                    setStreamError({
                        title: t('streamWindow.errorStreamFailedTitle'),
                        message: t('errors.failedToGetPlayerState'),
                        details: errorToText(error),
                    })
                })
            }, 1000)
        }

        // Modal window
        return () => {
            if(xPlayer !== undefined){
                xPlayer.close()
            }

            if(keepaliveInterval){
                clearInterval(keepaliveInterval)
            }

            if(streamStateInterval){
                clearInterval(streamStateInterval)
            }
        }
    })

    function gamepadSend(button){
        console.log('Pressed button:', button)
        xPlayer.getChannelProcessor('input').pressButton(0, 'Nexus')
    }

    function onDisconnect(){
        if(sessionId !== '' && sessionId !== 'failed'){
            Ipc.send('streaming', 'stopStream', {
                sessionId: sessionId,
            }).then((result) => {
                console.log('Stream stopped:', result)
            }).catch((error) => {
                // Session may already be gone on the server (e.g. failed to start)
                console.log('Failed to stop stream:', error)
            })
        }

        if(streamStateInterval){
            clearInterval(streamStateInterval)
        }
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('streamWindow.pageTitle')} {router.query.serverid}</title>
            </Head>

            { (xPlayer !== undefined) ? <StreamComponent onDisconnect={ () => {
                onDisconnect()
            }} onMenu={ () => {
                gamepadSend('nexus')
            } } xPlayer={ xPlayer }></StreamComponent> : (queueTime > 0) ?<StreamPreload onDisconnect={ () => {
                onDisconnect()
            }} waitingTime={ queueTime }></StreamPreload> : <StreamPreload onDisconnect={ () => {
                onDisconnect()
            }} error={ streamError } onRetry={ retryStream }></StreamPreload> }
        </React.Fragment>
    )
}

export default Stream
