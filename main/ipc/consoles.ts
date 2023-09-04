import Application from '../application'
import IpcBase from './base'

export default class IpcConsoles extends IpcBase {
    _streamingSessions:any = {}

    get(){
        return new Promise((resolve, reject) => {
            this._application._events._webApi.getProvider('smartglass').getConsolesList().then((consoles) => {
                resolve(consoles.result)
            }).catch((error) => {
                reject(error)
            })
        })
    }
}