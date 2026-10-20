import IpcBase from './base'

export default class IpcConsoles extends IpcBase {
    // _streamingSessions:any = {}

    _consoles = []
    _consolesLastUpdate = 0

    get(){
        return new Promise((resolve, reject) => {
            if(this._consolesLastUpdate < Date.now() - 60*1000){
                this._application._webApi.providers.smartglass.getConsolesList().then((consoles) => {
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

    // Same as get(), but ignores the one minute cache so the power state is up to date.
    refresh(){
        this._consolesLastUpdate = 0

        return this.get()
    }

    // Wakes the console from standby (needs remote features enabled on the console).
    powerOn(args){
        return this.sendPowerCommand(args.consoleId, 'powerOn')
    }

    // Turns the console off (or to standby, depending on its power mode). A running game is closed.
    powerOff(args){
        return this.sendPowerCommand(args.consoleId, 'powerOff')
    }

    sendPowerCommand(consoleId: string, command: 'powerOn' | 'powerOff'){
        return new Promise((resolve, reject) => {
            this._application._webApi.providers.smartglass[command](consoleId).then(() => {
                this._consolesLastUpdate = 0

                resolve(true)
            }).catch((error) => {
                reject(error)
            })
        })
    }
}
