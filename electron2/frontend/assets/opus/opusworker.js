// LIBOPUS_WASM_URL = "libopus.wasm";
// self.importScripts('libopus.wasm.js');

// console.log('Hello from OPUS worker', self.libopus)

// function onDecode({left, right, samplesDecoded, sampleRate}) {
//     console.log(`Decoded ${samplesDecoded} samples`);
//     // play back the left/right audio, write to a file, etc
// }

onmessage = async (data) => {
    console.log('xSDK OpusWorker.js - Got data to decode:', data.data);

    decoder.input(data.data)
    console.log('out:', decoder.output())

    postMessage(data.data);
}