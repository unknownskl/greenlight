import { v4 as uuidv4 } from 'uuid'

import Channel from './channel'
import MessageHandler from './message/handler'

export default class MessageChannel extends Channel {
    _handshakeCompleted = false
    _messageHandler:MessageHandler | undefined

    getChannelName() {
        return 'message'
    }

    getChannelConfig() {
        return {
            protocol: 'messageV1',
            ordered: true,
        }
    }

    onOpen() {
        console.log('[MessageChannel] Sending handshake...')
        const handshake = JSON.stringify({
            'type':'Handshake',
            'version':'messageV1',
            'id':'be0bfc6d-1e83-4c8a-90ed-fa8601c5a179',
            'cv':'0',
        })
        this.send(handshake)
    }

    onMessage(event: MessageEvent<any>) {
        const data = JSON.parse(event.data)
        // console.log('[MessageChannel] received:', data)

        switch(data.type){
            case 'HandshakeAck':
                console.log('[MessageChannel] Handshake completed')
                this._handshakeCompleted = true
                // Start control & input channels
                this.getPlayer()._channels.control.sendAuthorization()
                this.getPlayer()._channels.input.start()
                this.sendConfig()
                break

            case 'TransactionStart':
            case 'Message':
                // The MessageHandler constructor processes the message itself.
                // Keep a reference to the instance so it is not discarded right after creation.
                this._messageHandler = new MessageHandler(this, data)
                break

            default:
                console.log('[MessageChannel] Unhandled message type:', data.type, data)
        }

    }

    sendConfig(){
        const systemUis = []
        const systemVersion = [0, 2, 0]
        const uiConfig = JSON.stringify(this.generateMessage('/streaming/systemUi/configuration', {
            'version': systemVersion,
            'systemUis': systemUis, // Xbox Windows app has [33], xCloud has [10,19,31,27,32,-41]
            
            // 8 = unknown
            // 10 = ShowVirtualKeyboard
            // 13 = unknown
            // 15 = unknown
            // 19 = ShowMessageDialog
            // 31 = ShowApplication
            // 27 = ShowPurchase
            // 32 = ShowTimerExtensions
            // 33 = Xbox windows app, disables the nexus menu on xCloud (Alt nexus menu?)
            // -44 = unknown
            // 40 = unknown
            // 41 = unknown
            // -43 = unknown

            // Possible options: Keyboard, PurchaseModal
        }))
        this.send(uiConfig)

        const clientConfig = JSON.stringify(this.generateMessage('/streaming/properties/clientappinstallidchanged', { 'clientAppInstallId': 'c97d7ee0-73b2-4239-bf1d-9d805a338429' }))
        this.send(clientConfig)

        const orientationConfig = JSON.stringify(this.generateMessage('/streaming/characteristics/orientationchanged', { 'orientation': 0 }))
        this.send(orientationConfig)

        const touchConfig = JSON.stringify(this.generateMessage('/streaming/characteristics/touchinputenabledchanged', { 'touchInputEnabled': false }))
        this.send(touchConfig)

        const deviceConfig = JSON.stringify(this.generateMessage('/streaming/characteristics/clientdevicecapabilities', {}))
        this.send(deviceConfig)

        const dimensionsConfig = JSON.stringify(this.generateMessage('/streaming/characteristics/dimensionschanged', {
            'horizontal': 1920,
            'vertical': 1080,
            'preferredWidth': 1920,
            'preferredHeight': 1080,
            'safeAreaLeft': 0,
            'safeAreaTop': 0,
            'safeAreaRight': 1920,
            'safeAreaBottom': 1080,
            'supportsCustomResolution':true,
        }))
        this.send(dimensionsConfig)
    }

    generateMessage(path, data) {
        return {
            'type': 'Message',
            'content': JSON.stringify(data),
            'id': uuidv4(),
            'target': path,
            'cv': '',
        }
    }

    destroy() {
        // console.log('DebugChannel destroy() called')
    }
}