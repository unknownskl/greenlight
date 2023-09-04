import IpcBase from './base';

export default class IpcStore extends IpcBase {

    getxCloudTitles(){
        return new Promise((resolve, reject) => {
            
            this._application._events._xCloudApi.getTitles().then((titles:any) => {
                this._application._events._xCloudBrowser.loadTitles(titles.results).then((titles) => {

                    // this.send('store', {
                    //     action: 'updatePage',
                    //     id: 0,
                    //     data: {}
                    // })

                    resolve(titles)
                }).catch((error) => {
                    reject(error)
                })

            }).catch((error) => {
                console.log('Error fetching xCloud titles:', error)
                reject(error)
            })

        })
    }
}