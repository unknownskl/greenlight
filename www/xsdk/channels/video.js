class VideoChannel extends BaseChannel {

    #frameQueue = {}
    #frameMetadataQueue = []

    #currentWidth = 0
    #currentHeight = 0

    #frameCounter = 0
    #packetCounter = 0

    #events = {
        'fps': [],
        'queue': [],
    }

    onOpen(event) {
        setInterval(() => {
            var fps = this.#frameCounter
            this.emitEvent('queue', { videoQueue: Object.keys(this.#frameQueue).length, frameMetadataQueue: this.#frameMetadataQueue.length, frameCounter: fps, packetCounter: this.#packetCounter })
            
            this.#packetCounter = 0
            this.#frameCounter = 0

            this.emitEvent('fps', { fps: fps })
        }, 1000)
    }

    onMessage(event) {
        var messageBuffer = new DataView(event.data);
        var frameId = messageBuffer.getUint32(0, true);
        var timestamp = (messageBuffer.getUint32(4, true)/10);
        var frameSize = messageBuffer.getUint32(8, true);
        var frameOffset = messageBuffer.getUint32(12, true);
        var serverDataKey = messageBuffer.getUint32(16, true);

        var offset = 20; //@TODO: Check if isKeyFrame. if true => 21, else 20.

        var frameData = new Uint8Array(event.data, offset)

        this.processFrame({
            frameId: frameId,
            timestamp: timestamp,
            frameSize: frameSize,
            frameOffset: frameOffset,
            serverDataKey: serverDataKey,
            frameData: frameData
        })

        this.#packetCounter++

    }

    processFrame(frameData) {
        var frameId = frameData.frameId
        // console.log('xSDK channels/video.js - Create frameId '+frameId+' and insert data:', frameData)

        // Check if frame already exists
        if(this.#frameQueue[frameId] !== undefined){
            var frameDataBuffer = new Uint8Array(this.#frameQueue[frameId].frameData)
            frameDataBuffer.set(frameData.frameData, frameData.frameOffset)

            this.#frameQueue[frameId].bytesReceived += frameData.frameData.byteLength
            this.#frameQueue[frameId].frameData = frameDataBuffer

        } else {
            var frameDataBuffer = new Uint8Array(new ArrayBuffer(frameData.frameSize))
            frameDataBuffer.set(frameData.frameData, frameData.frameOffset)
            var bytesReceived = frameData.frameData.byteLength

            this.#frameQueue[frameId] = {
                frameId: frameId,
                timestamp: frameData.timestamp,
                frameSize: frameData.frameSize,
                frameData: frameDataBuffer,
                bytesReceived: bytesReceived,
                serverDataKey: frameData.serverDataKey,
                fullFrame: false
            }
        }

        // Check if we have a full frame
        if(this.#frameQueue[frameId].bytesReceived === this.#frameQueue[frameId].frameSize){
            this.#frameQueue[frameId].fullFrame = true
            this.#frameCounter++
            // console.log('xSDK channels/video.js - FrameId '+frameId+' completed. Sending to videobuffer...')

            // Save frame metadata
            if(this.#currentWidth !== 0 && this.#currentHeight !== 0) {
                this.#frameMetadataQueue.push({
                    timestamp: +frameData.timestamp / 10,
                    frameId: frameData.frameId,
                    // isKeyframe: false, // this.#frameQueue[frameId].isKeyFrame
                    serverDataKey: frameData.serverDataKey,
                    firstFramePacketArrivalTimeMs: performance.now(),
                    frameSubmittedTimeMs: performance.now(), // performance.now();
                    frameDecodedTimeMs: performance.now(),
                    frameRenderedTimeMs: performance.now(),
                })

                // console.log('xSDK channels/video.js - save frame metadata:', this.#frameMetadataQueue)
            }

            this.sendToMediasource()
        }
    }

    sendToMediasource() {
        var client = this.getClient()
        var frameQueue = Object.keys(this.#frameQueue)

        // Check if we have a frame in buffer. Otherwise ignore
        if(frameQueue.length > 0) {
        
            if(client.getVideoSource().updating === false){

                var frameData = new Uint8Array(0);
                for(var queuedFrame in frameQueue){

                    var nextFrame = frameQueue[queuedFrame]
                    var frame = this.#frameQueue[nextFrame]

                    delete this.#frameQueue[nextFrame]
                    frameData = this.mergeFrames(frameData, frame.frameData)
                }
                client.getVideoSource().appendBuffer(frameData);
            }
        }
    }

    mergeFrames(buffer1, buffer2) {
        var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);

        return tmp.buffer;
    }

    setVideoDimension(width, height) {
        this.#currentWidth = width
        this.#currentHeight = height
    }

    getFrameMetadataQueue() {
        var queue = this.#frameMetadataQueue
        this.#frameMetadataQueue = []

        return queue
    }
    
    getFrameMetadataLength() {
        return this.#frameMetadataQueue.length
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