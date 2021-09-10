import Application from "./application";
// import https from 'https'
import apiClient from "./apiclient";
import xCloudClient from "./xcloudclient";

export default class xCloudView {

    _application:Application;
    _xCloudClient:xCloudClient;
    _apiClient:apiClient;

    _unprocessedTitles:Array<any> = []
    _titles:any = {}

    constructor(application:Application){
        this._application = application

        console.log('xCloudView.js: Created view')

        const backgrounds = [
            // 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_1.jpg\')',
            // 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_2.jpg\')',
            // 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_3.jpg\')',
            'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_4.jpg\')',
        ]

        const appView = (<HTMLInputElement>document.getElementById('xCloudView'))
        // appView.style.backgroundImage = "linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url('assets/images/background_1.jpg')"
        // appView.style.backgroundImage = "linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url('assets/images/background_2.jpg')"
        const randomSelect = backgrounds[Math.floor(Math.random()*backgrounds.length)];
        appView.style.backgroundImage = randomSelect
        
        // Load titles
        this._xCloudClient = new xCloudClient(this._application._tokenStore._xCloudRegionHost, this._application._tokenStore._xCloudStreamingToken)
        this._apiClient = new apiClient(this._application._tokenStore._web.uhs, this._application._tokenStore._web.userToken)

        this._xCloudClient.getTitles().then((titles:any) => {
            
            for(const title in titles.results){
                // console.log(titles.results[title])
                const titleId = titles.results[title].titleId
                const details = titles.results[title].details

                this._unprocessedTitles.push({
                    titleId: titleId,
                    details: details
                })

                this._titles[details.productId.toUpperCase()] = {
                    titleId: titleId,
                    details: details
                }
            }

            // We got all xCloud titles. Lets add the rest of the details from the store

            const retrieveTitleIds = ():any => {
                console.log('Unprocessed title count:', this._unprocessedTitles.length)
                // console.log('keys:', this._unprocessedTitles.splice(0, 30))
                // console.log('New unprocessed title count:', this._unprocessedTitles.length)

                if(this._unprocessedTitles.length === 0){
                    return;
                }

                const titles = this._unprocessedTitles.splice(0, 30)
                const ids = []
                for(const title in titles){
                    ids.push(titles[title].details.productId)
                }

                this._apiClient.getProducts(ids.join(',')).then((data:any) => {
                    for(const product in data.Products){
                        // console.log(data.Products[product].ProductId)
                        // console.log(data.Products[product].LocalizedProperties[0].ProductTitle)
                        // console.log(data.Products[product].LocalizedProperties[0].Images) // We need "Logo"
                        let gameImage = ''
                        for(const image in data.Products[product].LocalizedProperties[0].Images){
                            // console.log(data.Products[product].LocalizedProperties[0].Images[image].ImagePurpose)
                            // console.log(data.Products[product].LocalizedProperties[0].Images[image].Uri)
                            if(data.Products[product].LocalizedProperties[0].Images[image].ImagePurpose === 'Logo'){
                                gameImage = 'https:' + data.Products[product].LocalizedProperties[0].Images[image].Uri
                            }
                            if(gameImage === '' && data.Products[product].LocalizedProperties[0].Images[image].ImagePurpose === 'BoxArt'){
                                gameImage = 'https:' + data.Products[product].LocalizedProperties[0].Images[image].Uri
                            }
                        }

                        console.log(gameImage)

                        if(this._titles[data.Products[product].ProductId.toUpperCase()] !== undefined){
                            this._titles[data.Products[product].ProductId.toUpperCase()]['name'] = data.Products[product].LocalizedProperties[0].ProductTitle
                            this._titles[data.Products[product].ProductId.toUpperCase()]['image'] = gameImage
                            this._titles[data.Products[product].ProductId.toUpperCase()]['storeDetails'] = data.Products[product]
                        } else {
                            console.log('No product found in memory:', data.Products[product].ProductId.toUpperCase())
                        }

                        // for(const title in titles){
                        //     if(data.Products[product].ProductId === titles[title].details.productId){
                        //         // We match the product id. Lets insert the title

                        //         // this._titles.push({
                        //         //     ...titles[title],
                        //         //     name: data.Products[product].LocalizedProperties[0].ProductTitle,
                        //         //     image: gameImage,
                        //         //     storeDetails: data.Products[product],
                        //         // })
                                
                        //         break;
                        //     }
                        // }
                    }

                    this.renderTitles()
                })
                // @TODO: Check if there are any left
                return retrieveTitleIds()

                // this.renderTitles()
            }

            retrieveTitleIds()
            
        })


        // // Bind test button
        // const startxCloudTestStream = (<HTMLInputElement>document.getElementById('startxCloudTestStream'))
        // startxCloudTestStream.onclick = (event: any) => {
        //     console.log('Starting xcloud stream...')
        //     this._application.startStream('xcloud', 'DESTINY2')

            
        // }
        // const startxCloudTestStream2 = (<HTMLInputElement>document.getElementById('startxCloudTestStream2'))
        // startxCloudTestStream2.onclick = (event: any) => {
        //     console.log('Starting xcloud stream...')
        //     this._application.startStream('xcloud', 'NEWSUPERLUCKYSTALE')
        // }
          
    }

    load(){
        return new Promise((resolve, reject) => {
            console.log('xCloudView.js: Loaded view')
            resolve(true)
        })
    }

    unload(){
        return new Promise((resolve, reject) => {
            console.log('xCloudView.js: Unloaded view')
            resolve(true)
        })
    }

    renderTitles(){
        console.log(this._titles)

        let renderHtml = ''
        document.getElementById('xCloud').innerHTML = ''

        for(const title in this._titles){
            renderHtml += '<div class="titleWrap"><div class="titleItem">'
            renderHtml += ' <img class="titleImage" src="'+this._titles[title].image+'" />'
            renderHtml += ' '+this._titles[title].name+''
            renderHtml += ' <button class="btn btn-primary" id="xcloud_stream_'+this._titles[title].titleId+'">Play!</button>'
            renderHtml += '</div></div>'
        }

        document.getElementById('xCloud').innerHTML = renderHtml

        for(const title in this._titles) {
            document.getElementById('xcloud_stream_'+this._titles[title].titleId).addEventListener('click', (e:Event) => {
                this._application.startStream('xcloud', this._titles[title].titleId)
            })
        }
    }
}