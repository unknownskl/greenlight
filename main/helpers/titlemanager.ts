import Application from '../application'
import HTTP from './http'
import Store from 'electron-store'

interface titleInfoArgs {
    ProductTitle: string,
    PublisherName: string,
    XCloudTitleId: string,
    Image_Tile: any,
    Image_Poster: any,
    Streamability: any,
    Categories: any,
    LocalizedCategories: any,
    XCloudOfferings: any,
    XboxTitleId: string,
    ChildXboxTitleIds: any,
    StoreId: string
}

export default class TitleManager {

    _application:Application
    _store = new Store()
    _http:HTTP

    _xCloudTitles = {}
    _productIdQueue = []

    _xCloudRecentTitles = {}
    _xCloudRecentTitlesLastUpdate = 0

    
    constructor(application){
        this._application = application
        this._http = new HTTP(this._application)
    }

    setCloudTitles(titles){
        this._xCloudTitles = {}

        for(const title in titles.results){
            // console.log('title:', titles.results[title].details)
            const titleItem = new Title(titles.results[title])
            this._xCloudTitles[titles.results[title].titleId] = titleItem
            // console.log(titleItem)

            const titleIdCache = this._store.get('title.'+titles.results[title].titleId)
            if(titleIdCache === undefined){
                // Item is not stored, lets batch it to load
                this._productIdQueue.push(titles.results[title].details.productId)
            } else {
                // Restore info
                this._xCloudTitles[titles.results[title].titleId].restoreFromCache(titleIdCache)
            }
        }

        if(this._productIdQueue.length > 0){
            this._http.post('catalog.gamepass.com', '/v3/products?market=US&language=en-US&hydration=RemoteLowJade0', {
                "Products": this._productIdQueue
            }, {
                'ms-cv': 0,
                'calling-app-name': 'Xbox Cloud Gaming Web',
                'calling-app-version': '21.0.0',

            }).then((result:any) => {
                this.populateTitleInfo(result.Products)

            }).catch((error) => {
                console.log('Error:', error)
            })
        }

        // We got all info!
        console.log(this)
    }

    getRecentTitles(){
        return new Promise((resolve, reject) => {

            this._application.log('TitleManager', 'Getting recent titles. Cache expired:', this._xCloudRecentTitlesLastUpdate < Date.now() - 60*1000, 'Remaining:', (this._xCloudRecentTitlesLastUpdate - Date.now() + 60*1000) / 1000)
            if(this._xCloudRecentTitlesLastUpdate < Date.now() - 60*1000){
                this._application._events._xCloudApi.getRecentTitles().then((titles:any) => {
                    this._xCloudRecentTitles = titles
                    this._xCloudRecentTitlesLastUpdate = Date.now()
                    resolve(titles)
                }).catch((error) => {
                    reject(error)
                })

            } else {
                resolve(this._xCloudRecentTitles)
            }
        })
    }

    populateTitleInfo(titleInfo:titleInfoArgs[]){
        for(const product in titleInfo){
            const xCloudTitle = titleInfo[product].XCloudTitleId

            if(this._xCloudTitles[xCloudTitle] !== undefined){
                this._xCloudTitles[xCloudTitle].setCatalogDetails(titleInfo[product])

                this._store.set('title.'+titleInfo[product].XCloudTitleId, this._xCloudTitles[xCloudTitle])
            } else {
                const altTitle = this.findTitleByProductId(titleInfo[product].StoreId)
                if(altTitle !== undefined){
                    altTitle.setCatalogDetails(titleInfo[product])
                    this._store.set('title.'+altTitle.titleId, altTitle)
                } else {
                    this._application.log('TitleManager', 'Title not found in cache:', titleInfo[product].XCloudTitleId, titleInfo[product].StoreId, titleInfo[product])
                }
            }
        }
    }

    findTitleByProductId(productId:string){
        for(const title in this._xCloudTitles){
            if(this._xCloudTitles[title].productId === productId){
                return this._xCloudTitles[title]
            }
        }

        return undefined
    }

    findTitle(titleId:string){
        if(this._xCloudTitles[titleId] !== undefined){
            return this._xCloudTitles[titleId]
        }

        return undefined
    }
}

interface TitleDetails {
    titleId:string
    details: {
        productId:string,
        xboxTitleId:number,
        hasEntitlement:boolean,
        supportsInAppPurchases:boolean,
        supportedTabs: any,
        supportedInputTypes: any,
        programs: any,
        userPrograms: any,
        userSubscriptions: any,
        isFreeInStore: boolean
        maxGameplayTimeInSeconds: number
    }
}

export class Title {

    titleId
    productId
    xboxTitleId
    supportedInputTypes
    catalogDetails

    constructor(title:TitleDetails){
        this.titleId = title.titleId
        this.productId = title.details.productId
        this.xboxTitleId = title.details.xboxTitleId
        this.supportedInputTypes = title.details.supportedInputTypes
    }

    setCatalogDetails(titleInfo:titleInfoArgs){
        this.catalogDetails = titleInfo
    }

    toString(){
        return JSON.stringify(this)
    }

    restoreFromCache(cachedObj){
        this.catalogDetails = cachedObj.catalogDetails
    }
}