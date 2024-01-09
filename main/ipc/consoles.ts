import Application from '../application'
import IpcBase from './base'

export default class IpcConsoles extends IpcBase {
    // _streamingSessions:any = {}

    _consoles = []
    _consolesLastUpdate = 0

    get(){
        return new Promise((resolve, reject) => {
            if(this._consolesLastUpdate < Date.now() - 60*1000){
                this._application._events._webApi.getProvider('smartglass').getConsolesList().then((consoles) => {
                    this._consoles = consoles.result
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