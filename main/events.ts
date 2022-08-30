import Store from 'electron-store'
import EventEmitter from 'events'
import { ipcMain } from 'electron'
import { xCloudApi, xCloudBrowser } from './helpers'
import xboxWebApi from 'xbox-webapi'
import Application from './background'

const authStore = new Store({ name: 'helper_authentication' })

const REQ_TYPE_STREAM_GET_CONSOLES = 'get_consoles'
const REQ_TYPE_STREAM_START_STREAM = 'start_stream'
const REQ_TYPE_STREAM_START_STREAM_SDP = 'start_stream_sdp'
const REQ_TYPE_STREAM_START_STREAM_ICE = 'start_stream_ice'
const REQ_TYPE_STREAM_STOP_STREAM = 'stop_stream'

const REQ_TYPE_XCLOUD_GET_TITLES = 'get_titles'

const RES_TYPE_ERROR = 'error'

export default class Events extends EventEmitter {
    _application:Application

    _xCloudApi:xCloudApi
    _xCloudBrowser:xCloudBrowser
    _xHomeApi:xCloudApi
    _webApi:xboxWebApi
    
    constructor(application){
        super()

        this._application = application

        // Init IPCMain
        this._setupStreaming()
        this._setupxCloud()

        this.on('start', (tokens) => {
            // We have been authenticated. We can load things like gamerpic etc here

            this._xHomeApi = new xCloudApi(this._application, 'uks.gssv-play-prodxhome.xboxlive.com', tokens.gamestreaming.token, 'home')
            this._xCloudApi = new xCloudApi(this._application, tokens.xcloud.host, tokens.xcloud.token, 'cloud')
            this._webApi = new xboxWebApi({
                userToken: tokens.web.token,
                uhs: tokens.web.uhs,
            })
            this._xCloudBrowser = new xCloudBrowser(this._webApi, this._application._authentication._tokens.xcloud.market)
            // console.log('web tokens:', tokens.web)

            this._webApi.getProvider('profile').get('/users/me/profile/settings?settings=GameDisplayName,GameDisplayPicRaw,Gamerscore,Gamertag').then((result) => {
                // console.log('resolve', result.profileUsers[0])

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

    _setupStreaming(){
        ipcMain.on('stream', (event, arg) => {

            if(arg.type == REQ_TYPE_STREAM_GET_CONSOLES){
                this._webApi.getProvider('smartglass').getConsolesList().then((consoles) => {
                    event.sender.send('stream', {
                        type: REQ_TYPE_STREAM_GET_CONSOLES,
                        data: consoles.result,
                    })
                }).catch((error) => {
                    event.sender.send('stream', {
                        type: RES_TYPE_ERROR,
                        message: 'Error in Promise',
                        data: error,
                    })
                })
            } else if(arg.type == REQ_TYPE_STREAM_START_STREAM){
                // Set app mode to streaming
                // event.sender.send('app_view', {
                //     streamingMode: true
                // })

                // @TODO: Implement xHome / xCloud switch
                this._xHomeApi.startSession(arg.data.serverId).then((data) => {
                    event.sender.send('stream', {
                        type: REQ_TYPE_STREAM_START_STREAM,
                        data: data,
                    })
                }).catch((error) => {
                    event.sender.send('stream', {
                        type: RES_TYPE_ERROR,
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
                        type: RES_TYPE_ERROR,
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
                        type: RES_TYPE_ERROR,
                        message: error.message || 'Error in Promise',
                        data: error,
                    })
                })
            }  else if(arg.type == REQ_TYPE_STREAM_STOP_STREAM){
                event.sender.send('app_view', {
                    streamingMode: false
                })
            } else {
                event.sender.send('stream', {
                    type: RES_TYPE_ERROR,
                    message: 'Unknown Type: '+arg.type
                })
            }
        })
    }

    _setupxCloud(){
        ipcMain.on('xcloud', (event, arg) => {
            if(arg.type == REQ_TYPE_XCLOUD_GET_TITLES){

                this._xCloudApi.getTitles().then((titles:any) => {
                    this._xCloudBrowser.loadTitles(titles.results).then((titles) => {
                        event.sender.send('xcloud', {
                            type: REQ_TYPE_XCLOUD_GET_TITLES,
                            data: titles
                        })
                    }).catch((error) => {
                        console.log('Error fetching xCloud titles:', error)
    
                        event.sender.send('xcloud', {
                            type: RES_TYPE_ERROR,
                            message: 'Error in Promise',
                            data: error,
                        })
                    })

                }).catch((error) => {
                    console.log('Error fetching xCloud titles:', error)

                    event.sender.send('xcloud', {
                        type: RES_TYPE_ERROR,
                        message: 'Error in Promise',
                        data: error,
                    })
                })

            } else if(arg.type == REQ_TYPE_STREAM_START_STREAM){
                this._xCloudApi.startSession(arg.data.serverId).then((data:any) => {
                    event.sender.send('xcloud', {
                        type: REQ_TYPE_STREAM_START_STREAM,
                        data: data,
                    })

                }).catch((error) => {
                    event.sender.send('xcloud', {
                        type: RES_TYPE_ERROR,
                        message: error.message || 'Error in Promise',
                        data: error,
                    })
                })

            } else if(arg.type == REQ_TYPE_STREAM_START_STREAM_SDP){
                // @TODO: Implement xHome / xCloud switch
                this._xCloudApi.sendSdp(arg.data.sdp).then((data) => {
                    event.sender.send('xcloud', {
                        type: REQ_TYPE_STREAM_START_STREAM_SDP,
                        data: data,
                    })

                }).catch((error) => {
                    event.sender.send('xcloud', {
                        type: RES_TYPE_ERROR,
                        message: error.message || 'Error in Promise',
                        data: error,
                    })
                })

            } else if(arg.type == REQ_TYPE_STREAM_START_STREAM_ICE){
                // @TODO: Implement xHome / xCloud switch
                this._xCloudApi.sendIce(arg.data.ice).then((data) => {
                    event.sender.send('xcloud', {
                        type: REQ_TYPE_STREAM_START_STREAM_ICE,
                        data: data,
                    })

                }).catch((error) => {
                    event.sender.send('xcloud', {
                        type: RES_TYPE_ERROR,
                        message: error.message || 'Error in Promise',
                        data: error,
                    })
                })

            } else {
                event.sender.send('xcloud', {
                    type: RES_TYPE_ERROR,
                    message: 'Unknown Type: '+arg.type
                })
            }
        })
    }

    sendIpc(name, value){
        this._application._mainWindow.webContents.send(name, value)
    }
}