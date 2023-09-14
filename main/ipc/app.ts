import IpcBase from './base'
import { session } from 'electron'

export default class IpcApp extends IpcBase {
    // _streamingSessions:any = {}

    loadCachedUser(){
        return new Promise((resolve, reject) => {
            const gamertag = this._application._store.get('user.gamertag')
            const gamerpic = this._application._store.get('user.gamerpic')
            const gamerscore = this._application._store.get('user.gamerscore')

            resolve({
                signedIn: gamertag ? true : false,
                type: 'user',
                gamertag: gamertag ? gamertag : '',
                gamerpic: gamerpic ? gamerpic : '',
                gamerscore: gamerscore ? gamerscore : '',
                level: this._application._authentication._appLevel,
            })

            this.sendAuthState()
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
            this._application.quit()
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
                level: this._application._authentication._appLevel,
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
}