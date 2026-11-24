import IpcBase from './base'
import { getNetworkInterfaces } from '../helpers/network'

export default class IpcNetwork extends IpcBase {

    // Returns detected interfaces plus whether WebRTC local IP obfuscation (mDNS)
    // was disabled at startup. Interface selection requires real host candidates.
    getStatus(){
        return new Promise((resolve) => {
            resolve({
                interfaces: getNetworkInterfaces(),
                mdnsDisabled: this._application._webrtcMdnsDisabled === true,
                platform: process.platform,
            })
        })
    }
}
