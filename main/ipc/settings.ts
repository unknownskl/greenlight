import Application from '../application'
import IpcBase from './base'
import { defaultSettings } from '../../renderer/context/userContext.defaults'

export default class IpcSettings extends IpcBase {

    setSettings(args:(typeof defaultSettings)){
        return new Promise((resolve, reject) => {
            // Check for changes which we need to take action on
            // const settings = this._application._store.get('settings', defaultSettings) as Object
            // const prevSettings = {...defaultSettings, ...settings}
            const newSettings = {...defaultSettings, ...args}

            // Perform save
            this._application._store.set('settings', newSettings)
            resolve(newSettings)
        })
    }

    getSettings(){
        return new Promise<typeof defaultSettings>((resolve, reject) => {
            const settings = this._application._store.get('settings', defaultSettings) as Object;
            resolve({...defaultSettings, ...settings})
        })
    }

    getWebUIStatus(){
        return new Promise((resolve, reject) => {
            resolve((this._application._webUI._express ? true : false))
        })
    }

    startWebUI(args){
        return new Promise((resolve, reject) => {
            const rawSettings = this._application._store.get('settings', defaultSettings) as Object;
            const settings = {...defaultSettings, ...rawSettings}
            this._application._webUI.startServer(settings.webui_port)
            resolve(true)
        })
    }


    stopWebUI(args){
        return new Promise((resolve, reject) => {
            this._application._webUI.stopServer()
            resolve(false)
        })
    }

    setLowResolution(){
        return new Promise((resolve, reject) => {
            
            this.getSettings().then((settings) => {
                if(settings.app_lowresolution === false){
                    this._application._mainWindow.setSize(985, 615)
                    settings.app_lowresolution = true

                } else {
                    this._application._mainWindow.setSize(1280, 800)
                    settings.app_lowresolution = false
                }

                this.setSettings(settings)
            })


            // if(this._application._mainWindow.height !)
            // this._application._mainWindow.setSize(960, 600)
             
            resolve(true)
        })
    }
}