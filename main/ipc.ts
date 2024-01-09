import Application from './application'
import IpcConsoles from './ipc/consoles'
import IpcStreaming from './ipc/streaming'
import IpcxCloud from './ipc/xcloud'
import IpcApp from './ipc/app'

import { ipcMain } from 'electron'

interface IpcChannels {
    streaming: IpcStreaming,
    consoles: IpcConsoles,
    app: IpcApp,
    xCloud: IpcxCloud,
}

export default class Ipc {

    _application:Application

    _channels:IpcChannels

    constructor(application:Application){
        this._application = application

        this._channels = {
            streaming: new IpcStreaming(this._application),
            consoles: new IpcConsoles(this._application),
            app: new IpcApp(this._application),
            xCloud: new IpcxCloud(this._application),
        }

        for(const channel in this._channels){
            ipcMain.on(channel, (event, args) => { this._channels[channel].onEvent(channel, event, args) })
        }
        
    }

    startUp(){
        for(const channel in this._channels){
            this._application.log('Ipc', 'Starting IPC channel: ' + channel)

            if(this._channels[channel].startUp)
                this._channels[channel].startUp()
        }
    }

    onUserLoaded(){
        for(const channel in this._channels){
            if(this._channels[channel].onUserLoaded){
                this._application.log('Ipc', 'Loading startup data for IPC channel: ' + channel)
                this._channels[channel].onUserLoaded()
            }
        }
    }

    // sendIpc(name, value){
    //     this._application._mainWindow.webContents.send(name, value)
    // }
}