import IpcBase from './base'
import Application from '../application'
import TitleManager from '../helpers/titlemanager'

interface getTitleArgs {
    titleId: string
}

export default class IpcxCloud extends IpcBase {

    _titleManager:TitleManager

    _titles = []
    _titlesLastUpdate = 0

    _recentTitles = []
    _recentTitlesLastUpdate = 0

    constructor(application:Application){
        super(application)

        this._titleManager = new TitleManager(application)
    }

    onUserLoaded(){
        // @TODO: Refactor this code to perform batches and perform better caching
        this._application._events._xCloudApi.getTitles().then((titles:any) => {
            this._titleManager.setCloudTitles(titles).then(() => {

                // Titles are loaded

            }).catch((error) => {
                this._application.log('Ipc:xCloud', 'Titlemanager is unable to load titles:', error)
                console.log('Error setting xCloud titles:', error)
            })

        }).catch((error) => {
            this._application.log('Ipc:xCloud', 'Could not load recent titles:', error)
        })
    }

    // Returns the last played titles (stream titles)
    getRecentTitles(){
        return new Promise((resolve, reject) => {
            if(this._recentTitlesLastUpdate < Date.now() - 60*1000){
                this._application._events._xCloudApi.getRecentTitles().then((titles:any) => {
                    const returnTitles = []
    
                    for(var title in titles.results){
                        if(titles.results[title].titleId)
                            returnTitles.push(titles.results[title].titleId)
                        else
                            this._application.log('Ipc:xCloud', 'Title found without a titleID:', titles.results[title])
                    }
                    
                    this._recentTitles = returnTitles
                    this._recentTitlesLastUpdate = Date.now()

                    resolve(returnTitles)
                }).catch((error) => {
                    reject(error)
                })

            } else {
                resolve(this._recentTitles)
            }
        })
    }

    getTitles(){
        return new Promise((resolve, reject) => {
            if(this._recentTitlesLastUpdate < Date.now() - 60*1000){
                this._application._events._xCloudApi.getTitles().then((titles:any) => {
                    const returnTitles = []
                    console.log('titles:', titles)

                    for(var title in titles.results){
                        // console.log(titles[title])
                        if(titles.results[title].titleId)
                            returnTitles.push(titles.results[title].titleId)
                        else
                            this._application.log('Ipc:xCloud', 'Title found without a titleID:', titles.results[title])
                    }

                    this._titles = returnTitles
                    this._titlesLastUpdate = Date.now()

                    resolve(returnTitles)
                })
                .catch((error) => {
                    reject(error)
                })
            } else {
                resolve(this._titles)
            }
        })
    }

    getTitle(args:getTitleArgs){
        return new Promise((resolve, reject) => {
            const title = this._titleManager.findTitle(args.titleId)

            resolve(title)
        })
    }

    // stopStream(args:stopStreamArgs){
    //     return this._streamManager.stopStream(args.sessionId)
    // }

    // sendSdp(args:sendSdpArgs){
    //     return this._streamManager.sendSdp(args.sessionId, args.sdp)
    // }

    // sendChatSdp(args:sendSdpArgs){
    //     return this._streamManager.sendChatSdp(args.sessionId, args.sdp)
    // }

    // sendIce(args:sendIceArgs){
    //     return this._streamManager.sendIce(args.sessionId, args.ice)
    // }

    // sendKeepalive(args:sendKeepaliveArgs){
    //     return this._streamManager.sendKeepalive(args.sessionId)
    // }

    // activeSessions(args:activeSessionsArgs){
    //     return this._streamManager.getActiveSessions()
    // }
}