import IpcBase from './base'
import { session } from 'electron'

interface setForceRegionIpArgs {
    ip:string
}

export default class IpcApp extends IpcBase {
    // _streamingSessions:any = {}

    loadCachedUser(){
        return new Promise((resolve, reject) => {
            const user = this.getUserState()

            resolve(user)

            this.sendAuthState()
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

    login(){
        return new Promise((resolve, reject) => {
            this._application._authentication.startAuthflow()
            resolve(true)
        })
    }

    quit(){
        return new Promise((resolve, reject) => {
            this._application.quit()
            resolve(true)
        })
    }
    
    restart(){
        return new Promise((resolve, reject) => {
            this._application.restart()
            resolve(true)
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

    sendAuthState(){
        this.send('app', {
            id: 0,
            action: 'authState',
            data: {
                isAuthenticating: this._application._authentication._isAuthenticating,
                isAuthenticated: this._application._authentication._isAuthenticated,
                user: this.getUserState()
            }
        })
    }

    sendOnlineFriends(onlineFriends){
        this.send('app', {
            id: 0,
            action: 'onlineFriends',
            data: onlineFriends
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
}
