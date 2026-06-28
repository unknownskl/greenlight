import React, { useState, useRef, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTRPC } from '../../../utils/trpc';
import { useAuth } from '../../../contexts/AuthContext';
import { useInput } from '../../../contexts/InputContext';
import { useMutation } from "@tanstack/react-query";

import { StreamPlayer, xCloudStreamConfig, StreamPlayerHandle, xStreamToken } from '@greenlight/player/client';
// import { Gamepad } from '@greenlight/player/client';

// import '@greenlight/player/client.css';

export default function XcloudPage() {
  const router = useRouter()
  const trpc = useTRPC();
  const { enableControls } = useInput();
  const { getxCloudToken, getxHomeToken, getUserRefreshToken } = useAuth();

  const [streamConfig, setStreamConfig] = useState<xCloudStreamConfig | undefined>(undefined);
  const [session, setSession] = useState<{ sessionPath: string; state: string } | undefined>(undefined);

  const startStreamMutation = useMutation(trpc.streaming_start_stream.mutationOptions());
  const streamGetStatus = useMutation(trpc.streaming_get_status.mutationOptions());
  const streamSendSDPOffer = useMutation(trpc.streaming_send_sdp_offer.mutationOptions());
  const streamSendICECandidates = useMutation(trpc.streaming_send_ice_candidates.mutationOptions());
  const streamSendMSALToken = useMutation(trpc.streaming_send_msal_token.mutationOptions());
  const streamSendKeepalive = useMutation(trpc.streaming_send_keepalive.mutationOptions());

  const streamPlayerRef = useRef<StreamPlayerHandle>(null);

  const { type, titleid } = router.query

  useEffect(() => {
    if (!type || !titleid) return;
    
    console.log('Starting stream for:', type, titleid);
    requestStream(titleid as string, type === 'xcloud');
    document.getElementById('appSidebar')?.classList.add('hidden');

    return () => {
      console.log('Cleaning up stream for:', type, titleid);
      enableControls(true);
      document.getElementById('appSidebar')?.classList.remove('hidden');
    }

  }, [type, titleid, enableControls]);

  const requestStream = async (id: string, xCloud: boolean) => {
        console.log('Requesting stream player setup for console:', id);
        
        const config: xCloudStreamConfig = {
            id: id,
            type: xCloud ? 'cloud' : 'home',
            language: 'en-US',
            host: xCloud ? 'https://uks.core.gssv-play-prod.xboxlive.com' : 'https://uks.core.gssv-play-prodxhome.xboxlive.com',
            resolution: 1080
        };

        const streamSession = await startStreamMutation.mutateAsync({
            token: xCloud ? getxCloudToken() : getxHomeToken(),
            xCloudStreamConfig: config
        });
        console.log('Stream session started:', streamSession);

        if (!("sessionPath" in streamSession)) {
            throw new Error('Invalid stream session response');
        }

        setStreamConfig(config);
        setSession({
            // sessionId: streamSession.sessionId,
            sessionPath: streamSession.sessionPath,
            state: typeof streamSession.state === 'string' ? streamSession.state : ''
        });
        enableControls(false);
    }

    class communicationHandler {

        _token:xStreamToken
        _sessionId:string = '<no id>'
        _sessionPath:string
        _streamConfig:xCloudStreamConfig

        constructor(token: xStreamToken, streamConfig:xCloudStreamConfig, session:{ sessionPath: string; state: string }) {
            this._token = token
            this._sessionPath = session.sessionPath
            this._streamConfig = streamConfig
        }

        getSessionId() {
            return this._sessionId
        }

        getSessionPath() {
            return this._sessionPath
        }

        getStreamConfig() {
            return this._streamConfig
        }

        async getStreamStatus() {
            return await streamGetStatus.mutateAsync({
                token: this._token,
                xCloudStreamConfig: this._streamConfig,
                sessionPath: this._sessionPath
            });
        }

        async sendSDPOffer(sdpOffer:RTCSessionDescriptionInit) {
            return await streamSendSDPOffer.mutateAsync({
                token: this._token,
                xCloudStreamConfig: this._streamConfig,
                sessionPath: this._sessionPath,
                sdpOffer: sdpOffer
            });
        }

        async sendICECandidates(candidates:Array<any>) {
            return await streamSendICECandidates.mutateAsync({
                token: this._token,
                xCloudStreamConfig: this._streamConfig,
                sessionPath: this._sessionPath,
                candidates: candidates
            });
        }

        async sendMSALToken() {
            const token = await getUserRefreshToken()
            if(token){
                return await streamSendMSALToken.mutateAsync({
                    token: this._token,
                    xCloudStreamConfig: this._streamConfig,
                    sessionPath: this._sessionPath,
                    refreshToken: token
                });
            } else {
                throw new Error('MSAL token is null');
            }
        }

        async sendKeepalive() {
            return await streamSendKeepalive.mutateAsync({
                token: this._token,
                xCloudStreamConfig: this._streamConfig,
                sessionPath: this._sessionPath
            });
        }
    }

    return (
        <React.Fragment>
          <Head>
            <title>Greenlight - Streaming {type} - {titleid}</title>
          </Head>
            { streamConfig && session && <div id="player-container" className="w-full h-full items-center justify-center">
                <StreamPlayer
                    ref={ streamPlayerRef }
                    communicationHandler={ new communicationHandler(streamConfig.type === "cloud" ? getxCloudToken() : getxHomeToken(), streamConfig, session) } />

                {/* <button onClick={ () => {
                    if(streamPlayerRef.current){
                        streamPlayerRef.current.ping('Hello from PlayerPage!');
                    }
                    console.log('Pinged StreamPlayer');
                }}>Ping StreamPlayer</button> */}

                <button className='inline' onClick={ () => {
                    if(streamPlayerRef.current){
                        streamPlayerRef.current.attachGamepad(0);
                    }
                }}>Attach Gamepad (0)</button>
                <button className='inline' onClick={ () => {
                    if(streamPlayerRef.current){
                        streamPlayerRef.current.attachMouseKeyboard(0);
                    }
                }}>Attach MouseKeyboard (0)</button>
                <button className='inline' onClick={ () => {
                    if(streamPlayerRef.current){
                        streamPlayerRef.current.toggleDebugOverlay();
                    }
                }}>Toggle Debug Overlay</button>
                <button className='inline' onClick={ () => {
                    window.location.href = '/home';
                }}>Exit Stream</button>
            </div>}
        </React.Fragment>
    );
}
