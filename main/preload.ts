import { contextBridge, ipcRenderer, shell } from 'electron'
import pkg from '../package.json'

export const Preload = {

    send(channel:string, action:string, data = {}){
        return new Promise((resolve, reject) => {
            const requestId = Math.round(Math.random()*1000)

            ipcRenderer.send(channel, {
                id: requestId,
                action: action,
                data: data,
            })

            // Wait for event back..
            const callbackFunction = (event, args) => {
                if(args.action === action && args.id === requestId){
                    ipcRenderer.removeListener(channel, callbackFunction)
                    
                    if(args.error === undefined)
                        resolve(args.data)
                    else {
                        // if(args.error.status){
                        //     alert('HTTP Status: ' + args.error.status + '\nPath:' + args.error.url + '\n' + args.error.body)
                        // } else {
                        //     alert(args.error)
                        // }
                        reject(args.error)
                    }
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

    openExternal(url:string){
        shell.openExternal(url)
    },

    getVersion(){
        return pkg.version
    },

    isWebUI(){
        return false
    },
}

contextBridge.exposeInMainWorld('Greenlight', Preload)