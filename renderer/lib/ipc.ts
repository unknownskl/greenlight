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
        const websocket = new WebsocketIPC('ws://127.0.0.1:3001/ipc')

        console.log('Injecting Greenlight Websocker IPC')

        return {
            _websocket: websocket,

            send(channel, action, data){
                console.log('GreenlightAPI send()', channel, action, data)
                return this._websocket.send(channel, action, data)
            },
            on(channel, listener){
                console.log('GreenlightAPI on()', channel, listener)
                return this._websocket.on(channel, listener)
            },
            onAction(channel, action, listener){
                console.log('GreenlightAPI onAction()', channel, action, listener)
                return this._websocket.onAction(channel, action, listener)

            },
            removeListener(channel, listener){
                console.log('GreenlightAPI removeListener()', channel, listener)
                return this._websocket.removeListener(channel, listener)
            },

            getVersion(){
                return '2.1.1 (WebUI)'
            }
        }
    }
}

class WebsocketIPC {
    _websocket:WebSocket

    _on = {}
    _onAction = {}

    constructor(url){
        this._websocket = new WebSocket(url)
        this._websocket.addEventListener('message', (event) => this.onMessage(event))
    }

    send(channel, action, data){
        return new Promise((resolve, reject) => {
            if(this._websocket.readyState == 0){
                // Still connecting
                setTimeout(() => {
                    this.send(channel, action, data).then((event) => {
                        resolve(event)
                    }).catch((error) => {
                        reject(error)
                    })
                }, 200)
            } else {
                const actionId = Math.floor(Math.random() * 99999)

                this._websocket.send(JSON.stringify({
                    channel: channel,
                    id: actionId,
                    action: action,
                    data: data
                }))

                const listener = this.onAction(channel, action, (event, args) => {
                    if(event.id === actionId){
                        this.removeListener(channel, listener)
                        resolve(args)
                    } else {
                        console.log('DEBUG: Received action with different id:', event.id, actionId)
                    }
                })
            }
        })
    }

    on(channel, listener){
        if(this._on[channel] === undefined){
            this._on[channel] = []
        }
        this._on[channel].push(listener)

        return listener
    }

    onAction(channel, action, listener){
        if(this._onAction[channel] === undefined){
            this._onAction[channel] = {}
        }
        if(this._onAction[channel][action] === undefined){
            this._onAction[channel][action] = []
        }
        this._onAction[channel][action].push(listener)

        return listener
    }

    onMessage(event) {
        const ipcData = JSON.parse(event.data)
        console.log(ipcData, this._on, this._onAction)

        if(this._on[ipcData.channel] !== undefined){
            for(const listener in this._on[ipcData.channel]){
                this._on[ipcData.channel][listener](ipcData, ipcData.data)
            }
        }

        if(this._onAction[ipcData.channel] !== undefined){
            if(this._onAction[ipcData.channel][ipcData.action] !== undefined){
                for(const listener in this._onAction[ipcData.channel][ipcData.action]){
                    this._onAction[ipcData.channel][ipcData.action][listener](ipcData, ipcData.data)
                    console.log('Fire listener for action:', ipcData.action, ipcData.id)
                }
            }
        }

    }

    removeListener(channel, listener){

    }
}