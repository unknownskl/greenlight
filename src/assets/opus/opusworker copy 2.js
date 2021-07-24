LIBOPUS_WASM_URL = "libopus.wasm";
self.importScripts('libopus.wasm.js');

console.log('Hello from OPUS worker', self.libopus)

// <script type="text/javascript">
//  LIBOPUS_WASM_URL = "opusdemo/dist/libopus.wasm";
// </script>
// <script type="text/javascript" src="opusdemo/dist/libopus.wasm.js"></script>

// New OpusDecoder
var opusDecoder = {
    bands: {
        narrowband: 1101,
        mediumband: 1102,
        wideband: 1103,
        superwideband: 1104,
        fullband: 1105,
    },

    getSamplesPerFrame: function(data, Fs){
        var audiosize = null;
        if (data[0] & 0x80){
            audiosize = ((data[0]>>3)&0x3);
            audiosize = (Fs<<audiosize)/400;
        } else if ((data[0]&0x60) == 0x60){
            audiosize = (data[0]&0x08) ? Fs/50 : Fs/100;
        } else {
            audiosize = ((data[0]>>3)&0x3);
            if (audiosize == 3)
                audiosize = Fs*60/1000;
            else
                audiosize = (Fs<<audiosize)/100;
        }
        return audiosize;
    },

    // int opus_packet_get_samples_per_frame(const unsigned char *data,
    // opus_int32 Fs)
    // {
    //    int audiosize;
    //    if (data[0]&0x80)
    //    {
    //       audiosize = ((data[0]>>3)&0x3);
    //       audiosize = (Fs<<audiosize)/400;
    //    } else if ((data[0]&0x60) == 0x60)
    //    {
    //       audiosize = (data[0]&0x08) ? Fs/50 : Fs/100;
    //    } else {
    //       audiosize = ((data[0]>>3)&0x3);
    //       if (audiosize == 3)
    //          audiosize = Fs*60/1000;
    //       else
    //          audiosize = (Fs<<audiosize)/100;
    //    }
    //    return audiosize;
    // }

    getChannels: function(data){
        return (data[0]&0x4) ? 2 : 1;
    },

    // int opus_packet_get_nb_channels(const unsigned char *data)
    // {
    // return (data[0]&0x4) ? 2 : 1;
    // }

    getMode: function(data){
        if (data[0]&0x80){
            return 'celtonly'
        } else if ((data[0]&0x60) == 0x60) {
            return 'hybrid'
        } else {
            return 'silkonly'
        }
    },

    // static int opus_packet_get_mode(const unsigned char *data)
    // {
    //     int mode;
    //     if (data[0]&0x80)
    //     {
    //         mode = MODE_CELT_ONLY;
    //     } else if ((data[0]&0x60) == 0x60)
    //     {
    //         mode = MODE_HYBRID;
    //     } else {
    //         mode = MODE_SILK_ONLY;
    //     }
    //     return mode;
    // }

    getBandwidth(data){
        var bandwidth = null
        if(data[0]&0x80){
            bandwidth = (this.bands.mediumband + ((data[0]>>5)&0x3))
            if(bandwidth === this.bands.mediumband){
                bandwidth = this.brands.narrowband
            }
        } else if((data[0]&0x60) == 0x60) {
            if(data[0]&0x10) {
                bandwidth = this.brands.fullband
            } else {
                bandwidth = this.brands.superwideband
            }
        } else {
            bandwidth = this.brands.narrowband
        }

        return bandwidth
    },

    // int opus_packet_get_bandwidth(const unsigned char *data)
    // {
    //     int bandwidth;
    //     if (data[0]&0x80)
    //     {
    //        bandwidth = OPUS_BANDWIDTH_MEDIUMBAND + ((data[0]>>5)&0x3);
    //        if (bandwidth == OPUS_BANDWIDTH_MEDIUMBAND)
    //            bandwidth = OPUS_BANDWIDTH_NARROWBAND;
    //     } else if ((data[0]&0x60) == 0x60)
    //     {
    //     bandwidth = (data[0]&0x10) ? OPUS_BANDWIDTH_FULLBAND :
    //                                     OPUS_BANDWIDTH_SUPERWIDEBAND;
    //     } else {
    //     bandwidth = OPUS_BANDWIDTH_NARROWBAND + ((data[0]>>5)&0x3);
    //     }
    //     return bandwidth;
    // }

    decodeFrameFloat(){

    },

    // frame_size = 24000/50 == 480
    // samplingrate = 24000/50 == 480 === framesize20ms
    // 
    // Create decoder: dec = opus_decoder_create(sampling_rate, channels, &err);
    // Create samples: output_samples = opus_decode(dec, data, data.length, out, frame_size, fec?);
    // Create samples: opus_decode_native()

    // decodeFloat()
    // opus_decode_float(dec, packet, 3, fbuf, 960, 0) != 960 RESULT: failed
}

var decoder = opusDecoder
// const decoder = new libopus.Decoder(2, 48000);

// function onDecode({left, right, samplesDecoded, sampleRate}) {
//     console.log(`Decoded ${samplesDecoded} samples`);
//     // play back the left/right audio, write to a file, etc
// }

onmessage = async (data) => {
    console.log('xSDK OpusWorker.js - Got data to decode:', data.data);

    //// 48kHz sampling rate, 20ms frame duration, stereo audio (2 channels)
    // var samplingRate = 48000;
    // var frameDuration = 20;
    // var channels = 2;
    // var maxLatency = 100;
    // var decodedSamplesPerFrame = frameDuration * (samplingRate / 1000); // result=(20*48)=960

    var samples = decoder.getSamplesPerFrame(data.data, 48000)
    var channels = decoder.getChannels(data.data)
    var mode = decoder.getMode(data.data)
    var bandwidth = decoder.getBandwidth(data.data)

    var decodedFloat = decoder.decodeFrameFloat(data.data)

    console.log('-- Samples:', samples)
    console.log('-- Channels:', channels)
    console.log('-- Mode:', mode)
    console.log('-- Bandwidth:', bandwidth) //105 = fullband

    console.log('-- Decoded:', decodedFloat)

    // await decoder.ready;
    // decoder.decode(data.data)
    // decoder.free()

    // decoder.ready.then(_ => decoder.decode(data.data));
    // decoder.ready.then(_ => decoder.free());

    // console.log('xSDK OpusWorker.js - Sending back data from worker:', data.data);
    postMessage(data.data);
}