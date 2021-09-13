class InputChannel extends BaseChannel {

    #inputSequenceNum = 0

    #gamepadQueue = []

    #sendCounter = 0
    #gamepadCounter = 0
    #frameCounter = 0

    #maxInputLatency
    #minInputLatency
    #inputLatency = []

    #maxMetadataLatency
    #minMetadataLatency
    #metadataLatency = []

    #events = {
        'queue': [],
        'fps': [],
        'latency': [],
        'gamepadlatency': []
    }

    onOpen(event) {
        setInterval(() => {
            // console.log('xSDK channels/input.js - [performance] sequence:', this.#inputSequenceNum, 'gamepadQueue size:', Object.keys(this.#gamepadQueue).length)
            // calc latency
            var latencyCount = 0;
            for(const latencyTime in this.#inputLatency){

                if(this.#inputLatency[latencyTime] !== undefined){
                    latencyCount += this.#inputLatency[latencyTime]
                }
            }
            
            if(this.#inputLatency.length > 0){
                latencyCount = (latencyCount/this.#inputLatency.length)
            }

            if(this.#minInputLatency === undefined)
                this.#minInputLatency = 0
            
            if(this.#maxInputLatency === undefined)
                this.#maxInputLatency = 0

            this.emitEvent('gamepadlatency', { minLatency: Math.round(this.#minInputLatency*100)/100, avgLatency: Math.round(latencyCount*100)/100, maxLatency: Math.round(this.#maxInputLatency*100)/100 })
            this.#maxInputLatency = undefined
            this.#minInputLatency = undefined
            this.#inputLatency = []

            // Gamepad latency
            var metadataLatencyCount = 0;
            for(const latencyTime in this.#metadataLatency){

                if(this.#metadataLatency[latencyTime] !== undefined){
                    metadataLatencyCount += this.#metadataLatency[latencyTime]
                }
            }
            
            if(this.#metadataLatency.length > 0){
                metadataLatencyCount = (metadataLatencyCount/this.#metadataLatency.length)
            }

            if(this.#minMetadataLatency === undefined)
                this.#minMetadataLatency = 0
            
            if(this.#maxMetadataLatency === undefined)
                this.#maxMetadataLatency = 0

            this.emitEvent('latency', { minLatency: Math.round(this.#minMetadataLatency*100)/100, avgLatency: Math.round(metadataLatencyCount*100)/100, maxLatency: Math.round(this.#maxMetadataLatency*100)/100 })
            this.#maxMetadataLatency = undefined
            this.#minMetadataLatency = undefined
            this.#metadataLatency = []
            
            // Calc fps
            var fps = this.#frameCounter
            this.emitEvent('queue', { sequenceNum: this.#inputSequenceNum, sendCounter: this.#sendCounter, frameCounter: this.#frameCounter, gamepadCounter: this.#gamepadCounter, gamepadQueue: this.#gamepadQueue.length})
            this.#sendCounter = 0
            this.#frameCounter = 0
            this.#gamepadCounter = 0

            this.emitEvent('fps', { fps: fps })
            
        }, 1000)

        this.#inputSequenceNum++ 
        var reportType = 8
        
        var metdadataArray = new Uint8Array(1 + 5);
        var metadataReport = new DataView(metdadataArray.buffer) // payloadSize = headerSize
        metadataReport = this.generateHeader(metadataReport, this.#inputSequenceNum, reportType)

        // console.log('xSDK channels/input.js - Sending message:', metadataReport)
        this.send(metadataReport)

        // Send dummy input (to keep connection open)
        setInterval(() => {
            // Check if we already have gotten the metadata.
            var frameMetadataLength = this.getClient().getChannelProcessor('video').getFrameMetadataLength()
            if(frameMetadataLength > 5 || this.#gamepadQueue.length > 0) {
                var frameMetadata = this.getClient().getChannelProcessor('video').getFrameMetadataQueue()
                // console.log('PROCESSED INPUT PACKET: PRE frameMetadata.length', frameMetadata.length, 'gamepadMetadata.length', this.#gamepadQueue.length)

                // We got frames to process.
                // console.log('xSDK channels/input.js - Got frame metadatas:', frameMetadata, frameMetadata.length)

                this.#inputSequenceNum++ 

                // Generate metadataFramesize
                var typeFlag = 0 // value=None
                var headerSize = 0

                var packetTimeNow = performance.now()

                // Calc metadataFramesize
                if(frameMetadata.length > 0) {
                    typeFlag |= 1 // value=Metadata
                    var metadataHeaderSize = Uint8Array.BYTES_PER_ELEMENT + (7 * Uint32Array.BYTES_PER_ELEMENT) * frameMetadata.length
                    headerSize += metadataHeaderSize

                    this.#frameCounter += frameMetadata.length
                }

                // Fetch gamepadMetadata
                var gamepadMetadata = []
                for(; this.#gamepadQueue.length > 0;){
                    gamepadMetadata.push(this.#gamepadQueue.shift())
                }
                if(gamepadMetadata.length > 0) {
                    typeFlag |= 2 // value=GamepadReport

                    // @TODO: Refactor this pieace and find out what the numbers mean.
                    var a = Uint8Array.BYTES_PER_ELEMENT + 1 * Uint16Array.BYTES_PER_ELEMENT + 6 * Int16Array.BYTES_PER_ELEMENT + (4 >= 2 ? 2 * Uint32Array.BYTES_PER_ELEMENT : 0);
                    var gamepadHeaderSize = Uint8Array.BYTES_PER_ELEMENT + a * 1

                    headerSize += gamepadHeaderSize

                    this.#gamepadCounter += gamepadMetadata.length
                }
                // Calc pointersFrameSize (optional?)
                // Calc mouseFrameSize (optional?)

                headerSize += 5 // Add header size

                // Check if packet is bigger then maxReportSize (2048). If yes, double the size
                // this.generateHeader(l, d, this.reportArrayView),
                var reportArray = new Uint8Array(2048)
                // var reportArray = new Uint8Array(4096)
                var reportArrayView = new DataView(reportArray.buffer)

                reportArrayView = this.generateHeader(reportArrayView, this.#inputSequenceNum, typeFlag)

                var dataOffset = 5 // 0 + header size (5)

                // @TODO: Add gamepadsFrameSize, pointersFrameSize and mouseFrameSize (Altough we probably only need gamepadsFrameSize)
                if(frameMetadata.length > 0) {
                    try {
                        dataOffset = this.generateMetadataFrame(reportArrayView, packetTimeNow, frameMetadata, dataOffset)
                    } catch (error) {
                        console.log('ERROR generateMetadataFrame: reportArrayView, packetTimeNow, frameMetadata, dataOffset', reportArrayView, packetTimeNow, frameMetadata, dataOffset)
                        throw error
                    }
                }

                if(gamepadMetadata.length > 0) {
                    try {
                        // console.log('input: gamepadMetadata', gamepadMetadata[0])
                        dataOffset = this.generateGamepadFrame(reportArrayView, gamepadMetadata, dataOffset)
                    } catch (error) {
                        console.log('ERROR generateGamepadFrame: reportArrayView, gamepadMetadata, dataOffset', reportArrayView, gamepadMetadata, dataOffset)
                        throw error
                    }
                }
                
                var inputPacket = reportArray.subarray(0, headerSize)
                this.send(inputPacket)
                this.#sendCounter++
            }
        }, 10)
        
        
    }

    onMessage(event) {
        console.log('xSDK channels/input.js - Received message:', event)

        var dataPacket = new DataView(event.data)

        var packetType = dataPacket.getUint8(0); // 16 = ServerMetadata
        var serverHeight = dataPacket.getUint32(1, true);
        var serverWidth = dataPacket.getUint32(5, true);

        if(packetType === 16){
            console.log('xSDK channels/input.js - Received server metadata:', { height: serverHeight, width: serverWidth })
            this.getClient().getChannelProcessor('video').setVideoDimension(serverWidth, serverHeight)
        }
    }

    processGamepadState(index, state) {
        // console.log('xSDK channels/input.js - Controller input['+index+']:', state)

        state.GamepadIndex = index
        state.PhysicalPhysicality = 0
        state.VirtualPhysicality = 0
        state.Dirty = true,
        state.timingGamepadState = performance.now()

        this.#gamepadQueue.push(state)
    }

    pressButton(index, state) {
        var newState = {
            A: state.A || 0,
            B: state.B || 0,
            X: state.X || 0,
            Y: state.Y || 0,
            LeftShoulder: state.LeftShoulder || 0,
            RightShoulder: state.RightShoulder || 0,
            LeftTrigger: state.LeftTrigger || 0,
            RightTrigger: state.RightTrigger || 0,
            View: state.View || 0,
            Menu: state.Menu || 0,
            LeftThumb: state.LeftThumb || 0,
            RightThumb: state.RightThumb || 0,
            DPadUp: state.DPadUp || 0,
            DPadDown: state.DPadDown || 0,
            DPadLeft: state.DPadLeft || 0,
            DPadRight: state.DPadRight || 0,
            Nexus: state.Nexus || 0,
            LeftThumbXAxis: state.LeftThumbXAxis || 0,
            LeftThumbYAxis: state.LeftThumbYAxis || 0,
            RightThumbXAxis: state.RightThumbXAxis || 0,
            RightThumbYAxis: state.RightThumbYAxis || 0,
        }

        this.processGamepadState(index, newState)

        setTimeout(() => {
            for(var button in state){
                newState[button] = 0
            }

            this.processGamepadState(index, newState)
        }, 50)
    }

    generateHeader(dataView, sequenceNum, data) {
        dataView.setUint8(0, data)
        dataView.setUint32(1, sequenceNum, true)

        return dataView
    }

    generateMetadataFrame(dataView, packetTime, frameMetadata, offset) {
        dataView.setUint8(offset, frameMetadata.length)
        offset += 1

        var dateNow = performance.now();

        for (; frameMetadata.length > 0;) {
            var frame = frameMetadata.shift()

            var firstFramePacketArrivalTimeMs = frame.firstFramePacketArrivalTimeMs * 10
            var frameSubmittedTimeMs = frame.frameSubmittedTimeMs * 10
            var frameDecodedTimeMs = frame.frameDecodedTimeMs * 10
            var frameRenderedTimeMs = frame.frameRenderedTimeMs * 10
            var framePacketTime = packetTime * 10
            var frameDateNow = dateNow * 10

            dataView.setUint32(offset, frame.serverDataKey, true)
            dataView.setUint32(offset+4, firstFramePacketArrivalTimeMs, true)
            dataView.setUint32(offset+8, frameSubmittedTimeMs, true)
            dataView.setUint32(offset+12, frameDecodedTimeMs, true)
            dataView.setUint32(offset+16, frameRenderedTimeMs, true)
            dataView.setUint32(offset+20, framePacketTime, true)
            dataView.setUint32(offset+24, frameDateNow, true)

            // console.log('RAINWAY WEBRTC: generateMetadataFrame values i', firstFramePacketArrivalTimeMs, 'r', frameSubmittedTimeMs, 'o', frameDecodedTimeMs, 'h', frameRenderedTimeMs, 'c', framePacketTime, 'd', frameDateNow, 'a.serverDataKey', frame.serverDataKey)

            offset += 28

            // Measure latency
            const metadataDelay = (performance.now()-frame.frameRenderedTimeMs)
            this.#metadataLatency.push(metadataDelay)
            if(metadataDelay > this.#maxMetadataLatency || this.#maxMetadataLatency ===  undefined){
                this.#maxMetadataLatency = metadataDelay

            } else if(metadataDelay < this.#minMetadataLatency || this.#minMetadataLatency ===  undefined){
                this.#minMetadataLatency = metadataDelay
            }
        }

        return offset
    }

    generateGamepadFrame(dataView, gamepadInput, offset) {
        dataView.setUint8(offset, 1)
        offset += 1

        for(; gamepadInput.length > 0;) {
            var input = gamepadInput.shift()

            dataView.setUint8(offset, input.GamepadIndex)
            offset += 1

            var buttonMask = 0
            if(input.Nexus > 0){ buttonMask |= 2 }
            if(input.Menu > 0){ buttonMask |= 4 }
            if(input.View > 0){ buttonMask |= 8 }
            if(input.A > 0){ buttonMask |= 16 }
            if(input.B > 0){ buttonMask |= 32 }
            if(input.X > 0){ buttonMask |= 64 }
            if(input.Y > 0){ buttonMask |= 128 }
            if(input.DPadUp > 0){ buttonMask |= 256 }
            if(input.DPadDown > 0){ buttonMask |= 512 }
            if(input.DPadLeft > 0){ buttonMask |= 1024 }
            if(input.DPadRight > 0){ buttonMask |= 2048 }
            if(input.LeftShoulder > 0){ buttonMask |= 4096 }
            if(input.RightShoulder > 0){ buttonMask |= 8192 }
            if(input.LeftThumb > 0){ buttonMask |= 16384 }
            if(input.RightThumb > 0){ buttonMask |= 32768 }

            dataView.setUint16(offset, buttonMask, true)
            dataView.setInt16(offset+2, this.normalizeAxisValue(input.LeftThumbXAxis), true) // LeftThumbXAxis
            dataView.setInt16(offset+4, this.normalizeAxisValue(-input.LeftThumbYAxis), true) // LeftThumbYAxis
            dataView.setInt16(offset+6, this.normalizeAxisValue(input.RightThumbXAxis), true) // RightThumbXAxis
            dataView.setInt16(offset+8, this.normalizeAxisValue(-input.RightThumbYAxis), true) // RightThumbYAxis
            dataView.setUint16(offset+10, this.normalizeTriggerValue(input.LeftTrigger), true) // LeftTrigger
            dataView.setUint16(offset+12, this.normalizeTriggerValue(input.RightTrigger), true) // RightTrigger

            dataView.setUint32(offset+14, 0, true) // PhysicalPhysicality
            dataView.setUint32(offset+18, 0, true) // VirtualPhysicality
            offset += 22

            // Measure latency
            const inputDelay = (performance.now()-input.timingGamepadState)
            this.#inputLatency.push(inputDelay)
            if(inputDelay > this.#maxInputLatency || this.#maxInputLatency === undefined){
                this.#maxInputLatency = inputDelay

            } else if(inputDelay < this.#minInputLatency || this.#minInputLatency === undefined){
                this.#minInputLatency = inputDelay
            }
        }

        return offset
    }

    convertToInt16(e) {
        var int = new Int16Array(1)
        return int[0] = e, int[0]
    }
    convertToUInt16(e) {
        var int = new Uint16Array(1)
        return int[0] = e, int[0]
    }

    normalizeTriggerValue(e) {
        if (e < 0) return this.convertToUInt16(0);
        const t = 65535 * e,
            a = t > 65535 ? 65535 : t;
        return this.convertToUInt16(a)
    }
    normalizeAxisValue(e) {
        const t = this.convertToInt16(32767),
            a = this.convertToInt16(-32767),
            n = e * t;
        return n > t ? t : n < a ? a : this.convertToInt16(n)
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
        // this.#worker.terminate()
    }
}