import IpcBase from './base'
import Application from '../application'
import TitleManager from '../helpers/titlemanager'

interface getTitleArgs {
    titleId: string;
}

interface TitleListArgs {
    showNonEntitled?: boolean;
    onlyEntitled?: boolean;
}

export default class IpcxCloud extends IpcBase {

    _titleManager:TitleManager

    _titlesAreLoaded = false
    _titlesLoadPromise:Promise<void> | undefined

    _titles = []
    _entitledTitles = []
    _nonEntitledTitles = []
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
        this.loadTitles().catch((error) => {
            this._application.log('Ipc:xCloud', 'Could not preload titles:', error)
        })
    }

    loadTitles(force = false):Promise<void>{
        if(this._titlesLoadPromise !== undefined){
            return this._titlesLoadPromise
        }

        if(this._titlesAreLoaded && !force){
            return Promise.resolve()
        }

        if(this._application._xCloudApi === undefined){
            return Promise.reject(new Error('Cannot load xCloud titles without a valid token'))
        }

        const request = this._application._xCloudApi.getTitles().then((titles:any) => {
            const allTitles = []
            const entitledTitles = []

            for(const title in titles.results){
                const item = titles.results[title]
                if(item.titleId){
                    allTitles.push(item.titleId)
                    if(item.details?.hasEntitlement || item.details?.isFreeInStore){
                        entitledTitles.push(item.titleId)
                    }
                } else {
                    this._application.log('Ipc:xCloud', 'Title found without a titleID:', item)
                }
            }

            // setCloudTitles creates the raw title records synchronously and then
            // enriches them in the background. Raw titles are sufficient to make
            // the library usable and must not be blocked by catalogue requests.
            const catalogRefresh = this._titleManager.setCloudTitles(titles)

            this._titles = allTitles
            this._entitledTitles = entitledTitles
            this._titlesLastUpdate = Date.now()
            this._titlesAreLoaded = true

            this._application.log('Ipc:xCloud', 'Titlemanager has loaded title records.')
            catalogRefresh.then(() => {
                this._application.log('Ipc:xCloud', 'Titlemanager has refreshed catalog metadata.')
            })
        }).finally(() => {
            if(this._titlesLoadPromise === request){
                this._titlesLoadPromise = undefined
            }
        })

        this._titlesLoadPromise = request
        return request
    }

    // Returns the last played titles (stream titles)
    getRecentTitles(){
        return new Promise((resolve, reject) => {
            if(this._recentTitlesLastUpdate < Date.now() - 60*1000){
                this._application._xCloudApi.getRecentTitles().then((titles:any) => {
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

    async getTitles(args:TitleListArgs = {}){
        const onlyEntitled = args ? (args?.onlyEntitled !== false) : true

        if(this._titlesLastUpdate < Date.now() - 3600*1000){
            await this.loadTitles(true)
        } else if(!this._titlesAreLoaded){
            await this.loadTitles()
        }

        if(onlyEntitled){
            return this._entitledTitles.length > 0 ? this._entitledTitles : this._titleManager.getTitles(true)
        }

        return this.filterTitlesByEntitlement(this._titles, args.showNonEntitled)
    }

    filterTitlesByEntitlement(titles, showNonEntitled = true){
        if(showNonEntitled)
            return titles

        return titles.filter((titleId) => !this._nonEntitledTitles.includes(titleId))
    }

    async filterTitles(filter: { name: string; onlyEntitled?: boolean }){
        if(!this._titlesAreLoaded){
            await this.loadTitles()
        }

        return this._titleManager.filterTitles(filter)
    }

    async getNewTitles(args:TitleListArgs = {}){
        if(!this._titlesAreLoaded){
            await this.loadTitles()
        }

        if(this._newTitlesLastUpdate < Date.now() - 3600*1000){
            const titles:any = await this._titleManager.getNewTitles()
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
        }

        return this.filterTitlesByEntitlement(this._newTitles, args.showNonEntitled)
    }

    async getTitle(args:getTitleArgs){
        if(!this._titlesAreLoaded){
            await this.loadTitles()
        }

        let title = this._titleManager.findTitle(args.titleId)
        if(title?.catalogDetails === undefined){
            await this._titleManager.waitForCatalog()
            title = this._titleManager.findTitle(args.titleId)
        }

        return title
    }
}
