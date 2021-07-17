class ChatChannel extends BaseChannel {

    onMessage(event) {
        console.log('xSDK channels/chat.js - Received message:', event)
    }
}