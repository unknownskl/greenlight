import IpcBase from './base'
import TitleManager from '../helpers/titlemanager'

export default class IpcStore extends IpcBase {

    _titleManager = new TitleManager(this._application)

    getxCloudTitles(){
        return new Promise((resolve, reject) => {
            
            this._application._events._xCloudApi.getTitles().then((titles:any) => {
                this._titleManager.setCloudTitles(titles)
                // console.log(this._titleManager)

                const rettitles = []
                for(const xcloudtitle in this._titleManager._xCloudTitles){
                    rettitles.push(this._titleManager._xCloudTitles[xcloudtitle])
                }

                resolve(rettitles)

            }).catch((error) => {
                console.log('Error fetching xCloud titles:', error)
                reject(error)
            })

        })
    }

    getRecentTitles(){
        return this._titleManager.getRecentTitles()
    }
}