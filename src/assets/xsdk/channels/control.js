class ControlChannel extends BaseChannel {

    #bitrate = 5000*1000

    onOpen(event) {

        // Set bitrate
        // var data = JSON.stringify({
        //     "message":"videoChannelConfigUpdate",
        //     "maxVideoSctpMessageSizeBytes": 16000
        // })
        // setTimeout(() => {
            var data = JSON.stringify({
                "message":"rateControlBitrateUpdate",
                "bitratebps": (12000*1000) // min = 512, max = 12000, default = 5000 (value = * 1000)
            })
            this.send(data)

            var data4 = JSON.stringify({
                "message":"videoChannelConfigUpdate",
                "maxVideoSctpMessageSizeBytes": 16000 // min = 512, max = 12000, default = 5000 (value = * 1000)
            })
            this.send(data4)

            // Let system know we have added a gamepad (Unsure what this does though)
            var data2 = JSON.stringify({
                "message":"gamepadChanged",
                "gamepadIndex":0,
                "wasAdded":true
            })
            this.send(data2)

            // Auth to the strea as GPU website (Unsure what this does)
            var data3 = JSON.stringify({
                "message":"authorizationRequest",
                "accessKey":"4BDB3609-C1F1-4195-9B37-FEFF45DA8B8E"
            })
            this.send(data3)

            // setTimeout(() => {
            //     var data4 = JSON.stringify({
            //         message: "videoKeyframeRequested",
            //         ifrRequested: false
            //     })
            //     this.send(data4)
            // }, 10000)
            

            
        // }, 1000)
    }

    onMessage(event) {
        console.log('xSDK channels/control.js - Received message:', event)
    }

    setBitrate(bitrate) {
        // if(bitrate < 512)
        //     return false
        
        // if(bitrate > 12000)
        //     return false

        this.#bitrate = bitrate

        // var data = JSON.stringify({
        //     "message":"rateControlBitrateUpdate",
        //     "bitratebps": this.#bitrate // min = 512, max = 12000, default = 5000 (value = * 1000)
        // })
        var data = JSON.stringify({
            "message":"videoChannelConfigUpdate",
            "maxVideoSctpMessageSizeBytes": this.#bitrate // min = 512, max = 12000, default = 5000 (value = * 1000)
        })
        console.log('Set bitrate to:', this.#bitrate)
        this.send(data)

        return true
    }

    getBitrate() {
        return this.#bitrate/1000
    }

    requestKeyFrame() {
        console.log('videoKeyframeRequested requested')
        var data = JSON.stringify({
            message: "videoKeyframeRequested",
            ifrRequested: false
        })
        this.send(data)
    }
}