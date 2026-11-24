import IpcBase from './base'
import { findGamepadHolders, quitHolder } from '../helpers/gamepadholders'
import { reconnectGamepads, isReconnectSupported } from '../helpers/gamepadreconnect'

interface QuitHolderArgs {
    pid: number;
}

export default class IpcGamepad extends IpcBase {

    // Lists other apps that hold a connected USB controller open (macOS only)
    getHolders(){
        return new Promise((resolve) => {
            resolve(findGamepadHolders())
        })
    }

    // Asks a holder app to quit. Only called after explicit user confirmation.
    quitHolder(args:QuitHolderArgs){
        return new Promise((resolve, reject) => {
            const result = quitHolder(Number(args.pid))
            if(result.ok){
                resolve(true)
            } else {
                reject(result.error)
            }
        })
    }

    getReconnectSupport(){
        return new Promise((resolve) => {
            resolve(isReconnectSupported())
        })
    }

    // Software unplug/replug of connected USB controllers (macOS)
    reconnect(){
        return reconnectGamepads()
    }
}
