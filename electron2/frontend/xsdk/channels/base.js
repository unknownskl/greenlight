class BaseChannel {

    #queue = []
    #client = null;
    #channelName = null;

    constructor(channelName, client) {
        this.#channelName = channelName;
        this.#client = client;
    }
    
    // Events
    // onOpen(event) {
    //     console.log('xSDK channel/base.js - ['+this.#channelName+'] onOpen:', event)
    // }
    
    // onMessage(event) {
    //     console.log('xSDK channel/base.js - ['+this.#channelName+'] onMessage:', event)
    // }

    // onClose(event) {
    //     console.log('xSDK channel/base.js - ['+this.#channelName+'] onClose:', event)
    // }

    // Queue functions
    getQueueLength() {
        return this.#queue.length
    }

    addToQueue(data) {
        this.#queue.push(data)
    }

    // Channel functions
    send(data) {
        var channel = this.getClient().getChannel(this.#channelName);

        // Encode to ArrayBuffer if not ArrayBuffer
        if(typeof data === 'string'){
            data = (new TextEncoder).encode(data)
        }
        
        if(channel.readyState === 'open') {
            if(this.#channelName !== 'input')
                console.log('xSDK channels/base.js - ['+this.#channelName+'] Sending message:', data)

            channel.send(data)
        } else {
            console.warn('xSDK channels/base.js - ['+this.#channelName+'] Channel is closed. Failed to send packet:', data)
        }
    }

    // Base functions
    getClient() {
        return this.#client
    }
}