// if(typeof require != "undefined" && typeof libopus == "undefined"){
//     LIBOPUS_WASM_URL = "assets/opus/libopus.wasm";
//     libopus = require("assets/opus/libopus.wasm.js");
// }

console.log('LIBOPUS: ', libopus)

class AudioChannel extends BaseChannel {

    #frameBuffer = ''
    #frameBufferQueue = []
    #frameSampleSize = 960 // This is always 960.
    #frameBufferSize = 1440 // 960 = 20ms/0.02, 1440 = 30ms/0.03, 4800 = 100ms/0.1, 9600 = 200ms/0.2, 48000 = 1000ms/1
    #frameBufferDuration = 30 // in MS

    #audioContext = null
    #gainNode = null
    #audioOffset = null
    #audioTimeOffset = 0
    #audioFrames = 0
    #audioDelay = 30 // in MS
    #audioBuffers = {
        num: 0,
        buffers: []
    }

    #maxAudioLatency
    #minAudioLatency
    #audioLatency = []

    // #performanceTestVar = 0

    #packetCounter = 0
    #processedCounter = 0

    #opusDecoder = null
    #worker = null

    #events = {
        'fps': [],
        'queue': [],
        'latency': [],
    }

    onOpen(event) {
        setInterval(() => {
            // console.log('xSDK channels/video.js - [performance] frameQueue size:', Object.keys(this.#frameQueue).length, 'frameMetadataQueue size:', this.#frameMetadataQueue.length)
            // calc latency
            var latencyCount = 0;
            for(var latencyTime in this.#audioLatency){

                if(this.#audioLatency[latencyTime] !== undefined){
                    latencyCount += this.#audioLatency[latencyTime]
                }
            }
            // console.log('PROCESS LATENCY:', latencyCount, '/', this.#audioLatency.length, '=', (latencyCount/this.#audioLatency.length))
            if(this.#audioLatency.length > 0){
                latencyCount = (latencyCount/this.#audioLatency.length)
            }

            this.emitEvent('latency', { minLatency: Math.round(this.#minAudioLatency*100)/100, avgLatency: Math.round(latencyCount*100)/100, maxLatency: Math.round(this.#maxAudioLatency*100)/100 })
            this.#maxAudioLatency = undefined
            this.#minAudioLatency = undefined
            this.#audioLatency = []

            // Reset audio engine when the latency climbs
            if(Math.round(latencyCount*100)/100 > 60){
                this.softReset()
                setTimeout(() => {
                    this.softReset()
                }, 300)
            }

            // Calc queue
            var fps = this.#processedCounter
            this.emitEvent('queue', {
                frameBuffer: this.#frameBuffer.length,
                frameBufferQueue: this.#frameBufferQueue.length,
                packetCounter: this.#packetCounter,
                fps: fps
            })
            
            this.#packetCounter = 0
            this.#processedCounter = 0
            // this.#frameCounter = 0

            this.emitEvent('fps', { fps: fps })
        }, 1000)

        setInterval(() => {
            this.softReset()
        }, 6000)

        var AudioContext = window.AudioContext || window.webkitAudioContext;

        this.#audioContext = new AudioContext({
            latencyHint: 'interactive',
            sampleRate: 48000, //def = 44100,
        });

        // For volume? See https://developer.mozilla.org/en-US/docs/Web/API/GainNode
        this.#gainNode = this.#audioContext.createGain(),
        this.#gainNode.gain.value = 2 // 200 %
        this.#gainNode.connect(this.#audioContext.destination)

        // Init new OPUS worker
        this.#worker = new Worker('assets/opus/opusworker.js');
        this.#worker.onmessage = function(e) {
            // console.log('Message received from worker:', e.data);
        }

        this.#opusDecoder = new libopus.Decoder(2, 48000);

        setInterval(() => {
            if(this.#frameBufferQueue.length > 0){
                this.sendToMediasource()
            }
        }, 5)
    }

    onMessage(event) {
        this.#packetCounter++

        var messageBuffer = new DataView(event.data);
        var frameId = messageBuffer.getUint32(0, true);
        var timestamp = (messageBuffer.getUint32(4, true)/10);
        var frameSize = messageBuffer.getUint32(8, true);
        // var frameOffset = messageBuffer.getUint32(12, true);

        var frameData = new Uint8Array(event.data, 12)

        // this.addToQueue(event)

        var processedFrame = this.processFrame({
            frameId: frameId,
            timestamp: timestamp,
            frameSize: frameSize,
            // frameOffset: frameOffset,
            // serverDataKey: serverDataKey,
            frameData: frameData,
            frameReceived: performance.now()
        })

        // Calc latency
        const frameProcessedMs = (processedFrame.frameDecoded-processedFrame.frameReceived)

        if(frameProcessedMs > this.#maxAudioLatency || this.#maxAudioLatency === undefined){
            this.#maxAudioLatency = frameProcessedMs
        } else if(frameProcessedMs < this.#minAudioLatency || this.#minAudioLatency === undefined){
            this.#minAudioLatency = frameProcessedMs
        }
        this.#audioLatency.push(frameProcessedMs)
    }

    processFrame(frameData) {
       
        // this.decodeStream(frameData.frameData)

        // Decode packet
        this.#opusDecoder.input(frameData.frameData)
        var output = ''
        while(output = this.#opusDecoder.output()){
            output = this.ab2str(output)
            this.#frameBuffer += output
        }

        // Check if we meet the minimum length for the buffer frame
        for(; this.#frameBuffer.length > (this.#frameBufferSize*2);){ // 2 = num of channels?

            var outputBuffer = this.str2ab(this.#frameBuffer.slice(0, (this.#frameBufferSize*2)))
            outputBuffer = new Int16Array(outputBuffer)
            this.#frameBuffer = this.#frameBuffer.slice((this.#frameBufferSize*2))

            this.#frameBufferQueue.push(outputBuffer)
        }

        frameData.frameDecoded = performance.now()
        return frameData

    }

    sendToMediasource() {
        // console.log('sendToMediasource called. performance.now:', (performance.now()-this.#performanceTestVar) , performance.now())
        // this.#performanceTestVar = performance.now()

        // var client = this.getClient()

        if(this.#audioContext.state === 'running'){

            // var timing = (this.#audioOffset + this.#audioTimeOffset)
            // var delay = (timing-this.#audioContext.currentTime)*1000
            // if(delay < 0){ delay = 1 }
            // var audioTimeline = (this.#audioFrames * this.#frameBufferDuration)

            // console.log('Check: ', audioTimeline, '<', delay)

            if(this.#frameBufferQueue.length > 0){

                // Set audio offset
                if(this.#audioOffset === null){
                    this.#audioOffset = Math.round(this.#audioContext.currentTime * 100) / 100
                    // this.#audioOffset = this.#audioContext.currentTime
                }
                
                // Single frame
                var outputBuffer = this.#frameBufferQueue.shift()
                var frameCount = 1

                // @TODO: Multi frame?
                // var outputBuffer = []
                // var frameCount = 0;
                // for(;this.#frameBufferQueue.length > 0;){
                //     var outputBuffer = outputBuffer.concat(this.#frameBufferQueue.shift())
                //     frameCount++
                // }

                this.#audioFrames += frameCount

                // console.log('play audio frame: framecount:', this.#audioFrames, 'now():', performance.now(),'this.#audioOffset', this.#audioOffset, 'start at:', this.#audioTimeOffset, 'media currentTime:', this.#audioContext.currentTime, 'media start at:', (this.#audioOffset+this.#audioTimeOffset))

                this.playFrameBuffer(outputBuffer)
                // console.log('add duration:', (this.#frameBufferDuration/1000))
                this.#audioTimeOffset = this.#audioTimeOffset + (this.#frameBufferDuration/1000) // frameBufferDuration / 1000 = value in MS

                // if(this.#frameBufferQueue.length > 0){
                //     this.sendToMediasource()
                // }
                
            } else {
                // console.log('Framebuffer not filled yet. skipping...')
            }

        } else {
            // console.log('AudioSource is not running:', this.#audioContext.state)
        }
    }

    playFrameBuffer(outputBuffer) {
        // console.log('performance.now:', (performance.now()-this.#performanceTestVar) , performance.now());
        
        // this.#performanceTestVar = performance.now()
        if(this.#audioBuffers.buffers[this.#audioBuffers.num] === undefined) {
            var audioBuffer = this.#audioContext.createBuffer(2, outputBuffer.length, 96000) // 1440? (targetAudioBufferSize) (960 * 1.5) @TODO: Figure out why 96000 works as sampling rate while it is actually 48000...

            this.#audioBuffers.buffers.push(audioBuffer)
        } else {
            // We already have an audiobuffer
            var audioBuffer = this.#audioBuffers.buffers[this.#audioBuffers.num]
        }

        this.#audioBuffers.num++
        if(this.#audioBuffers.num > 3){
            this.#audioBuffers.num = 0
        }

        // console.log('this.#audioBuffers', this.#audioBuffers)

        // var audioBuffer = this.#audioContext.createBuffer(2, (outputBuffer.length/2), 96000) // 1440? (targetAudioBufferSize) (960 * 1.5) @TODO: Figure out why 96000 works as sampling rate while it is actually 48000...
        // console.log('Play frame at timing:', timing)
        
        // console.log('audiobuffer', audioBuffer)
        if(audioBuffer.numberOfChannels != 2){
            throw 'audioBuffer.numberOfChannels is not 2.. Cannot process audio...'
        }

        var leftChannel = audioBuffer.getChannelData(0);
        var rightChannel = audioBuffer.getChannelData(1);

        outputBuffer = Int16Array.from(outputBuffer)
        outputBuffer = this.arrayIntToFloat(outputBuffer)
        this.#processedCounter++;

        // For stereo
        for (var i = 0; i < outputBuffer.length; i++) {
            if(! (i % 2)) {
                leftChannel[i] = outputBuffer[i]
            } else {
                rightChannel[i] = outputBuffer[i]
            }
        }

        // For mono? @TODO: Not sure why but this below has the same result as the one for stereo. Have to figure out why this happens...
        // for (var i = 0; i < outputBuffer.length; i++) {
        //     leftChannel[i] = outputBuffer[i]
        //     rightChannel[i] = outputBuffer[i]
        // }

        var source = this.#audioContext.createBufferSource()
        source.buffer = audioBuffer
        source.connect(this.#gainNode)
        
        var startTime = (this.#audioOffset+this.#audioTimeOffset+(this.#audioDelay/1000)) // in MS
        var delay = (startTime-this.#audioContext.currentTime) // in MS
        // console.log('delay:', delay, 'startTime:', startTime) // Delay should always > 0. If it drops < 0, increase the delay, or drop sound buffer packet maybe?
        
        var delaySteps = 3
        if(delay < 0) {
            // var newLength = (this.#frameBufferDuration - (-delay*1000)) // New length in ms
            console.log('Drop audio packet because the timing are off. Audio should have played ', delay, 'ms ago... Increasing audio delay:', this.#audioDelay, '=>', this.#audioDelay+delaySteps)
            this.#audioDelay += delaySteps

            // if(this.#audioDelay > 40){
            //     this.softReset()
            //     setTimeout(() => {
            //         this.softReset()
            //     }, 300)
            // }

            

        // } else if(delay > 10) {
        //     console.log('Drop audio packet because the timing are off. Audio should have played ', delay, 'ms ago... Decreasing audio delay:', this.#audioDelay, '=>', this.#audioDelay+delaySteps)
        //     this.#audioDelay -= delaySteps
        } else {
            // source.playbackRate.value = 1.0
            source.start(startTime);
        }
    }

    softReset(){
        console.log('audio.js: Performing soft reset')

        this.#frameBufferQueue = []

        this.#audioOffset = Math.round(this.#audioContext.currentTime * 100) / 100
        this.#audioDelay = 30
        this.#audioTimeOffset = 0.03
    }

    arrayIntToFloat(intArray){
        var floatValues = []
        for (var i = 0; i < intArray.length; i++) {
            var value = intArray[i]
            value /= 32767;
            floatValues[i] = value
        }
        return floatValues
    }

    addEventListener(name, callback) {
        this.#events[name].push(callback)
    }

    emitEvent(name, event) {
        for(var callback in this.#events[name]){
            this.#events[name][callback](event)
        }
    }

    ab2str(buf) {
        return String.fromCharCode.apply(null, new Uint16Array(buf));
    }

    str2ab(str) {
        var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
        var bufView = new Uint16Array(buf);
        for (var i=0, strLen=str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    }
    
}