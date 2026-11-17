import IpcBase from './base'
import { withTokenRefresh } from '../helpers/tokenrefresh'

export default class IpcConsoles extends IpcBase {
    // _streamingSessions:any = {}

    _consoles = []
    _consolesLastUpdate = 0

    get(){
        return new Promise((resolve, reject) => {
            if(this._consolesLastUpdate < Date.now() - 60*1000){
                withTokenRefresh(this._application, () => this._application._webApi.providers.smartglass.getConsolesList()).then((consoles) => {
                    this._consoles = consoles.data.result
                    this._consolesLastUpdate = Date.now()

                    resolve(this._consoles)
                }).catch((error) => {
                    reject(error)
                })
            } else {
                resolve(this._consoles)
            }
        })
    }
}