import IpcBase from './base'
import { getNetworkInterfaces } from '../helpers/network'
import * as vpn from '../helpers/vpnbypass'

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

    // --- VPN bypass (host routes through the physical gateway) ---

    _vpnState(){
        return new Promise(async (resolve) => {
            const targets = this._application._store.get('vpnbypass.targets', []) as string[]
            const gateway = vpn.isSupported() ? await vpn.findPhysicalGateway().catch(() => undefined) : undefined
            const routes = await Promise.all(targets.map((t) => vpn.routeStatus(t)))
            resolve({ supported: vpn.isSupported(), gateway: gateway || null, routes })
        })
    }

    getVpnBypass(){
        return this._vpnState()
    }

    addVpnBypass(data: { targets: string[] }){
        return new Promise(async (resolve, reject) => {
            try {
                if(!vpn.isSupported()) throw new Error('VPN bypass is only supported on macOS')
                const valid = (data.targets || []).map((t) => vpn.validateTarget(String(t)))
                if(valid.length === 0 || valid.some((t) => t === undefined)) throw new Error('Enter valid IPv4 addresses or CIDR ranges (e.g. 192.168.1.50 or 20.0.0.0/16)')

                const gateway = await vpn.findPhysicalGateway()
                if(!gateway) throw new Error('No physical gateway found. The Mac has no non-VPN default route to send this traffic through.')

                const targets = Array.from(new Set(valid as string[]))
                await vpn.addRoutes(targets, gateway)

                const existing = this._application._store.get('vpnbypass.targets', []) as string[]
                this._application._store.set('vpnbypass.targets', Array.from(new Set([...existing, ...targets])))
                resolve(await this._vpnState())
            } catch(error){
                reject(error)
            }
        })
    }

    removeVpnBypass(){
        return new Promise(async (resolve, reject) => {
            try {
                const targets = this._application._store.get('vpnbypass.targets', []) as string[]
                if(targets.length > 0) await vpn.removeRoutes(targets)
                this._application._store.set('vpnbypass.targets', [])
                resolve(await this._vpnState())
            } catch(error){
                reject(error)
            }
        })
    }
}
