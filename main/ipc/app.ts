import IpcBase from './base'
import { session } from 'electron'
import electron from 'electron'
import { defaultSettings } from '../../renderer/context/userContext.defaults'

interface setForceRegionIpArgs {
    ip:string
}

export default class IpcApp extends IpcBase {
    // _streamingSessions:any = {}

    loadCachedUser(){
        return new Promise((resolve, reject) => {
            const user = this.getUserState()

            resolve(user)

            // this.sendAuthState()
        })
    }

    getUserState(){
        const gamertag = this._application._store.get('user.gamertag')
        const gamerpic = this._application._store.get('user.gamerpic')
        const gamerscore = this._application._store.get('user.gamerscore')

        return {
            signedIn: gamertag ? true : false,
            type: 'user',
            gamertag: gamertag ? gamertag : '',
            gamerpic: gamerpic ? gamerpic : '',
            gamerscore: gamerscore ? gamerscore : '',
            level: this._application._authentication._appLevel,
        }
    }

    getAuthState(){
        return new Promise((resolve, reject) => {
            resolve({
                isAuthenticating: this._application._authentication._isAuthenticating,
                isAuthenticated: this._application._authentication._isAuthenticated,
                user: this.getUserState()
            })
        })
    }

    login(){
        return new Promise((resolve, reject) => {
            this._application._authentication.startAuthflow()
            resolve(true)
        })
    }

    quit(){
        return new Promise((resolve, reject) => {
            resolve(true)
            setTimeout(() => {
                this._application.quit()
            }, 100)
        })
    }
    
    restart(){
        return new Promise((resolve, reject) => {
            resolve(true)
            setTimeout(() => {
                this._application.restart()
            }, 100)
        })
    }

    clearData(){
        return new Promise((resolve, reject) => {
            session.defaultSession.clearStorageData().then(() => {
                this._application._store.delete('user')
                this._application._store.delete('auth')

                this._application.log('authentication', __filename+'[startIpcEvents()] Received restart request. Restarting application...')
                this._application.restart()
                resolve(true)

            }).catch((error) => {
                this._application.log('authentication', __filename+'[startIpcEvents()] Error: Failed to clear local storage!')
                reject(error)
            })
        })
    }

    getOnlineFriends(){
        return new Promise((resolve, reject) => {
            resolve(this._application._xboxWorker._onlineFriends)
        })
    }

    onUiShown(){

        return new Promise((resolve, reject) => {
            resolve({
                autoStream: this._application.getStartupFlags().autoStream
            })
            this._application.getStartupFlags().autoStream = ''
        }) 
    }

    setForceRegionIp(args:setForceRegionIpArgs){
        return new Promise((resolve, reject) => {
            console.log("IPC received force region IP data and write to store:", args.ip)
            this._application._store.set('force_region_ip', args.ip);

            // Rerun silent flow to retrieve new tokens
            this._application._authentication.startSilentFlow();

            resolve(true)
        })
    }

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
                settings.app_lowresolution

                if(settings.app_lowresolution === false){
                    this._application._mainWindow.setSize(960, 600)
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

    async debug(){
        const returnValue = []

        const gpuInfo = await electron.app.getGPUInfo("complete")

        // Application Values
        returnValue.push({
            name: 'Application',
            data: [
                { name: 'Name', value: 'Greenlight' },
                { name: 'Version', value: electron.app.getVersion() },
                { name: 'GPU Info', value: gpuInfo.auxAttributes.glRenderer },
            ]
        })

        // xCloud values
        returnValue.push({
            name: 'xCloud',
            data: [
                { name: 'Titles in cache', value: this._application._ipc._channels.xCloud._titles.length },
                { name: 'Titles last update', value: this._application._ipc._channels.xCloud._titlesLastUpdate },
                { name: 'Recent titles in cache', value: this._application._ipc._channels.xCloud._recentTitles.length },
                { name: 'Recent titles last update', value: this._application._ipc._channels.xCloud._recentTitlesLastUpdate },
                { name: '', value: ''},
                { name: 'Titlemanager titles loaded', value: Object.keys(this._application._ipc._channels.xCloud._titleManager._xCloudTitles).length },

            ]
        })

        // Streaming values
        returnValue.push({
            name: 'Streaming',
            data: [
                { name: 'Active sessions', value: Object.keys(this._application._ipc._channels.streaming._streamManager._sessions).length },

            ]
        })

        return returnValue
    }
}
