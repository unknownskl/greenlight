import pkg from '../../package.json'
import WebsocketIPC from './websocket'

export default {

    // on(channel:string, listener){
    //     ipcRenderer.on(channel, listener)
    // },

    send(channel:string, action:string, data = {}){
        if(window.Greenlight === undefined){
            // Electron API Not available. Lets mock!
            window.Greenlight = this.websocketFallbackApi()
        }

        // console.log('DEBUG:', window.Greenlight)
        return window.Greenlight.send(channel, action, data)
    },

    on(channel:string, listener){
        if(window.Greenlight === undefined){
            // Electron API Not available. Lets mock!
            window.Greenlight = this.websocketFallbackApi()
        }

        // console.log('DEBUG', window.Greenlight)
        return window.Greenlight.on(channel, listener)
    }, 

    onAction(channel:string, action:string, listener){
        if(window.Greenlight === undefined){
            // Electron API Not available. Lets mock!
            window.Greenlight = this.websocketFallbackApi()
        }

        // console.log('DEBUG', window.Greenlight)
        return window.Greenlight.onAction(channel, action, listener)
    },

    removeListener(channel:string, listener){
        if(window.Greenlight === undefined){
            // Electron API Not available. Lets mock!
            window.Greenlight = this.websocketFallbackApi()
        }

        // console.log('DEBUG', window.Greenlight)
        return window.Greenlight.removeListener(channel, listener)
    },

    websocketFallbackApi(){
        const websocket = new WebsocketIPC('ws://'+window.location.hostname+':'+window.location.port+'/ipc')

        console.log('Injecting Greenlight Websocker IPC')

        return {
            _websocket: websocket,

            send(channel, action, data){
                // console.log('GreenlightAPI send()', channel, action, data)
                return this._websocket.send(channel, action, data)
            },
            on(channel, listener){
                // console.log('GreenlightAPI on()', channel, listener)
                return this._websocket.on(channel, listener)
            },
            onAction(channel, action, listener){
                // console.log('GreenlightAPI onAction()', channel, action, listener)
                return this._websocket.onAction(channel, action, listener)

            },
            removeListener(channel, listener){
                // console.log('GreenlightAPI removeListener()', channel, listener)
                return this._websocket.removeListener(channel, listener)
            },

            getVersion(){
                return pkg.version+' (WebUI)'
            },

            openExternal(url:string){
                window.open(url, '_blank')
            },

            isWebUI(){
                return true
            }
        }
    }
}

