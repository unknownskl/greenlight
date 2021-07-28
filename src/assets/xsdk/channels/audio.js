class AudioChannel extends BaseChannel {

    #frameBuffer = ''
    #frameBufferQueue = []
    #frameSampleSize = 960 // This is always 960.
    #frameBufferSize = 1440 // 960 = 20ms/0.02, 1440 = 30ms/0.03, 4800 = 100ms/0.1, 9600 = 200ms/0.2, 48000 = 1000ms/1
    #frameBufferDuration = 20 // in MS

    #audioContext = null
    #gainNode = null
    #audioOffset = null
    #audioTimeOffset = 0
    #audioFrames = 0
    #audioDelay = 20 // in MS
    #audioBuffers = {
        num: 0,
        buffers: []
    }

    #frameCounter = 0
    #bitrateCounter = {
        packets: [],
        audio: []
    }
    #audioLatency = []

    #worker = null

    #events = {
        'fps': [],
        'queue': [],
        'bitrate': [],
        'latency': [],
    }

    onOpen(event) {
        this.#worker = new Worker('assets/xsdk/workers/audio.js');
        this.#worker.onmessage = (workerMessage) => {
            
            if(workerMessage.data.action == 'startStream'){
                if(workerMessage.data.status === 200){
                    console.log('xSDK channels/audio.js - Worker onOpen finished successfully')
                } else {
                    console.log('xSDK channels/audio.js - Worker onOpen failed:', workerMessage.data)
                }

            } else if(workerMessage.data.action == 'doRenderAudio'){
                // console.log('xSDK channels/audio.js - doRenderAudio, render frame:', (workerMessage.data.data.frame), 'data:', (workerMessage.data.data.audioBuffer))
                if(workerMessage.data.status !== 200){
                    console.log('xSDK channels/audio.js - Worker doRenderAudio failed:', workerMessage.data)
                } else {
                    this.doRenderAudio(workerMessage.data.data.frame, workerMessage.data.data.audioBuffer)
                }

            } else if(workerMessage.data.action == 'onPacket'){
                if(workerMessage.data.status !== 200){
                    console.log('xSDK channels/audio.js - Worker onPacket failed:', workerMessage.data)
                }
            } else {
                console.log('xSDK channels/audio.js - Unknown worker response action:', workerMessage.data)
            }
        }

        this.#worker.postMessage({
            action: 'startStream'
        })

        setTimeout(() => {
            this.softReset()
        }, 300)

        setInterval(() => {
            this.calculateBitrate()
            this.calculateLatency()
            this.calculateFps()
        }, 1000)

        setInterval(() => {
            this.softReset()
        }, 6000)

        var AudioContext = window.AudioContext || window.webkitAudioContext;

        this.#audioContext = new AudioContext({
            latencyHint: 'interactive',
            sampleRate: 48000,
        });

        // For volume? See https://developer.mozilla.org/en-US/docs/Web/API/GainNode
        this.#gainNode = this.#audioContext.createGain(),
        this.#gainNode.gain.value = 2 // 200 %
        this.#gainNode.connect(this.#audioContext.destination)

        setInterval(() => {
            if(this.#frameBufferQueue.length > 0){
                this.sendToMediasource()
            }
        }, 5)
    }
    
    calculateLatency() {
        var latencyCount = 0;
        var minLatency = 999;
        var maxLatency = 0;

        for(var latencyTime in this.#audioLatency){
            if(this.#audioLatency[latencyTime] !== undefined){
                latencyCount += this.#audioLatency[latencyTime]
            }

            if(this.#audioLatency[latencyTime] < minLatency)
                minLatency = this.#audioLatency[latencyTime]

            if(this.#audioLatency[latencyTime] > maxLatency)
                maxLatency = this.#audioLatency[latencyTime]
        }
        
        if(this.#audioLatency.length > 0){
            latencyCount = (latencyCount/this.#audioLatency.length)
        }

        this.emitEvent('latency', { minLatency: Math.round(minLatency*100)/100, avgLatency: Math.round(latencyCount*100)/100, maxLatency: Math.round(maxLatency*100)/100 })
        this.#audioLatency = []
    }

    calculateBitrate() {
        // Calculate bitrate
        var bitratePacketsValue = 0
        var bitrateAudioValue = 0

        for(var frame in this.#bitrateCounter.packets){
            if(this.#bitrateCounter.packets[frame] !== undefined){
                bitratePacketsValue += this.#bitrateCounter.packets[frame]
            }
        }
        for(var audio in this.#bitrateCounter.audio){
            if(this.#bitrateCounter.audio[audio] !== undefined){
                bitrateAudioValue += this.#bitrateCounter.audio[audio]
            }
        }

        bitratePacketsValue = Math.round((bitratePacketsValue*8)/1000)
        bitrateAudioValue = Math.round((bitrateAudioValue*8)/1000)

        this.emitEvent('bitrate', { packetBitrate: Math.round(bitratePacketsValue*100)/100, audioBitrate: Math.round(bitrateAudioValue*100)/100 })
        this.#bitrateCounter.audio = []
        this.#bitrateCounter.packets = []
    }

    calculateFps() {
        // Calculate fps
        var fps = this.#frameCounter
        this.emitEvent('fps', { fps: fps })
        this.#frameCounter = 0
    }

    onMessage(event) {
        this.#worker.postMessage({
            action: 'onPacket',
            data: {
                data: event.data,
                timePerformanceNow: performance.now()
            }
        })

        this.#bitrateCounter.packets.push(event.data.byteLength)
    }

    doRenderAudio(frame, audioBuffer) {
        this.#frameBufferQueue.push(audioBuffer)
        this.#bitrateCounter.audio.push(audioBuffer.length)

        this.#frameCounter++

        const frameProcessedMs = (performance.now()-frame.frameReceived)
        this.#audioLatency.push(frameProcessedMs)
    }

    sendToMediasource() {
        if(this.#audioContext.state === 'running'){
            if(this.#frameBufferQueue.length > 0){

                // Set audio offset
                if(this.#audioOffset === null){
                    this.#audioOffset = Math.round(this.#audioContext.currentTime * 100) / 100
                }
                
                this.playFrameBuffer(this.#frameBufferQueue.shift())
                this.#audioTimeOffset = this.#audioTimeOffset + (this.#frameBufferDuration/1000) // frameBufferDuration / 1000 = value in MS
                
            } else {
                // console.log('Framebuffer not filled yet. skipping...')
            }

        } else {
            // console.log('AudioSource is not running:', this.#audioContext.state)
        }
    }

    playFrameBuffer(outputBuffer) {
        var audioBuffer

        if(this.#audioBuffers.buffers[this.#audioBuffers.num] === undefined) {
            audioBuffer = this.#audioContext.createBuffer(2, outputBuffer.length, 96000) // 1440? (targetAudioBufferSize) (960 * 1.5) @TODO: Figure out why 96000 works as sampling rate while it is actually 48000...
            this.#audioBuffers.buffers.push(audioBuffer)
        } else {
            audioBuffer = this.#audioBuffers.buffers[this.#audioBuffers.num]
        }

        this.#audioBuffers.num++
        if(this.#audioBuffers.num > 3){
            this.#audioBuffers.num = 0
        }

        if(audioBuffer.numberOfChannels != 2){
            throw 'audioBuffer.numberOfChannels is not 2.. Cannot process audio...'
        }

        var leftChannel = audioBuffer.getChannelData(0);
        var rightChannel = audioBuffer.getChannelData(1);

        for (var i = 0; i < outputBuffer.length; i++) {
            if(! (i % 2)) {
                leftChannel[i] = outputBuffer[i]
            } else {
                rightChannel[i] = outputBuffer[i]
            }
        }

        var source = this.#audioContext.createBufferSource()
        source.buffer = audioBuffer
        source.connect(this.#gainNode)
        
        var startTime = (this.#audioOffset+this.#audioTimeOffset+(this.#audioDelay/1000)) // in MS
        var delay = (startTime-this.#audioContext.currentTime) // in MS
        
        var delaySteps = 3
        if(delay < 0) {
            // var newLength = (this.#frameBufferDuration - (-delay*1000)) // New length in ms
            console.log('Drop audio packet because the timing are off. Audio should have played ', delay, 'ms ago... Increasing audio delay:', this.#audioDelay, '=>', this.#audioDelay+delaySteps)
            this.#audioDelay += delaySteps
        } else {
            source.start(startTime);
        }
    }

    softReset(){
        console.log('audio.js: Performing soft reset')

        this.#frameBufferQueue = []

        this.#audioOffset = Math.round(this.#audioContext.currentTime * 100) / 100
        this.#audioDelay = 20
        this.#audioTimeOffset = 0.02
    }

    addEventListener(name, callback) {
        this.#events[name].push(callback)
    }

    emitEvent(name, event) {
        for(var callback in this.#events[name]){
            this.#events[name][callback](event)
        }
    }
    
}