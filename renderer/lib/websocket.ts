export default class WebsocketIPC {
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
                        this.removeListener(channel, action, listener)
                        resolve(args)
                    }
                })
            }
        })
    }

    on(channel, listener){
        if(this._on[channel] === undefined){
            this._on[channel] = []
        }
        return (this._on[channel].push(listener)-1)
    }

    private onAction(channel, action, listener){
        if(this._onAction[channel] === undefined){
            this._onAction[channel] = {}
        }
        if(this._onAction[channel][action] === undefined){
            this._onAction[channel][action] = []
        }

        return (this._onAction[channel][action].push(listener)-1)
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
                    // console.log('Fire listener for action:', ipcData.action, ipcData.data)
                }
            }
        }

    }

    removeListener(channel, action, listener){
        // console.log('removing listener:', this._onAction[channel][action][listener])
        // const func = this._onAction[channel][action].splice(listener, 1)
        delete this._onAction[channel][action][listener]

        // Check if key is empty
        for(const checkListener in this._onAction[channel][action]){
            if(this._onAction[channel][action][checkListener] !== undefined){
                return
            }
        }

        console.log('Its empty! Deleting key:', action)
        delete this._onAction[channel][action]

        // console.log('HOOKIPC: removeListener called:', channel, listener, this._onAction[channel])
    }
}