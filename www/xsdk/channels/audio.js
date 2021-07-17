class AudioChannel extends BaseChannel {

    #frameQueue = {}

    #audioContext = null

    #packetCounter = 0

    #events = {
        'fps': [],
        'queue': [],
    }

    onOpen(event) {
        setInterval(() => {
            // console.log('xSDK channels/video.js - [performance] frameQueue size:', Object.keys(this.#frameQueue).length, 'frameMetadataQueue size:', this.#frameMetadataQueue.length)
            var fps = this.#packetCounter
            this.emitEvent('queue', { frameQueue: Object.keys(this.#frameQueue).length, packetCounter: this.#packetCounter, fps: fps })
            
            this.#packetCounter = 0
            // this.#frameCounter = 0

            this.emitEvent('fps', { fps: fps })
        }, 1000)

        var AudioContext = window.AudioContext || window.webkitAudioContext;

        this.#audioContext = new AudioContext({
            latencyHint: 'interactive',
            sampleRate: 48000, //def = 44100,
        });

        // var gainNode = this.#audioContext.createGain()
        // gainNode.connect(this.audioContext.destination)
    }

    onMessage(event) {
        this.#packetCounter++

        if(this.getQueueLength() < 50) {

            var messageBuffer = new DataView(event.data);
            var frameId = messageBuffer.getUint32(0, true);
            var timestamp = (messageBuffer.getUint32(4, true)/10);
            var frameSize = messageBuffer.getUint32(8, true);
            // var frameOffset = messageBuffer.getUint32(12, true);

            var frameData = new Uint8Array(event.data, 12)

            this.addToQueue(event)

            this.processFrame({
                frameId: frameId,
                timestamp: timestamp,
                frameSize: frameSize,
                // frameOffset: frameOffset,
                // serverDataKey: serverDataKey,
                frameData: frameData
            })
        }
    }

    processFrame(frameData) {
        var frameId = frameData.frameId
        console.log('xSDK channels/audio.js - Create frameId '+frameId+' and insert data:', frameData)

        if(this.#frameQueue[frameId] !== undefined){
            throw 'This should not happen!! pikachu :O'
        } else {
            this.#frameQueue[frameId] = {
                frameId: frameId,
                timestamp: frameData.timestamp,
                frameSize: frameData.frameSize,
                // frameOffset: frameData.frameOffset,
                frameData: frameData.frameData
            }

            this.sendToMediasource()
            // var audio = this.decodeStream(frameData.frameData)
        }

    }

    decodeStream(data) {
        // var worker = this.worker()
        // console.log('worker:', worker)

        // this.#audioContext.decodeAudioData(data.buffer, (event) => {
        //     console.log('DECODE:', event)
        // }, (error) => {
        //     console.log('DECODE error:', error)
        // })
    }

    sendToMediasource() {
        var client = this.getClient()

        if(client.getAudioSource().updating === false){
            var nextFrame = Object.keys(this.#frameQueue)[0]
            var frame = this.#frameQueue[nextFrame]

            console.log(frame)
            
            delete this.#frameQueue[nextFrame]

            // client.getAudioSource().appendBuffer(frame.frameData);
        }
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