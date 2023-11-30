import { contextBridge, ipcRenderer } from 'electron';

export const Preload = {

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
                    
                    if(args.error === undefined)
                        resolve(args.data)
                    else
                        reject(args.error)
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
    },

    
    setRegionIp(ip:string) {
        ipcRenderer.send('force_region_ip', ip)
    }
};

contextBridge.exposeInMainWorld('Greenlight', Preload);
