console.log('xSDK workers/video.js - Loading worker...')

var _frameQueue = {}

var init = function() {
    return new Promise((resolve, reject) => {

        setInterval(() => {
            console.log('xSDK workers/video.js - [Performance] _frameQueue size:', Object.keys(_frameQueue).length)
        }, 1000)

        resolve('ok')
    })
}

var onPacket = function(eventData, timePerformanceNow){

    return new Promise((resolve, reject) => {
        var messageBuffer = new DataView(eventData.data);

        var frameId = messageBuffer.getUint32(0, true);
        var timestamp = (messageBuffer.getUint32(4, true)/10);
        var frameSize = messageBuffer.getUint32(8, true);
        var frameOffset = messageBuffer.getUint32(12, true);
        var serverDataKey = messageBuffer.getUint32(16, true);
        var isKeyFrame = messageBuffer.getUint8(20, true);

        var offset = 21; //@TODO: Check if isKeyFrame. if true => 21, else 20.

        var frameData = new Uint8Array(eventData.data, offset)

        frameData = {
            frameId: frameId,
            timestamp: timestamp,
            frameSize: frameSize,
            frameOffset: frameOffset,
            serverDataKey: serverDataKey,
            isKeyFrame: isKeyFrame,
            frameData: frameData
        }

        // Check if frame already exists
        var frameDataBuffer;

        if(_frameQueue[frameId] !== undefined) {
            frameDataBuffer = new Uint8Array(_frameQueue[frameId].frameData)
            frameDataBuffer.set(frameData.frameData, frameData.frameOffset)

            _frameQueue[frameId].bytesReceived += frameData.frameData.byteLength
            _frameQueue[frameId].frameData = frameDataBuffer

        } else {
            frameDataBuffer = new Uint8Array(new ArrayBuffer(frameData.frameSize))
            frameDataBuffer.set(frameData.frameData, frameData.frameOffset)
            var bytesReceived = frameData.frameData.byteLength

            _frameQueue[frameId] = {
                frameId: frameId,
                timestamp: frameData.timestamp,
                frameSize: frameData.frameSize,
                frameData: frameDataBuffer,
                bytesReceived: bytesReceived,
                serverDataKey: frameData.serverDataKey,
                fullFrame: false,

                firstFramePacketArrivalTimeMs: timePerformanceNow,
                frameSubmittedTimeMs: timePerformanceNow,
                frameDecodedTimeMs: timePerformanceNow,
                frameRenderedTimeMs: 0
            }
        }

        // Check if we have a full frame
        if(_frameQueue[frameId].bytesReceived === _frameQueue[frameId].frameSize){
            _frameQueue[frameId].fullFrame = true

            postMessage({
                action: 'doRender',
                status: 200,
                data: _frameQueue[frameId]
            });
            resolve(_frameQueue[frameId])

            delete _frameQueue[frameId]
            // this.sendToMediasource()
        } else {
            resolve(_frameQueue[frameId])
        }
    })
}

onmessage = async (workerMessage) => {
    // console.log('xSDK workers/video.js - Got message:', workerMessage.data);

    switch(workerMessage.data.action){

        case 'startStream':
            self.init().then(() => {
                postMessage({
                    action: 'startStream',
                    status: 200
                });
            }).catch((error) => {
                postMessage({
                    action: 'startStream',
                    status: 500,
                    message: error
                });
            })
            break;
        case 'onPacket':
            // Process incoming input
            self.onPacket(workerMessage.data.data, workerMessage.data.data.timePerformanceNow).then((response) => {
                postMessage({
                    action: 'onPacket',
                    status: 200,
                    frame: response
                });
            }).catch((error) => {
                postMessage({
                    action: 'onPacket',
                    status: 500,
                    message: error
                });
            })
            break;
        default:
            console.log('xSDK workers/video.js - Unknown incoming worker message:', workerMessage.data.action, workerMessage.data)
    }
}