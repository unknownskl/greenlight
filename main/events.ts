import Store from 'electron-store'
import EventEmitter from 'events'
import { ipcMain } from 'electron'
import { xCloudApi, xCloudBrowser } from './helpers'
import xboxWebApi from 'xbox-webapi'
import Application from './application'

const authStore = new Store()

export default class Events extends EventEmitter {
    _application:Application

    _xCloudApi:xCloudApi
    _xCloudBrowser:xCloudBrowser
    _xHomeApi:xCloudApi
    _webApi:xboxWebApi
    
    constructor(application){
        super()

        this._application = application

        this.on('start', (tokens) => {
            // We have been authenticated. We can load things like gamerpic etc here
            this._xHomeApi = new xCloudApi(this._application, 'uks.gssv-play-prodxhome.xboxlive.com', tokens.gamestreaming.token, 'home')
            this._xCloudApi = new xCloudApi(this._application, tokens.xcloud.host, tokens.xcloud.token, 'cloud')
            this._webApi = new xboxWebApi({
                userToken: tokens.web.token,
                uhs: tokens.web.uhs
            })
            this._xCloudBrowser = new xCloudBrowser(this._webApi, this._application._authentication._tokens.xcloud.market)

            this._webApi.getProvider('profile').get('/users/me/profile/settings?settings=GameDisplayName,GameDisplayPicRaw,Gamerscore,Gamertag').then((result) => {
                if(result.profileUsers.length > 0) {
                    for(const setting in result.profileUsers[0].settings){

                        if(result.profileUsers[0].settings[setting].id == 'Gamertag'){
                            authStore.set('user.gamertag', result.profileUsers[0].settings[setting].value)

                        } else if(result.profileUsers[0].settings[setting].id == 'GameDisplayPicRaw'){
                            authStore.set('user.gamerpic', result.profileUsers[0].settings[setting].value)

                        } else if(result.profileUsers[0].settings[setting].id == 'Gamerscore'){
                            authStore.set('user.gamerscore', result.profileUsers[0].settings[setting].value)
                        }
                    }

                    this.emit('loaded', {
                        gamertag: authStore.get('user.gamertag')
                    })
                }
        
            }).catch(function(error){
                console.log('events.ts: Error: Failed to retrieve current user (1):', error)
            })

            this._webApi.getProvider('userpresence').get('/users/me').then((result) => {
                console.log('events.ts: Retrieved xuid:', result)
                
                // Set xuid hack
                this._webApi._authentication._user = { xid: result.xuid }
            }).catch((error) => {
                console.log('events.ts: Error: Failed to retrieve current user profile (2):', error)
            })

            this._application._ipc.onUserLoaded()

        })
    }

    sendIpc(name, value){
        this._application._mainWindow.webContents.send(name, value)
    }
}