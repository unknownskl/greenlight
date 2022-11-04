import https from 'https'
import xboxWebApi from 'xbox-webapi'

export default class xCloudBrowser {
    _webApi:xboxWebApi
    _market

    _titles
    _resolvedTitles = []

    _totalBatches = 0
    _currentBatch = 0

    constructor(webApi, market) {
        this._webApi = webApi
        this._market = market
    }

    loadTitles(titles){
        this._titles = titles
        this._totalBatches = Math.ceil(this._titles.length/30)
        this._currentBatch = 0
        this._resolvedTitles = []
        
        return new Promise((resolve, reject) => {

            this.resolveTitles().then((titles) => {

                console.log('resolveTitles has been resolved. Sending back data now')
                resolve(this.filterTitles({}))

            }).catch((error) => {
                reject(error)
            })
        })
    }

    resolveTitles(){
        return new Promise((resolve, reject) => {
            // Get store info
            //
            // - First batch the products into lists of 30
            // - Merge results and return to client once done.

            let ids = []
            let batchTitles = this._titles.slice(this._currentBatch*30, (this._currentBatch*30)+30)
            for(const title in batchTitles){
                ids.push(batchTitles[title].details.productId)
            }
            console.log('Fetching products:', ids)

            this.fetchProducts(ids).then((result) => {
                console.log('Fetched batch no:', this._currentBatch)
                this._currentBatch++

                for(const product in result.Products){
                    // Add xCloud info
                    // console.log('ProductID:', result.Products[product].ProductId, this._titles)

                    for(const title in this._titles){
                        if(this._titles[title].details.productId.toLowerCase() === result.Products[product].ProductId.toLowerCase()){
                            result.Products[product]['xcloudInfo'] = this._titles[title]
                            break;
                        }
                    }

                    this._resolvedTitles.push(result.Products[product])
                }

                if(this._currentBatch >= this._totalBatches){
                    resolve(true)

                } else {
                    this.resolveTitles().then((result) => {
                        resolve(true)
                    }).catch((error) => {
                        console.log(error)
                        reject(error)
                    })
                }

            }).catch((error) => {
                console.log(error)
                reject(error)
            })
        })
    }

    filterTitles(filters){
        const products = []

        for(const product in this._resolvedTitles){
            products.push({
                ...this._resolvedTitles[product]
            })
        }

        return products
    }

    fetchProducts(inputId:any){
        let ids
        if(inputId instanceof Array){
            // We got an array with id's, lets merge them
            ids = inputId.join(',')
        } else {
            ids = inputId
        }

        return this._webApi.getProvider('catalog').get('/v7.0/products?actionFilter=Browse&bigIds='+ids+'&fieldsTemplate=browse&languages=en-us&market=us')
    }
}