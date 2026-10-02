import Application from '../application'
import HTTP from './http'
import Store from 'electron-store'

const CATALOG_BATCH_SIZE = 100
const CATALOG_CONCURRENCY = 3

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
    onlyEntitled?: boolean;
    showNonEntitled?: boolean;
}

export default class TitleManager {

    _application:Application
    _store = new Store()
    _http:HTTP

    _xCloudTitles = {}
    _productIdQueue:string[] = []
    _catalogRefresh:Promise<void> = Promise.resolve()

    _xCloudRecentTitles = {}
    _xCloudRecentTitlesLastUpdate = 0

    constructor(application){
        this._application = application
        this._http = new HTTP(this._application)
    }

    setCloudTitles(titles){
        this._xCloudTitles = {}

        const entitledProductIds = []
        for(const rawTitle of Object.values(titles.results || {}) as TitleDetails[]){
            if(!rawTitle?.titleId){
                this._application.log('TitleManager', 'Ignoring title without a title ID:', rawTitle)
                continue
            }

            const titleItem = new Title(rawTitle)
            this._xCloudTitles[rawTitle.titleId] = titleItem

            if(titleItem.productId){
                if(titleItem.hasEntitlement){
                    entitledProductIds.push(titleItem.productId)
                }
            }
        }

        // The default library only shows entitled titles. Restricting enrichment
        // to those products avoids requesting metadata for thousands of entries
        // that cannot be launched by the current user.
        this._productIdQueue = Array.from(new Set(entitledProductIds))

        const cachedCatalog = this._store.get('xcloud_catalog_cache', {}) as Record<string, titleInfoArgs>
        if(cachedCatalog && Object.keys(cachedCatalog).length > 0){
            this.populateTitleInfo(cachedCatalog)
        }

        if(this._productIdQueue.length === 0){
            this._catalogRefresh = Promise.resolve()
            return this._catalogRefresh
        }

        const uncachedProductIds = this._productIdQueue.filter((productId) => {
            return this.findTitleByProductId(productId)?.catalogDetails === undefined
        })
        const cachedProductIds = this._productIdQueue.filter((productId) => {
            return this.findTitleByProductId(productId)?.catalogDetails !== undefined
        })

        this._catalogRefresh = this.refreshCatalog([
            ...uncachedProductIds,
            ...cachedProductIds,
        ], cachedCatalog).catch((error) => {
            this._application.log('TitleManager', 'Unable to refresh title cache:', error)
        })

        return this._catalogRefresh
    }

    waitForCatalog(){
        return this._catalogRefresh
    }

    async refreshCatalog(productIds:string[], cachedCatalog:Record<string, titleInfoArgs>){
        const batches:string[][] = []
        for(let i = 0; i < productIds.length; i += CATALOG_BATCH_SIZE) {
            batches.push(productIds.slice(i, i + CATALOG_BATCH_SIZE))
        }

        const allProducts:Record<string, titleInfoArgs> = {}
        let nextBatch = 0

        const workers = Array.from({ length: Math.min(CATALOG_CONCURRENCY, batches.length) }, async () => {
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
                    if(result?.Products && typeof result.Products === 'object'){
                        Object.assign(allProducts, result.Products)
                        this.populateTitleInfo(result.Products)
                    } else {
                        this._application.log('TitleManager', 'Catalog batch returned no products:', batch)
                    }
                } catch(error) {
                    this._application.log('TitleManager', 'Unable to resolve catalog batch:', error)
                }
            }
        })

        await Promise.all(workers)

        const currentProductIds = new Set(productIds)
        const productsToCache = Object.entries({ ...cachedCatalog, ...allProducts }).reduce((current, [key, product]:[string, titleInfoArgs]) => {
            if(product?.StoreId && currentProductIds.has(product.StoreId)){
                current[key] = product
            }
            return current
        }, {} as Record<string, titleInfoArgs>)

        this._store.set('xcloud_catalog_cache', productsToCache)
    }

    getNewTitles(){
        return this._http.get('catalog.gamepass.com', '/sigls/v2?id=f13cf6b4-57e6-4459-89df-6aec18cf0538&market=US&language=en-US')
    }

    populateTitleInfo(titleInfo:Record<string, titleInfoArgs> | titleInfoArgs[]){
        for(const product of Object.values(titleInfo)){
            if(!product){
                continue
            }

            const xCloudTitle = product.XCloudTitleId

            if(this._xCloudTitles[xCloudTitle] !== undefined){
                this._xCloudTitles[xCloudTitle].setCatalogDetails(product)

            } else {
                const altTitle = this.findTitleByProductId(product.StoreId)
                if(altTitle !== undefined){
                    altTitle.setCatalogDetails(product)

                } else {
                    this._application.log('TitleManager', 'Title not found in cache:', product.XCloudTitleId, product.StoreId, product)
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

    getTitles(onlyEntitled = true){
        const returnTitles = []

        for(const title in this._xCloudTitles){
            const titleObj = this._xCloudTitles[title]

            if(!onlyEntitled || titleObj.hasEntitlement === true){
                returnTitles.push(titleObj.titleId)
            }
        }

        return returnTitles
    }

    filterTitles(filter:FilterArgs){
        const returnTitles = []
        const query = (filter.name || '').trim().toLowerCase()
        const onlyEntitled = filter.onlyEntitled !== false

        for(const title in this._xCloudTitles){
            const titleObj = this._xCloudTitles[title]
            if(onlyEntitled && titleObj.hasEntitlement !== true){
                continue
            }

            if(query === ''){
                returnTitles.push(titleObj.titleId)
            } else if(titleObj.catalogDetails !== undefined && titleObj.catalogDetails.ProductTitle){
                if(titleObj.catalogDetails.ProductTitle.toLowerCase().includes(query)){
                    returnTitles.push(titleObj.titleId)
                }
            }
        }

        return returnTitles
    }
}

interface TitleDetails {
    titleId:string;
    details?: {
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

    titleId: string
    productId?: string
    xboxTitleId?: number
    supportedInputTypes: any
    catalogDetails: any
    hasEntitlement: boolean

    constructor(title:TitleDetails){
        this.titleId = title.titleId
        this.productId = title.details?.productId
        this.xboxTitleId = title.details?.xboxTitleId
        this.supportedInputTypes = title.details?.supportedInputTypes
        this.hasEntitlement = Boolean(title.details?.hasEntitlement || title.details?.isFreeInStore)
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
