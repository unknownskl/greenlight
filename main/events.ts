import Store from 'electron-store'
import EventEmitter from 'events'
import { ipcMain } from 'electron'
import { xCloudApi } from './helpers'
import xboxWebApi from 'xbox-webapi'

const authStore = new Store({ name: 'helper_authentication' })

const REQ_TYPE_STREAM_GET_CONSOLES = 'get_consoles'
const REQ_TYPE_STREAM_START_STREAM = 'start_stream'
const REQ_TYPE_STREAM_START_STREAM_SDP = 'start_stream_sdp'
const REQ_TYPE_STREAM_START_STREAM_ICE = 'start_stream_ice'

const RES_TYPE_STREAM_ERROR = 'error'

export default class Events extends EventEmitter {

    _xCloudApi
    _xHomeApi
    _webApi
    
    constructor(){
        super()

        // Init IPCMain
        ipcMain.on('stream', (event, arg) => {

            if(arg.type == REQ_TYPE_STREAM_GET_CONSOLES){
                this._webApi.getProvider('smartglass').getConsolesList().then((consoles) => {
                    event.sender.send('stream', {
                        type: REQ_TYPE_STREAM_GET_CONSOLES,
                        data: consoles.result,
                    })
                }).catch((error) => {
                    event.sender.send('stream', {
                        type: RES_TYPE_STREAM_ERROR,
                        message: 'Error in Promise',
                        data: error,
                    })
                })
            } else if(arg.type == REQ_TYPE_STREAM_START_STREAM){
                // @TODO: Implement xHome / xCloud switch
                this._xHomeApi.startSession(arg.data.serverId).then((data) => {
                    event.sender.send('stream', {
                        type: REQ_TYPE_STREAM_START_STREAM,
                        data: data,
                    })
                }).catch((error) => {
                    event.sender.send('stream', {
                        type: RES_TYPE_STREAM_ERROR,
                        message: error.message || 'Error in Promise',
                        data: error,
                    })
                })
            } else if(arg.type == REQ_TYPE_STREAM_START_STREAM_SDP){
                // @TODO: Implement xHome / xCloud switch
                this._xHomeApi.sendSdp(arg.data.sdp).then((data) => {
                    event.sender.send('stream', {
                        type: REQ_TYPE_STREAM_START_STREAM_SDP,
                        data: data,
                    })
                }).catch((error) => {
                    event.sender.send('stream', {
                        type: RES_TYPE_STREAM_ERROR,
                        message: error.message || 'Error in Promise',
                        data: error,
                    })
                })
            } else if(arg.type == REQ_TYPE_STREAM_START_STREAM_ICE){
                // @TODO: Implement xHome / xCloud switch
                this._xHomeApi.sendIce(arg.data.ice).then((data) => {
                    event.sender.send('stream', {
                        type: REQ_TYPE_STREAM_START_STREAM_ICE,
                        data: data,
                    })
                }).catch((error) => {
                    event.sender.send('stream', {
                        type: RES_TYPE_STREAM_ERROR,
                        message: error.message || 'Error in Promise',
                        data: error,
                    })
                })
            } else {
                event.sender.send('stream', {
                    type: RES_TYPE_STREAM_ERROR,
                    message: 'Unknown Type: '+arg.type
                })
            }
        })

        this.on('start', (tokens) => {
            // We have been authenticated. We can load things like gamerpic etc here

            this._xHomeApi = new xCloudApi('uks.gssv-play-prodxhome.xboxlive.com', tokens.gamestreaming.token, 'home')
            this._xCloudApi = new xCloudApi(tokens.xcloud.host, tokens.xcloud.token, 'cloud')
            this._webApi = new xboxWebApi({
                userToken: tokens.web.token,
                uhs: tokens.web.uhs,
            })
            console.log('web tokens:', tokens.web)

            this._webApi.getProvider('profile').get('/users/me/profile/settings?settings=GameDisplayName,GameDisplayPicRaw,Gamerscore,Gamertag').then(function(result){
                console.log('resolve', result.profileUsers[0])

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
                }
        
            }).catch(function(error){
                console.log('reject', error)
            })

            // this._webApi.getProvider('smartglass').getConsolesList().then((consoles) => {
            //     console.log('webapi response:', consoles)
            // }).catch((error) => {
            //     console.log(error)
            // })
            
            // this._xCloudApi.getConsoles().then((consoles) => {
            //     console.log(consoles)
            // }).catch((error) => {
            //     console.log(error)
            // })
        })
    }
}