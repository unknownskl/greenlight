class MessageChannel extends BaseChannel {

    #events = {
        'dialog': [],
    }

    onOpen(event) {
        var data = JSON.stringify({
            "type":"Handshake",
            "version":"messageV1",
            "id":"0ab125e2-6eee-4687-a2f4-5cfb347f0643",
            "cv":""
        })
        this.send(data)

        console.log('xSDK channels/message.js - Sending handshake:', data)

        var data4 = JSON.stringify(this.generateMessage('/streaming/systemUi/configuration', {
            "version": [0,1,0],
            "systemUis":[10,19,31,27,32]
        }))
        this.send(data4)
        console.log('xSDK channels/message.js - Setup custom web UI Dialog configuration:', data4)


        // var data5 = JSON.stringify(this.generateMessage('/streaming/properties/clientappinstallidchanged', {
        //     "clientAppInstallId":"65e9d694-188b-447b-a25e-53e83ac0e68f"
        // }))
        // this.send(data5)


        // var data6 = JSON.stringify(this.generateMessage('/streaming/characteristics/orientationchanged', {"orientation":0}))
        // this.send(data6)

        // var data7 = JSON.stringify(this.generateMessage('/streaming/characteristics/touchinputenabledchanged', {"touchInputEnabled":true}))
        // this.send(data7)

        // var data8 = JSON.stringify(this.generateMessage('/streaming/characteristics/dimensionschanged', {"horizontal":144,"vertical":81}))
        // this.send(data8)
    }

    onMessage(event) {
        // console.log('xSDK channels/message.js - Received message:', event)
        console.log('xSDK channels/message.js - Received json:', JSON.parse(event.data))

        var jsonMessage = JSON.parse(event.data)
        if(jsonMessage.target === '/streaming/properties/titleinfo'){
            console.log('xSDK channels/message.js - Changed title to:', JSON.parse(jsonMessage.content))

        } else if(jsonMessage.target === '/streaming/systemUi/messages/ShowMessageDialog') {
            var modalContent = JSON.parse(jsonMessage.content)
            console.log('xSDK channels/message.js - Show dialog:', modalContent)

            modalContent.id = jsonMessage.id
            this.emitEvent('dialog', modalContent)

            // Show modal:
            // -----------
            // CancelIndex: 0
            // CommandLabel1: "Close"
            // CommandLabel2: ""
            // CommandLabel3: ""
            // ContentText: "Disney+ can't be used while you're playing remotely. (0x87e10004)"
            // DefaultIndex: 0
            // Options: 0
            // TitleText: "Sorry, we can't launch this"

            // POC with confirm
            // var result = confirm(modalContent.TitleText + '\n' + modalContent.ContentText)

            // Modal design:
            // Title: modalContent.TitleText
            // Content: modalContent.ContentText
            // Buttons: modalContent.CommandLabel1, modalContent.CommandLabel2, modalContent.CommandLabel3 (default selected: modalContent.DefaultIndex)
            // ButtonActions: confirm/a = select DefaultIndex, cancel/b = select CancelIndex

            //     var data = JSON.stringify({
            //         "type":"TransactionComplete",
            //         "content":"{\"Result\":0}",
            //         "id":"{28f4cce2-1a40-4167-b5d5-416623dd6d2e}",
            //         "cv":""
            //     })

            //     this.send(data)

        } else if(jsonMessage.target === '/streaming/sessionLifetimeManagement/serverInitiatedDisconnect') {
            var disconnectMessage = JSON.parse(jsonMessage.content)
            console.log('Kicked from streaming session. Reason:', disconnectMessage.reason);
            alert('Kicked from streaming session. Reason: '+disconnectMessage.reason);

        } else {
            console.log('xSDK channels/message.js - Received JSON:', jsonMessage)
        }
    }

    sendTransaction(id, data) {
        var data = JSON.stringify({
            "type": "TransactionComplete",
            "content": JSON.stringify(data),
            // "content":"{\"Result\":0}",
            "id": id,
            "cv": ""
        })

        this.send(data)
    }

    generateMessage(path, data) {
        return {
            "type": "Message",
            "content": JSON.stringify(data),
            "id": "41f93d5a-900f-4d33-b7a1-2d4ca6747072",
            "target": path,
            "cv": ""
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