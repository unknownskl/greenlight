class VideoChannel extends BaseChannel {

    #frameMetadataQueue = []

    #currentWidth = 0
    #currentHeight = 0

    #frameCounter = 0

    #bitrateCounter = {
        packets: [],
        video: []
    }
    #videoLatency = []

    #worker
    #videoBuffer = []

    #events = {
        'fps': [],
        'queue': [],
        'bitrate': [],
        'latency': [],
    }

    onOpen(event) {
        this.#worker = new Worker('assets/xsdk/workers/video.js');
        this.#worker.onmessage = (workerMessage) => {
            
            if(workerMessage.data.action == 'startStream'){
                if(workerMessage.data.status === 200){
                    console.log('xSDK channels/video.js - Worker onOpen finished successfully')
                } else {
                    console.log('xSDK channels/video.js - Worker onOpen failed:', workerMessage.data)
                }

            } else if(workerMessage.data.action == 'doRender'){
                // console.log('xSDK channels/video.js - doRender, render frameid:=', (workerMessage.data.data.frameId), 'data:', (workerMessage.data.data.data))
                if(workerMessage.data.status !== 200){
                    console.log('xSDK channels/video.js - Worker onPacket failed:', workerMessage.data)
                } else {
                    // console.log('isKeyFrame:', workerMessage.data.data.isKeyFrame)
                    if(workerMessage.data.data.isKeyFrame === 1){
                        // Restart video and re-queue..
                        console.log('@TODO: Implement video source restart...')
                    }
                    this.doRender(workerMessage.data.data)
                }

            } else if(workerMessage.data.action == 'onPacket'){
                if(workerMessage.data.status !== 200){
                    console.log('xSDK channels/video.js - Worker onPacket failed:', workerMessage.data)
                }
            } else {
                console.log('xSDK channels/video.js - Unknown worker response action:', workerMessage.data)
            }
        }

        this.#worker.postMessage({
            action: 'startStream'
        })

        setInterval(() => {
            this.calculateLatency()
            this.calculateBitrate()
            this.calculateFps()
        }, 1000)
    }

    calculateLatency() {
        var latencyCount = 0;
        var minLatency = 999;
        var maxLatency = 0;

        for(var latencyTime in this.#videoLatency){
            if(this.#videoLatency[latencyTime] !== undefined){
                latencyCount += this.#videoLatency[latencyTime]
            }

            if(this.#videoLatency[latencyTime] < minLatency)
                minLatency = this.#videoLatency[latencyTime]

            if(this.#videoLatency[latencyTime] > maxLatency)
                maxLatency = this.#videoLatency[latencyTime]
        }
        
        if(this.#videoLatency.length > 0){
            latencyCount = (latencyCount/this.#videoLatency.length)
        }

        this.emitEvent('latency', { minLatency: Math.round(minLatency*100)/100, avgLatency: Math.round(latencyCount*100)/100, maxLatency: Math.round(maxLatency*100)/100 })
        this.#videoLatency = []
    }

    calculateBitrate() {
        // Calculate bitrate
        var bitratePacketsValue = 0
        var bitrateVideoValue = 0

        for(var frame in this.#bitrateCounter.packets){
            if(this.#bitrateCounter.packets[frame] !== undefined){
                bitratePacketsValue += this.#bitrateCounter.packets[frame]
            }
        }
        for(var video in this.#bitrateCounter.video){
            if(this.#bitrateCounter.video[video] !== undefined){
                bitrateVideoValue += this.#bitrateCounter.video[video]
            }
        }

        bitratePacketsValue = Math.round((bitratePacketsValue*8)/1000)
        bitrateVideoValue = Math.round((bitrateVideoValue*8)/1000)

        this.emitEvent('bitrate', { packetBitrate: Math.round(bitratePacketsValue*100)/100, videoBitrate: Math.round(bitrateVideoValue*100)/100 })
        this.#bitrateCounter.video = []
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

    doRender(frame){
        if(this.getClient().getVideoSource().updating === false){
            let framesBuffer = new Uint8Array()

            // Process queued frames first
            for(; this.#videoBuffer.length > 0;){
                const newFrame = this.#videoBuffer.shift()
                framesBuffer = this.mergeFrames(framesBuffer, newFrame.frameData)

                this.addProcessedFrame(newFrame)
            }

            this.addProcessedFrame(frame)
            framesBuffer = this.mergeFrames(framesBuffer, frame.frameData)

            this.getClient().getVideoSource().appendBuffer(framesBuffer);
            this.#bitrateCounter.video.push(frame.frameData.byteLength)
        } else {
            this.#videoBuffer.push(frame)
        }
    }

    addProcessedFrame(frame) {
        frame.frameRenderedTimeMs = performance.now()
        this.#frameMetadataQueue.push(frame)

        // Increase fps counter
        this.#frameCounter++

        // Calc latency
        var frameLatency = (frame.frameRenderedTimeMs - frame.firstFramePacketArrivalTimeMs)
        this.#videoLatency.push(frameLatency)
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
        // var queue = this.#frameMetadataQueue
        // var returnQueue = []
        // for(var i = 0; i < 30; i++){
        //     returnQueue.push(queue.shift())
        // }
        // this.#frameMetadataQueue = queue

        // return returnQueue
        
        return this.#frameMetadataQueue
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

    destroy() {
        this.#worker.terminate()
    }
}