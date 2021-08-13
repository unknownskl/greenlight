module.exports = class xCloudClient {

    #activeSessionId = null

    #webrtcClient = null
    // #webrtcConfiguration = {
    //     iceServers: [{
    //         urls: "stun:stun.l.google.com:19302"
    //     }, {
    //         urls: "stun:stun1.l.google.com:19302"
    //     }]
    // }
    #webrtcConfiguration = {} // Removed ICE Configuration since update 16/07/2021

    #webrtcDataChannels = {};
    #webrtcChannelProcessors = {};
    #webrtcDataChannelsConfig = {
        'video': {
            id: 1,
            ordered: true,
            protocol: '1.0'
        },
        'audio': {
            id: 2,
            maxRetransmits: 0,
            ordered: true,
            protocol: 'audioV1'
        },
        'input': {
            id: 3,
            ordered: true,
            protocol: '1.0'
        },
        'control': {
            id: 4,
            protocol: 'controlV1'
        },
        'message': {
            id: 5,
            protocol: 'messageV1'
        },
        'chat': {
            id: 6,
            protocol: "chatV1"
        }
    }

    #webrtcStates = {
        iceGathering: 'open',
        iceConnection: 'open',
        iceCandidates: [],
        streamConnection: 'open',
    }

    #renderClient = {
        video: {
            videoRender: null,
            mediaSource: null,
            audioSource: null,
        },
        audio: {
            audioRender: null,
            mediaSource: null,
            audioSource: null,
        }
    }

    #gamepadProcessor = null

    #events = {
        'connect': [],
        'openstream': [],
    }

    _application;
    
    constructor(application) {
        this._application = application

        // Init gamepad support
        this.initGamepads()
    }

    initGamepads() {
        this.#gamepadProcessor = new Gamepads();

        // Test class (Needs to be moved to the input channel.)
        this.#gamepadProcessor.addEventListener('connect', (event) => {
            console.log('Gamepad connected:', event)
        })

        this.#gamepadProcessor.addEventListener('disconnect', (event) => {
            console.log('Gamepad disconnected:', event)
        })

        this.#gamepadProcessor.addEventListener('statechange', (event) => {
            // Check if we have an active channelProcessor (aka open connection)
            if(this.getChannelProcessor('input') !== undefined){
                this.getChannelProcessor('input').processGamepadState(0, this.#gamepadProcessor.mapStateLabels(event.buttons, event.axes))
            }
        })

        // setInterval(() => {
        //     // Check if we have an active channelProcessor (aka open connection)
        //     if(this.getChannelProcessor('input') !== undefined){
        //         this.getChannelProcessor('input').processGamepadState(0, this.#gamepadProcessor.mapStateLabels(event.buttons, event.axes))
        //     }
        // }, 20)
    }

    stopWebrtcConnection() {
        this.#webrtcClient.close()
    }

    startWebrtcConnection() {
        console.log('xSDK client.js - Start new session')

        this.#webrtcClient = new RTCPeerConnection(this.#webrtcConfiguration);

        // Open Data channels
        for(let channel in this.#webrtcDataChannelsConfig){
            this.openDataChannel(channel, this.#webrtcDataChannelsConfig[channel])
        }

        // Handle ICE events
        this.#webrtcClient.addEventListener('icecandidate', event => {
            if (event.candidate) {
                console.log('xSDK client.js - ICE candidate found:', event.candidate)
                this.#webrtcStates.iceCandidates.push(event.candidate)
            }
        });
        this.#webrtcClient.addEventListener('icegatheringstatechange', event => {
            this.#webrtcStates.iceGathering = event.currentTarget.iceGatheringState
            if(event.currentTarget.iceGatheringState === 'complete'){
                console.log('xSDK client.js - ICE candidates gathering completed. Found candidates:', this.#webrtcStates.iceCandidates)
            }
        });
        this.#webrtcClient.addEventListener('iceconnectionstatechange', event => {
            this.#webrtcStates.iceConnection = event.currentTarget.iceConnectionState
            if (event.currentTarget.iceConnectionState === 'connected') {
                console.log('xSDK client.js - ICE connected')
            }
        });
        this.#webrtcClient.addEventListener('connectionstatechange', event => {
            this.#webrtcStates.streamConnection = event.currentTarget.connectionState
            if (event.currentTarget.connectionState === 'connected') {
                console.log('xSDK client.js - Client has been connected to stream. Lets create the videosource..')

                this.createMediaSources()
                this.emitEvent('openstream', { event: event })
            }
        });

        // Create offer
        this.#webrtcClient.createOffer().then((offer) => {
            this.#webrtcClient.setLocalDescription(offer)

            this._application._StreamingView._streamClient.isExchangeReady('configuration').then((data) => {
                console.log('Configuration:', data)
                
                this._application._StreamingView._streamClient.sendSdp(offer.sdp).then((data) => {
                    this._application._StreamingView._streamClient.isExchangeReady('sdp').then((data) => {
                        // Got SDP Data. Lets set config on webrtc client
                        var sdpDetails = JSON.parse(data.exchangeResponse)
                        console.log('xSDK client.js - setRemoteDescription:', sdpDetails.sdpType, sdpDetails.sdp)

                        this.#webrtcClient.setRemoteDescription({
                            type: sdpDetails.sdpType,
                            sdp: sdpDetails.sdp
                        })

                        this._application._StreamingView._streamClient.sendIce(this.#webrtcStates.iceCandidates[0]).then((data) => {

                            // SDP Has been set, lets do ICE
                            this._application._StreamingView._streamClient.isExchangeReady('ice').then((data) => {
                                // Got ICE Data. Lets add the candidates to webrtc client
                                var iceDetails = JSON.parse(data.candidates)
                                console.log('xSDK client.js - ICE Candidates:', iceDetails)

                                for(var candidate in iceDetails){
                                    if(iceDetails[candidate].candidate === 'a=end-of-candidates'){
                                        iceDetails[candidate].candidate = ""
                                    }

                                    this.#webrtcClient.addIceCandidate({
                                        candidate: iceDetails[candidate].candidate,
                                        sdpMid: iceDetails[candidate].sdpMid,
                                        sdpMLineIndex: iceDetails[candidate].sdpMLineIndex
                                    })
                                }

                                // We assume that we are connected now...
                            }).catch((error) => {
                                console.log(error) // Change for throw?
                            })
                        }).catch((error) => {
                            console.log(error) // Change for throw?
                        })
                    }).catch((error) => {
                        console.log(error) // Change for throw?
                    })
                }).catch((error) => {
                    console.log(error) // Change for throw?
                })
            
            }).catch((error) => {
                console.log('SEND SDP ERROR', error)
            })
        })

    }

    openDataChannel(name, config) {
        console.log('xSDK client.js - Creating data channel:', name, config)

        this.#webrtcDataChannels[name] = this.#webrtcClient.createDataChannel(name, config)

        switch(name) {
            case "video":
                this.#webrtcChannelProcessors[name] = new VideoChannel('video', this);
                break;
            case "audio":
                this.#webrtcChannelProcessors[name] = new AudioChannel('audio', this);
                break;
            case "input":
                this.#webrtcChannelProcessors[name] = new InputChannel('input', this);
                break;
            case "control":
                this.#webrtcChannelProcessors[name] = new ControlChannel('control', this);
                break;
            case "chat":
                this.#webrtcChannelProcessors[name] = new ChatChannel('chat', this);
                break;
            case "message":
                this.#webrtcChannelProcessors[name] = new MessageChannel('message', this);
                break;
        }

        this.#webrtcDataChannels[name].addEventListener("open", event => {
            // const message = event.data;
            if(this.#webrtcChannelProcessors[name] !== undefined && this.#webrtcChannelProcessors[name].onOpen !== undefined){
                this.#webrtcChannelProcessors[name].onOpen(event)
            }

            console.log('xSDK client.js - ['+name+'] Got open channel:', event)
        })
    
        this.#webrtcDataChannels[name].addEventListener('message', event => {
            // const message = new Uint8Array(event.data);
            if(this.#webrtcChannelProcessors[name] !== undefined && this.#webrtcChannelProcessors[name].onMessage !== undefined){
                this.#webrtcChannelProcessors[name].onMessage(event)
            } else {
                console.log('xSDK client.js - ['+name+'] Received channel message:', event)
            }
        })

        this.#webrtcDataChannels[name].addEventListener("closing", event => {
            // const message = event.data;
            if(this.#webrtcChannelProcessors[name] !== undefined && this.#webrtcChannelProcessors[name].onClosing !== undefined){
                this.#webrtcChannelProcessors[name].onClosing(event)
            }

            console.log('xSDK client.js - ['+name+'] Got closing channel:', event)
        })

        this.#webrtcDataChannels[name].addEventListener("close", event => {
            // const message = event.data;
            if(this.#webrtcChannelProcessors[name] !== undefined && this.#webrtcChannelProcessors[name].onClose !== undefined){
                this.#webrtcChannelProcessors[name].onClose(event)
            }

            console.log('xSDK client.js - ['+name+'] Got close channel:', event)
        })

        this.#webrtcDataChannels[name].addEventListener("error", event => {
            // const message = event.data;
            if(this.#webrtcChannelProcessors[name] !== undefined && this.#webrtcChannelProcessors[name].onError !== undefined){
                this.#webrtcChannelProcessors[name].onError(event)
            }

            console.log('xSDK client.js - ['+name+'] Got error channel:', event)
        })
    }

    createMediaSources() {
        this.createVideoSources()
        this.createAudioSources()
    }

    createVideoSources() {
        var mediaSource = new MediaSource(),
        videoSourceUrl = window.URL.createObjectURL(mediaSource);

        mediaSource.addEventListener('sourceopen', () => {
            // Add VideoSource
            {
                console.log('xSDK client.js - MediaSource opened. Attaching videoSourceBuffer...');
            
                var videoSourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42c020"');
                videoSourceBuffer.mode = 'sequence'

                videoSourceBuffer.addEventListener('updateend', (event) => {
                    // console.log('xSDK - Updateend video...', event);
                });

                videoSourceBuffer.addEventListener('update', (event) => {
                    // console.log('xSDK - Updateend video...', event);
                });

                videoSourceBuffer.addEventListener('error', (event) => {
                    console.log('xSDK - Error video...', event);
                });

                this.#renderClient.video.videoSource = videoSourceBuffer
            }
        });

        var videoHolder = document.getElementById('videoHolder');
        var videoRender = document.createElement('video');
        videoRender.id = 'videoRender';
        videoRender.src = videoSourceUrl;
        videoRender.width = videoHolder.clientWidth;
        videoRender.height = videoHolder.clientHeight;
        videoRender.play()

        this.#renderClient.video.mediaSource = mediaSource
        this.#renderClient.video.videoRender = videoRender
        
        videoHolder.appendChild(videoRender);
    }

    createAudioSources() {
        var mediaSource = new MediaSource(),
        audioSourceUrl = window.URL.createObjectURL(mediaSource);

        mediaSource.addEventListener('sourceopen', () => {
            // Add AudioSource - Disabled as we dont decoode the audio properly yet..
            {
                if(this.#renderClient.audio.audioSource !== null){
                    mediaSource.removeSourceBuffer(this.#renderClient.audio.audioSource)
                    this.#renderClient.audio.audioSource = null
                }

                console.log('xSDK client.js - MediaSource opened. Attaching audioSourceBuffer...');
            
                var audioSourceBuffer = mediaSource.addSourceBuffer('audio/webm;codecs=opus');
                audioSourceBuffer.mode = 'sequence'

                audioSourceBuffer.addEventListener('updateend', function(event) {
                    // console.log('xSDK - Updateend audio...', event);
                });

                audioSourceBuffer.addEventListener('update', function(event) {
                    // console.log('xSDK - Updateend audio...', event);
                });

                audioSourceBuffer.addEventListener('error', function(event) {
                    console.log('xSDK - Error audio...', event);
                });

                this.#renderClient.audio.audioSource = audioSourceBuffer
            }
        });

        var audioHolder = document.getElementById('videoHolder');
        var audioRender = document.createElement('audio');
        audioRender.id = 'audioRender';
        audioRender.src = audioSourceUrl;
        audioRender.play()

        this.#renderClient.audio.mediaSource = mediaSource
        this.#renderClient.audio.videoRender = audioRender
        
        audioHolder.appendChild(audioRender);
    }

    isExchangeReady(url) {
        return new Promise((resolve, reject) => {

            fetch(url).then(response => {
                if(response.status !== 200){
                    console.log('xSDK client.js - '+url+' - Waiting...')
                    setTimeout(() => {
                        this.isExchangeReady(url).then((data) => {
                            resolve(data)
                        }).catch((error)  => {
                            reject(error)
                        })
                    }, 1000)
                } else {
                    response.json().then(data => {
                        console.log('xSDK client.js - '+url+' - Ready! Got data:', data)
                        resolve(data)
                    })
                }
            })
        })
    }

    addEventListener(name, callback) {
        this.#events[name].push(callback)
    }

    emitEvent(name, event) {
        for(var callback in this.#events[name]){
            this.#events[name][callback](event)
        }
    }

    getVideoSource(){
        return this.#renderClient.video.videoSource
    }

    getAudioSource(){
        return this.#renderClient.audio.audioSource
    }

    getChannel(name) {
        return this.#webrtcDataChannels[name]
    }

    getChannelProcessor(name) {
        return this.#webrtcChannelProcessors[name]
    }

    // reset(){
    //     this.getChannelProcessor('control').requestKeyFrame()
    //     document.getElementById('videoRender').pause()
    //     document.getElementById('videoRender').src = ''

    //     var mediaSource =this.#renderClient.video.mediaSource
    //     var videoSourceUrl = window.URL.createObjectURL(mediaSource);
    //     document.getElementById('videoRender').src = videoSourceUrl;
    //     // document.getElementById('videoRender').play()
    // }
}