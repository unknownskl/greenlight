// if(typeof require != "undefined" && typeof libopus == "undefined"){
//     LIBOPUS_WASM_URL = "assets/opus/libopus.wasm";
//     libopus = require("assets/opus/libopus.wasm.js");
// }

console.log('LIBOPUS: ', libopus)

class AudioChannel extends BaseChannel {

    #frameBuffer = ''
    #frameBufferQueue = []
    #frameBufferSize = 1440 //1440 = 0.2 - 4800 = 1 - 7200 = 1.5

    #audioContext = null
    #gainNode = null
    #audioOffset = null
    #audioFrames = 0

    #packetCounter = 0
    #processedCounter = 0

    #opusDecoder = null
    #worker = null

    #events = {
        'fps': [],
        'queue': [],
    }

    onOpen(event) {
        setInterval(() => {
            // console.log('xSDK channels/video.js - [performance] frameQueue size:', Object.keys(this.#frameQueue).length, 'frameMetadataQueue size:', this.#frameMetadataQueue.length)
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

        var AudioContext = window.AudioContext || window.webkitAudioContext;

        this.#audioContext = new AudioContext({
            latencyHint: 'interactive',
            sampleRate: 48000, //def = 44100,
        });

        // For volume? See https://developer.mozilla.org/en-US/docs/Web/API/GainNode
        this.#gainNode = this.#audioContext.createGain(),
        this.#gainNode.connect(this.#audioContext.destination)

        // // var audioBuffer = this.#audioContext.createBuffer(2, 960, 48000)
        // this.#audioBuffer = this.#audioContext.createBuffer(2, (48000 * 3), 48000) // Why 1440? (targetAudioBufferSize)

        // for (var channel = 0; channel < this.#audioBuffer.numberOfChannels; channel++) {
        //     // This gives us the actual array that contains the data
        //     var nowBuffering = this.#audioBuffer.getChannelData(channel);
        //     for (var i = 0; i < this.#audioBuffer.length; i++) {
        //       // Math.random() is in [0; 1.0]
        //       // audio needs to be in [-1.0; 1.0]
        //       nowBuffering[i] = Math.random() * 2 - 1;
        //     }
        // }

        // var source = this.#audioContext.createBufferSource();

        // // set the buffer in the AudioBufferSourceNode
        // source.buffer = audioBuffer;
        
        // // connect the AudioBufferSourceNode to the
        // // destination so we can hear the sound
        // source.connect(this.#audioContext.destination);
        
        // // start the source playing
        // source.start();


        // Init new OPUS worker
        this.#worker = new Worker('assets/opus/opusworker.js');
        this.#worker.onmessage = function(e) {
            // console.log('Message received from worker:', e.data);
        }

        this.#opusDecoder = new libopus.Decoder(2, 48000);

        setInterval(() => {
            this.sendToMediasource()
        }, 10)

        // var gainNode = this.#audioContext.createGain()
        // gainNode.connect(this.audioContext.destination)
    }

    onMessage(event) {
        this.#packetCounter++

        // if(this.getQueueLength() < 100) {

            var messageBuffer = new DataView(event.data);
            var frameId = messageBuffer.getUint32(0, true);
            var timestamp = (messageBuffer.getUint32(4, true)/10);
            var frameSize = messageBuffer.getUint32(8, true);
            // var frameOffset = messageBuffer.getUint32(12, true);

            var frameData = new Uint8Array(event.data, 12)

            // this.addToQueue(event)

            this.processFrame({
                frameId: frameId,
                timestamp: timestamp,
                frameSize: frameSize,
                // frameOffset: frameOffset,
                // serverDataKey: serverDataKey,
                frameData: frameData
            })
        // }
    }

    processFrame(frameData) {
        // var frameId = frameData.frameId
        // // console.log('xSDK channels/audio.js - Create frameId '+frameId+' and insert data:', frameData)

        // if(this.#frameQueue[frameId] !== undefined){
        //     throw 'This should not happen!! pikachu :O'
        // } else {
        //     this.#frameQueue[frameId] = {
        //         frameId: frameId,
        //         timestamp: frameData.timestamp,
        //         frameSize: frameData.frameSize,
        //         // frameOffset: frameData.frameOffset,
        //         frameData: frameData.frameData
        //     }

            // this.sendToMediasource()
            this.decodeStream(frameData.frameData)

            // if(this.#frameBuffer.length > this.#frameBufferSize) {
            for(; this.#frameBuffer.length > this.#frameBufferSize;){
                // Lets split up the packets
                // fetch x size

                // this.#opusDecoder.postMessage({

                // });

                // console.log('outputBuffer1', this.#frameBuffer.slice(0, this.#frameBufferSize).length)
                var outputBuffer = this.str2ab(this.#frameBuffer.slice(0, this.#frameBufferSize))
                // console.log('outputBuffer2', outputBuffer)
                var outputBuffer = new Int16Array(outputBuffer)
                // console.log('outputBuffer3', outputBuffer)
                // console.log('before framebuffer', this.#frameBuffer.length)
                this.#frameBuffer = this.#frameBuffer.slice(this.#frameBufferSize)

                // console.log('after framebuffer', this.#frameBuffer.length)

                // for(var i = 0; i < this.#frameBufferSize; i++){
                //     outputBuffer[i] = this.#frameBuffer.shift()
                // }
                // var outputBuffer = this.#frameBuffer.splice(0, this.#frameBufferSize)

                this.#frameBufferQueue.push(outputBuffer)
                // console.log('created frameBufferQueue')
                // this.sendToMediasource() // This here will cause performance issues.
            }
            // } else {
            //     // Wait for more packets.
            //     console.log('wait with frameBufferQueue')
            // }

        // }

    }

    decodeStream(data) {
        // var worker = this.worker()
        // console.log('worker:', worker)

        // Things we know:
        // - Codec is opus
        // - SampleRateHz is 24000 (20000+4000)
        // - Each frame we get is 20ms of sound

        // console.log('INPUT:', data)
        this.#opusDecoder.input(data)
        var output = ''

        while(output = this.#opusDecoder.output()){

            // // var audioBuffer = this.#audioContext.createBuffer(2, 960, 48000)
            // var audioBuffer = this.#audioContext.createBuffer(2, 1440, 48000) // 1440? (targetAudioBufferSize) (960 * 1.5)

            // if(audioBuffer.numberOfChannels != 2){
            //     throw 'audioBuffer.numberOfChannels is not 2.. Cannot process audio...'
            // }

            // var leftChannel = audioBuffer.getChannelData(0);
            // var rightChannel = audioBuffer.getChannelData(0);

            // var floatValues = []
            // for (var i = 0; i < output.length; i++) {
            //     // Math.random() is in [0; 1.0]
            //     // audio needs to be in [-1.0; 1.0]
            //     var value = output[i]
            //     value /= 32767;
            //     floatValues[i] = value

            //     if(! (i % 2)) {
            //         var channel = leftChannel
            //     } else {
            //         var channel = rightChannel
            //     }
                
            //     channel[i] = floatValues[i]
            // }
            // console.log('float:', floatValues)

            // var source = this.#audioContext.createBufferSource()
            // source.buffer = audioBuffer
            // source.connect(this.#audioContext.destination)
            
            // source.start()

            /** Refactored block */
            output = this.ab2str(output)
            // console.log('DECODED:', output)
            this.#frameBuffer += output
        }

        // this.#opusDecoder.postMessage(data);

        // this.#audioContext.decodeAudioData(data.buffer, (event) => {
        //     console.log('DECODE:', event)
        // }, (error) => {
        //     console.log('DECODE error:', error)
        // })
    }

    sendToMediasource() {
        var client = this.getClient()

        if(this.#audioContext.state === 'running'){
            // console.log('AudioSource is running:', this.#audioContext.state)

            // var outputBuffer = [];
            // if(this.#frameBuffer.length > this.#frameBufferSize){
            if(this.#frameBufferQueue.length > 0){

                // Set audio offset
                if(this.#audioOffset === null){
                    // this.#audioOffset = this.#audioContext.currentTime
                    this.#audioOffset = 0
                }
                
                var outputBuffer = this.#frameBufferQueue.shift()
                var frameCount = 1

                // var outputBuffer = []
                // var frameCount = 0;
                // for(;this.#frameBufferQueue.length > 0;){
                //     var outputBuffer = outputBuffer.concat(this.#frameBufferQueue.shift())
                //     frameCount++
                // }

                this.#audioFrames += frameCount
                this.#audioOffset += (frameCount * 0.02) // one frame is 20ms

                // console.log(outputBuffer);
                // outputBuffer = this.str2ab(outputBuffer)

                // console.log('this.#frameBuffer:', this.#frameBuffer)
                // console.log('outputBuffer:', outputBuffer)

                // Create audiostream
                var audioBuffer = this.#audioContext.createBuffer(2, (this.#frameBufferSize*frameCount), 48000) // 1440? (targetAudioBufferSize) (960 * 1.5)

                if(audioBuffer.numberOfChannels != 2){
                    throw 'audioBuffer.numberOfChannels is not 2.. Cannot process audio...'
                }

                var leftChannel = audioBuffer.getChannelData(0);
                var rightChannel = audioBuffer.getChannelData(0);

                // console.log('play audio: raw', outputBuffer)
                outputBuffer = Int16Array.from(outputBuffer)
                // console.log('play audio: int16', outputBuffer)
                var outputBuffer = this.arrayIntToFloat(outputBuffer)
                // console.log('play audio: float', outputBuffer)
                this.#processedCounter++;

                for (var i = 0; i < outputBuffer.length; i++) {
                    if(! (i % 2)) {
                        var channel = leftChannel
                    } else {
                        var channel = rightChannel
                    }
                    
                    channel[i] = outputBuffer[i]
                }

                var source = this.#audioContext.createBufferSource()
                source.buffer = audioBuffer
                source.connect(this.#gainNode)
                
                // console.log('AudioContext:', this.#audioContext.currentTime, this.#audioOffset)
                // source.start(this.#audioOffset)
                source.start()
                // console.log('aaaaand play source!')
                
            } else {
                // console.log('Framebuffer not filled yet. skipping...')
            }

        } else {
            // console.log('AudioSource is not running:', this.#audioContext.state)
        }
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