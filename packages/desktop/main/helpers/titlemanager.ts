import Application from '../application'
import HTTP from './http'
import Store from 'electron-store'

interface titleInfoArgs {
    ProductTitle: string;
    PublisherName: string;
    XCloudTitleId: string;
    Image_Tile: any;
    Image_Poster: any;
    Streamability: any;
    Categories: any;
    LocalizedCategories: any;
    XCloudOfferings: any;
    XboxTitleId: string;
    ChildXboxTitleIds: any;
    StoreId: string;
}

interface FilterArgs {
    name: string;
    showNonEntitled?: boolean;
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
        return new Promise((resolve, reject) => {
            this._xCloudTitles = {}

            for(const title in titles.results){
                const titleItem = new Title(titles.results[title])
                this._xCloudTitles[titles.results[title].titleId] = titleItem
                
                this._productIdQueue.push(titles.results[title].details.productId)
            }

            if(this._productIdQueue.length > 0){

                // Create batches of 100
                const batches = []
                for(let i = 0; i < this._productIdQueue.length; i += 100) {
                    batches.push(this._productIdQueue.slice(i, i + 100))
                }

                // Create promises for each batch
                const batchPromises = batches.map(batch => 
                    this._http.post('catalog.gamepass.com', '/v3/products?market=US&language=en-US&hydration=RemoteHighSapphire0', {
                        'Products': batch,
                    }, {
                        'ms-cv': 0,
                        'calling-app-name': 'Xbox Cloud Gaming Web',
                        'calling-app-version': '21.0.0',
                    })
                )

                // Execute all batches and merge results
                Promise.all(batchPromises).then((results: any[]) => {
                    const allProducts = results.reduce((current, result) => {
                        return { ...current, ...result.Products }
                    }, {})

                    console.log('Retrieved information from store:', allProducts)
                    this.populateTitleInfo(allProducts)
                    resolve(true)

                }).catch((error) => {
                    console.log('Error:', error)
                    reject(error)
                })
            } else {
                resolve(true)
            }

            // We got all info!
            // console.log(this)
        })
    }

    getNewTitles(){
        return this._http.get('catalog.gamepass.com', '/sigls/v2?id=f13cf6b4-57e6-4459-89df-6aec18cf0538&market=US&language=en-US')
    }

    populateTitleInfo(titleInfo:titleInfoArgs[]){
        for(const product in titleInfo){
            const xCloudTitle = titleInfo[product].XCloudTitleId

            if(this._xCloudTitles[xCloudTitle] !== undefined){
                this._xCloudTitles[xCloudTitle].setCatalogDetails(titleInfo[product])

            } else {
                const altTitle = this.findTitleByProductId(titleInfo[product].StoreId)
                if(altTitle !== undefined){
                    altTitle.setCatalogDetails(titleInfo[product])
                    
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

        // Perform a lookup?
        // this._application.log('TitleManager', 'Title not found in cache:', productId, 'Trying to get info from store...')
        // this._http.post('catalog.gamepass.com', '/v3/products?market=US&language=en-US&hydration=RemoteHighSapphire0', { // RemoteLowJade0
        //     "Products": [productId]
        // }, {
        //     'ms-cv': 0,
        //     'calling-app-name': 'Xbox Cloud Gaming Web',
        //     'calling-app-version': '21.0.0',

        // }).then((result:any) => {
        //     this._application.log('TitleManager', 'Retrieved information from store:', result.Products)
        //     this.populateTitleInfo(result.Products)

        // }).catch((error) => {
        //     console.log('Error:', error)
        // })

        return undefined
    }

    findTitle(titleId:string){
        if(this._xCloudTitles[titleId] !== undefined){
            return this._xCloudTitles[titleId]
        }

        return undefined
    }

    filterTitles(filter:FilterArgs){
        const returnTitles = []

        for(const title in this._xCloudTitles){
            if(this._xCloudTitles[title].catalogDetails !== undefined){
                if(filter.showNonEntitled === false && this._xCloudTitles[title].hasEntitlement === false)
                    continue

                if(this._xCloudTitles[title].catalogDetails.ProductTitle.toLowerCase().includes(filter.name.toLowerCase())){
                    returnTitles.push(this._xCloudTitles[title].titleId)
                }

            }
        }

        return returnTitles
    }
}

interface TitleDetails {
    titleId:string;
    details: {
        productId:string;
        xboxTitleId:number;
        hasEntitlement:boolean;
        supportsInAppPurchases:boolean;
        supportedTabs: any;
        supportedInputTypes: any;
        programs: any;
        userPrograms: any;
        userSubscriptions: any;
        isFreeInStore: boolean;
        maxGameplayTimeInSeconds: number;
    };
}

export class Title {

    titleId
    productId
    xboxTitleId
    hasEntitlement
    supportedInputTypes
    catalogDetails

    constructor(title:TitleDetails){
        this.titleId = title.titleId
        this.productId = title.details.productId
        this.xboxTitleId = title.details.xboxTitleId
        this.hasEntitlement = title.details.hasEntitlement
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
