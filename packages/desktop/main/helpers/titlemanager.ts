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
}

export default class TitleManager {

    _application:Application
    _store = new Store({ name: 'xcloud-title-cache' })
    _http:HTTP

    _xCloudTitles = {}
    _productIdQueue = []

    _xCloudRecentTitles = {}
    _xCloudRecentTitlesLastUpdate = 0

    
    constructor(application){
        this._application = application
        this._http = new HTTP(this._application)
    }

    async setCloudTitles(titles){
        this._xCloudTitles = {}
        this._productIdQueue = []

        for(const title in titles.results){
            const titleItem = new Title(titles.results[title])
            this._xCloudTitles[titles.results[title].titleId] = titleItem

            this._productIdQueue.push(titles.results[title].details.productId)
        }

        const cachedProducts = this._store.get('products', {}) as object
        this.populateTitleInfo(cachedProducts)

        if(this._productIdQueue.length > 0){
            const missingProducts = this._productIdQueue.filter((productId) => {
                return this.findTitleByProductId(productId)?.catalogDetails === undefined
            })

            if(missingProducts.length > 0){
                await this.refreshCatalog(this._productIdQueue, cachedProducts)
            } else {
                // Cached metadata is enough to render immediately. Refresh it in
                // the background so the next launch has current catalog details.
                this.refreshCatalog(this._productIdQueue, cachedProducts).catch((error) => {
                    this._application.log('TitleManager', 'Unable to refresh title cache:', error)
                })
            }
        }

        return true
    }

    async refreshCatalog(productIds, cachedProducts){
        const batches = []
        for(let i = 0; i < productIds.length; i += 100) {
            batches.push(productIds.slice(i, i + 100))
        }

        const results:any[] = []
        let nextBatch = 0

        // Keep a small number of requests in flight. This is substantially faster
        // than serial loading without bursting the endpoint with every batch.
        const workers = Array.from({ length: Math.min(3, batches.length) }, async () => {
            while(nextBatch < batches.length){
                const batch = batches[nextBatch++]
                try {
                    const result:any = await this._http.post('catalog.gamepass.com', '/v3/products?market=US&language=en-US&hydration=RemoteHighSapphire0', {
                        'Products': batch,
                    }, {
                        'ms-cv': 0,
                        'calling-app-name': 'Xbox Cloud Gaming Web',
                        'calling-app-version': '21.0.0',
                    })
                    results.push(result)
                } catch(error) {
                    this._application.log('TitleManager', 'Unable to resolve catalog batch:', error)
                }
            }
        })

        await Promise.all(workers)

        const allProducts = results.reduce((current, result) => {
            return { ...current, ...result.Products }
        }, {})

        console.log('Retrieved information from store:', allProducts)
        this.populateTitleInfo(allProducts)

        const currentProductIds = new Set(productIds)
        const productsToCache = Object.entries({ ...cachedProducts, ...allProducts }).reduce((current, [key, product]:[string, any]) => {
            if(currentProductIds.has(product.StoreId)){
                current[key] = product
            }
            return current
        }, {})
        this._store.set('products', productsToCache)
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
