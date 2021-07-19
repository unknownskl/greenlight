class VideoChannel extends BaseChannel {

    #frameQueue = {}
    #frameMetadataQueue = []

    #currentWidth = 0
    #currentHeight = 0

    #frameCounter = 0
    #packetCounter = 0

    #bitrateCounter = []
    #bitrateTimeNum = 0

    #minVideoLatency = 0
    #maxVideoLatency = 0
    #videoLatency = []

    #events = {
        'fps': [],
        'queue': [],
        'bitrate': [],
        'latency': [],
    }

    onOpen(event) {
        setInterval(() => {
            // calc latency
            var latencyCount = 0;
            for(var latencyTime in this.#videoLatency){

                if(this.#videoLatency[latencyTime] !== undefined){
                    latencyCount += this.#videoLatency[latencyTime]
                }
            }
            // console.log('PROCESS LATENCY:', latencyCount, '/', this.#videoLatency.length, '=', (latencyCount/this.#videoLatency.length))
            if(this.#videoLatency.length > 0){
                latencyCount = (latencyCount/this.#videoLatency.length)
            }

            this.emitEvent('latency', { minLatency: Math.round(this.#minVideoLatency*100)/100, avgLatency: Math.round(latencyCount*100)/100, maxLatency: Math.round(this.#maxVideoLatency*100)/100 })
            this.#maxVideoLatency = 0
            this.#minVideoLatency = 0
            this.#videoLatency = []

            var fps = this.#frameCounter

            // Calc actual bitrate
            var bitrateStable = false
            var bitrateDataCount = 0
            var bytesCount = 0
            for(var bitrateTime in this.#bitrateCounter){

                if(this.#bitrateCounter[bitrateTime] !== undefined){
                    bytesCount += this.#bitrateCounter[bitrateTime]
                    bitrateDataCount++
                }
            }
            if(bitrateDataCount == 60) {
                bitrateStable = true
            }
            var bitrate = (bytesCount/1000) // filesize / (minutes* 0.0075)

            // Emit event
            this.emitEvent('queue', { videoQueue: Object.keys(this.#frameQueue).length, frameMetadataQueue: this.#frameMetadataQueue.length, frameCounter: fps, packetCounter: this.#packetCounter, bitrate: bitrate+' KBps', bitrateStable: bitrateStable })
            this.emitEvent('bitrate', { bitrate: bitrate+' KBps', bitrateStable: bitrateStable })
            
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
                fullFrame: false,

                firstFramePacketArrivalTimeMs: performance.now(),
                frameSubmittedTimeMs: performance.now(), // performance.now();
                frameDecodedTimeMs: performance.now(),
                frameRenderedTimeMs: performance.now(), // Move to render and then add data
            }
        }

        // Check if we have a full frame
        if(this.#frameQueue[frameId].bytesReceived === this.#frameQueue[frameId].frameSize){
            this.#frameQueue[frameId].fullFrame = true
            this.#frameCounter++

            // Create bitrate array with values
            if(this.#bitrateTimeNum < 59){
                this.#bitrateTimeNum++
            } else {
                this.#bitrateTimeNum = 0;
            }
            if(this.#bitrateCounter[this.#bitrateTimeNum] !== undefined){
                this.#bitrateCounter[this.#bitrateTimeNum] = this.#frameQueue[frameId].frameData.length
            } else {
                // console.log(this.#bitrateCounter)
                this.#bitrateCounter.push(this.#frameQueue[frameId].frameData.length)
            }

            // console.log('xSDK channels/video.js - FrameId '+frameId+' completed. Sending to videobuffer...')
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

                    // We have processed the frames. Queue frames for confirmation
                    if(this.#currentWidth !== 0 && this.#currentHeight !== 0) {
                        frame.frameRenderedTimeMs = performance.now()
                        this.#frameMetadataQueue.push(frame)

                        // Set latency data
                        if(frame.firstFramePacketArrivalTimeMs !== frame.frameRenderedTimeMs) {
                            var frameLatency = (frame.frameRenderedTimeMs - frame.firstFramePacketArrivalTimeMs)

                            this.#videoLatency.push(frameLatency)
                            if(frameLatency > this.#maxVideoLatency){
                                this.#maxVideoLatency = frameLatency
                            }
                            if(frameLatency < this.#minVideoLatency){
                                this.#minVideoLatency = frameLatency
                            }
                        }
                    }
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