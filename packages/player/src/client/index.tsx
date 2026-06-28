import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import './Player.css';

import type { xStreamToken, xCloudStreamConfig, startStreamResponse } from '../types/index';
export type { xStreamToken, startStreamResponse, xCloudStreamConfig };

import xCloudPlayer from './lib/player';

// Proxy inputs
import Gamepad from './lib/input/gamepad';
import MouseKeyboard from './lib/input/mousekeyboard';
import Touch from './lib/input/touch';

// export { Gamepad, MouseKeyboard, Touch };

export interface StreamPlayerProps {
    communicationHandler: communicationHandler
}
export interface StreamPlayerHandle {
    ping: (echo: string) => void;
    attachGamepad: (index?: number) => VirtualGamepad;
    attachMouseKeyboard: (index?: number) => VirtualMKB;
    toggleDebugOverlay: () => void;
}

export interface communicationHandler {
    getSessionId: () => string;
    getStreamStatus: () => Promise<any>;
    getSessionPath: () => string;
    getStreamConfig: () => xCloudStreamConfig;
    sendSDPOffer: (sdpOffer:RTCSessionDescriptionInit) => Promise<any>;
    sendICECandidates: (candidates:Array<any>) => Promise<any>;
    sendMSALToken: () => Promise<any>;
    sendKeepalive: () => Promise<any>;
}

export const StreamPlayer = forwardRef<StreamPlayerHandle, StreamPlayerProps>(
    ({
        communicationHandler
    }, ref): ReactElement => {
        const [playerState, setPlayerState] = useState<string>('Initializing');

        const playerInstance = useRef<HTMLDivElement | null>(null);
        // let player = new xCloudPlayer('playerContainer');
        const [player, setPlayer] = useState<xCloudPlayer | undefined>(undefined);

        useImperativeHandle(ref, () => ({
            ping(echo: string) {
                // Call into the actual player SDK here
                console.log('Pinging player', echo, playerInstance.current);
            },
            attachGamepad(index = 0) {
                if(!player){
                    throw new Error('Player is not initialized yet');
                }
                const gamepad = new VirtualGamepad(player)
                gamepad.attach(index)
                return gamepad
            },
            attachMouseKeyboard(index = 0) {
                if(!player){
                    throw new Error('Player is not initialized yet');
                }
                const mkb = new VirtualMKB(player)
                mkb.attach(index)
                return mkb
            },
            toggleDebugOverlay() {
                if(!player){
                    throw new Error('Player is not initialized yet');
                }
                player.toggleDebugOverlay()
            }
        }));

        useEffect(() => {
            console.log('StreamPlayer useEffect - playerState:', playerState);
        }, [playerState])

        useEffect(() => {
            let interval: NodeJS.Timeout;

            if(playerState == 'Initializing'){
                interval = setInterval(() => {
                    console.log('Player useEffect - playerState:', playerState);
                    communicationHandler.getStreamStatus().then((state:any) => {
                        console.log('Stream status:', state);

                        if(state.error){
                            console.error('Error in stream status:', state.error);

                            clearInterval(interval)
                            setPlayerState('Error');
                        } else {
                            if(state.state === 'Provisioned'){
                                // Console is ready

                                clearInterval(interval)
                                setPlayerState('Provisioned')

                            } else if(state.state === 'ReadyToConnect'){
                                // Perform MSAL Auth, then refetch state and wait for Provisioned
                                communicationHandler.sendMSALToken()

                            } else if(state.state === 'Failed'){
                                clearInterval(interval)
                                setPlayerState('Error');
                            }
                        }

                    })

                }, 1000)
            }

            if(playerState === 'Provisioned'){
                console.log('Xbox is ready to connect... Lets render xCloudPlayer lib...')
                setPlayer(new xCloudPlayer('playerContainer'))
            }

            return () => {
                console.log('Cleaning up player useEffect interval');
                clearInterval(interval)
            }
        }, [playerState]);

        useEffect(() => {
            let keepaliveInterval : NodeJS.Timeout;
            if(player){
                player.init();

                setPlayerState('Connecting')

                player.createOffer().then(async (offer) => {
                    console.log('Created offer:', offer);
                    const serverOffer = await communicationHandler.sendSDPOffer(offer)
                    const remoteSDP = JSON.parse(serverOffer.exchangeResponse);

                    console.log('Received SDP Offer:', serverOffer);

                    player.setRemoteSDP(remoteSDP.sdp);

                    // Start ICE handshake
                    const localIce = await player.getICECandidates()
                    console.log('Retrieved local ICE:', localIce);
                    const iceCandidates = localIce.map((candidate) => {
                        return JSON.stringify({ candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex, usernameFragment: candidate.usernameFragment })
                    })

                    const remoteIce = await communicationHandler.sendICECandidates(iceCandidates)
                    console.log('Received ICE Candidates:', remoteIce);
                    const serverIce = JSON.parse(remoteIce.exchangeResponse);
                    console.log('Received ICE Candidates 2:', serverIce);
                    player.setRemoteIceCandidates(serverIce)

                    setPlayerState('Connected')

                    const playerStateInterval = setInterval(() => {
                        if(player.playerState === 'Destroyed'){
                            clearInterval(keepaliveInterval)
                            clearInterval(playerStateInterval)
                            setPlayerState('Destroyed')
                        }
                    }, 1000)

                    keepaliveInterval = setInterval(async () => {
                        console.log('Sending keepalive...', player.playerState);
                        if(player.playerState === 'Destroyed'){
                            clearInterval(keepaliveInterval)
                            clearInterval(playerStateInterval)
                            setPlayerState('Destroyed')
                            return
                        } else {
                            await communicationHandler.sendKeepalive()
                        }
                    }, 30 * 1000);
                })
            }

            return () => {
                if(player){
                    player.destroy();
                    clearInterval(keepaliveInterval)
                }
            }
        }, [player]);

        return (
            <div ref={playerInstance}>
                <div id="playerContainer"></div>
                {/* <p>
                    Player loaded from <span className='redPlayer'>@greenlight/player/client</span>
                </p>
                <pre>{JSON.stringify(communicationHandler.getStreamConfig(), null, 2)}</pre>
                <pre>Status: {playerState}</pre> */}
            </div>
        );
    }
);

// CONTROLS

class VirtualGamepad {

    _isAttached = false
    _gamepad:Gamepad | undefined
    _player:xCloudPlayer

    constructor(player:xCloudPlayer) {
        this._player = player
    }

    attach(index = 0) {
        console.log('[VirtualGamepad] Attaching virtual gamepad on index:', index)
        this._gamepad = new Gamepad(index, { 
            enable_keyboard: true,
        })

        if(this._player){
            this._gamepad.attach(this._player)
            this._isAttached = true
        } else {
            console.log('[VirtualGamepad] Failed to attach gamepad to Player istance:', this._player)
            return
        }
    }

    detach() {
        if(this._isAttached === false){
            console.log('[VirtualGamepad] Virtual Gamepad is not attached')
            return
        }
        this._gamepad?.detach()
        this._isAttached = false
    }

    sendGamepadButtonPress(button: string) {
        this._gamepad?.sendButtonState(button, 1)
        setTimeout(() => {
            this._gamepad?.sendButtonState(button, 0)
        }, 50)
    }

    sendGamepadButtonState(button: string, value: number) {
        this._gamepad?.sendButtonState(button, value)
    }
}

class VirtualMKB {
    _isAttached = false
    _mkb: MouseKeyboard | undefined
    _player:xCloudPlayer

    constructor(player:xCloudPlayer) {
        this._player = player
    }

    attach(index = 0) {
        console.log('[VirtualMKB] Attaching MKB on index:', index)
        this._mkb = new MouseKeyboard(index)

        if(this._player){
            this._mkb.attach(this._player)
            this._isAttached = true
        } else {
            console.log('[VirtualMKB] Failed to attach MKB to Player istance:', this._player)
            return
        }
    }

    detach() {
        if(this._isAttached === false){
            console.log('[VirtualMKB] Virtual MKB is not attached')
            return
        }
        this._mkb?.detach()
        this._isAttached = false
    }
}