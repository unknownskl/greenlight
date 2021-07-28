console.log('xSDK workers/audio.js - Loading worker...')

var OpusDecoderLib;
var OggOpusDecoder;

self.OPUS_SCRIPT_LOCATION = '../../opus/';
self.importScripts('../../opus/libopus-decoder.min.js');
self.importScripts('../../opus/oggOpusDecoder.js');

var _frameQueue = {}
var _opusDecoder = new OggOpusDecoder({

    decoderSampleRate: 48000,
    outputBufferSampleRate: 48000,
    numberOfChannels: 2,
    rawOpus: true,

}, OpusDecoderLib );

var init = function() {
    return new Promise((resolve, reject) => {
        // console.log('LIBOPUS IN WORKER:', _opusDecoder)

        setInterval(() => {
            console.log('xSDK workers/audio.js - [Performance] _frameQueue size:', Object.keys(_frameQueue).length)
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
        // var frameOffset = messageBuffer.getUint32(12, true);

        var frameBuffer = new Uint8Array(eventData.data, 12)

        var frameData = {
            frameId: frameId,
            timestamp: timestamp,
            frameSize: frameSize,
            // frameOffset: frameOffset,
            // serverDataKey: serverDataKey,
            frameData: frameBuffer,
            frameReceived: timePerformanceNow
        }

        _opusDecoder.decodeRaw(frameData.frameData, (output) => {
            var audioOutput = output.slice(0)

            postMessage({
                action: 'doRenderAudio',
                status: 200,
                data: {
                    frame: frameData,
                    audioBuffer: audioOutput
                }
            });
        })
        
        resolve(frameData)
    })
}

onmessage = async (workerMessage) => {

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
            console.log('xSDK workers/audio.js - Unknown incoming worker message:', workerMessage.data.action, workerMessage.data)
    }
}