import IpcBase from './base'
import Application from '../application'
import TitleManager from '../helpers/titlemanager'

interface getTitleArgs {
    titleId: string
}

export default class IpcxCloud extends IpcBase {

    _titleManager:TitleManager

    _titlesAreLoaded = false

    _titles = []
    _titlesLastUpdate = 0

    _recentTitles = []
    _recentTitlesLastUpdate = 0

    _newTitles = []
    _newTitlesLastUpdate = 0

    constructor(application:Application){
        super(application)

        this._titleManager = new TitleManager(application)
    }

    startUp(){
        this._application.log('Ipc:xCloud', 'Starting xCloud IPC Channel...')
    }

    onUserLoaded(){
        this._application._events._xCloudApi.getTitles().then((titles:any) => {
            this._titleManager.setCloudTitles(titles).then(() => {

                this._application.log('Ipc:xCloud', 'Titlemanager has loaded all titles.')
                this._titlesAreLoaded = true

                // Uncomment to delay the process of loading data
                // setTimeout(() => {
                //     this._titlesAreLoaded = true
                // }, 5000)

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
    
                    for(const title in titles.results){
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
            if(this._recentTitlesLastUpdate < Date.now() - 3600*1000){
                this._application._events._xCloudApi.getTitles().then((titles:any) => {
                    const returnTitles = []
                    console.log('titles:', titles)

                    for(const title in titles.results){
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

    filterTitles(filter){
        return new Promise((resolve, reject) => {
            const titles = this._titleManager.filterTitles(filter)

            resolve(titles)
        })
    }

    getNewTitles(){
        return new Promise((resolve, reject) => {
            if(this._newTitlesLastUpdate < Date.now() - 3600*1000){
                this._titleManager.getNewTitles().then((titles:any) => {

                    const returnTitles = []

                    for(const title in titles){
                        if(titles[title].id !== undefined){
                            const storeTitle = this._titleManager.findTitleByProductId(titles[title].id)
                            
                            if(storeTitle === undefined){
                                this._application.log('Ipc:xCloud', 'Title not found in cache:', storeTitle, titles[title])
                            } else {
                                returnTitles.push(storeTitle.titleId)
                            }
                        } else {
                            this._application.log('Ipc:xCloud', 'Title found without an id:', titles[title])
                        }
                    }
                    
                    this._newTitles = returnTitles
                    this._newTitlesLastUpdate = Date.now()

                    resolve(returnTitles)
                }).catch((error) => {
                    reject(error)
                })
            } else {
                resolve(this._newTitles)
            }
        })
    }

    getTitle(args:getTitleArgs){
        return new Promise((resolve, reject) => {
            if(this._titlesAreLoaded === false){

                this.waitForTitle(resolve, args)
            } else {
                const title = this._titleManager.findTitle(args.titleId)

                resolve(title)
            }
        })
    }

    waitForTitle(resolveCallback, args:getTitleArgs){
        setTimeout(() => {
            if(this._titlesAreLoaded === false){
                this._application.log('Ipc:xCloud', 'Titles not loaded yet. Queueing title:', args.titleId, this._titlesAreLoaded, this._titleManager._xCloudTitles)
                this.waitForTitle(resolveCallback, args)
            } else {
                const title = this._titleManager.findTitle(args.titleId)

                resolveCallback(title)
            }    
        }, 200)
    }
}