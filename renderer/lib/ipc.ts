import { ipcRenderer } from 'electron'

export default {

    // on(channel:string, listener){
    //     ipcRenderer.on(channel, listener)
    // },

    send(channel:string, action:string, data = {}){
        return new Promise((resolve, reject) => {
            const requestId = Math.round(Math.random()*1000);

            ipcRenderer.send(channel, {
                id: requestId,
                action: action,
                data: data
            })

            // Wait for event back..
            const callbackFunction = (event, args) => {
                if(args.action === action && args.id === requestId){
                    ipcRenderer.removeListener(channel, callbackFunction)
                    resolve(args.data)
                }
            }

            ipcRenderer.on(channel, callbackFunction)

        })
    },

    on(channel:string, listener){

        const wrapEvent = (event, args) => {
            listener(event, args.action, args.data)
        }

        ipcRenderer.on(channel, wrapEvent)

        return wrapEvent
    }, 

    onAction(channel:string, action:string, listener){

        const wrapEvent = (event, args) => {
            if(args.action === action){
                listener(event, args.data)
            }
        }

        ipcRenderer.on(channel, wrapEvent)

        return wrapEvent
    },

    removeListener(channel:string, listener){
        ipcRenderer.removeListener(channel, listener)
    }
}