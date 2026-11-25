import os from 'os'
import { execFileSync } from 'child_process'

export type InterfaceType = 'wifi' | 'lan' | 'vpn' | 'other'

export interface NetworkInterfaceInfo {
    name: string;
    label: string;
    type: InterfaceType;
    addresses: { address: string; family: 'IPv4' | 'IPv6'; internal: boolean }[];
}

const VPN_NAME = /(^utun|^ipsec|^ppp|^tun|^tap|^wg|^tailscale|^zt|vpn|wireguard|openvpn|nordlynx|zerotier|forti|cisco|anyconnect|globalprotect|pangp)/i

// macOS: map device (en0) -> hardware port name ("Wi-Fi", "Ethernet Adapter (en4)")
function macHardwarePorts(): Record<string, string> {
    const ports: Record<string, string> = {}
    try {
        const out = execFileSync('/usr/sbin/networksetup', ['-listallhardwareports'], { timeout: 3000, encoding: 'utf8' })
        let port = ''
        for (const line of out.split('\n')) {
            const p = line.match(/^Hardware Port: (.+)$/)
            if (p) port = p[1].trim()
            const d = line.match(/^Device: (.+)$/)
            if (d && port) ports[d[1].trim()] = port
        }
    } catch (e) {
        // networksetup unavailable: fall back to name heuristics
    }
    return ports
}

function classify(name: string, label: string): InterfaceType {
    if (VPN_NAME.test(name) || VPN_NAME.test(label)) return 'vpn'

    if (/wi-?fi|wireless|wlan|airport|802\.11/i.test(label) || /^wl/i.test(name)) return 'wifi'

    if (/thunderbolt bridge|bluetooth|loopback/i.test(label)) return 'other'
    if (/^(lo|awdl|llw|anpi|bridge|gif|stf|ap\d|docker|veth|br-|virbr|vmnet|vboxnet)/i.test(name)) return 'other'

    if (/ethernet|lan|usb.*(10\/100|gigabit)|thunderbolt ethernet|^eth|^en[opsx]/i.test(label) || /^(eth|en[opsx])/i.test(name)) return 'lan'

    // macOS: enX that is not listed as Wi-Fi is wired (USB/Thunderbolt adapters)
    if (process.platform === 'darwin' && /^en\d+$/.test(name) && label !== name) return 'lan'

    return 'other'
}

let portsCache: { at: number; ports: Record<string, string> } | undefined

export function getNetworkInterfaces(): NetworkInterfaceInfo[] {
    if (process.platform === 'darwin' && (!portsCache || Date.now() - portsCache.at > 30000)) {
        portsCache = { at: Date.now(), ports: macHardwarePorts() }
    }
    const ports = portsCache ? portsCache.ports : {}
    const raw = os.networkInterfaces()
    const result: NetworkInterfaceInfo[] = []

    for (const name of Object.keys(raw)) {
        const addrs = (raw[name] || []).filter((a) => !a.internal)
        if (addrs.length === 0) continue

        const label = ports[name] || name
        result.push({
            name,
            label,
            type: classify(name, label),
            addresses: addrs.map((a) => ({
                address: a.address,
                family: (a.family === 'IPv6' || (a.family as any) === 6) ? 'IPv6' : 'IPv4',
                internal: a.internal,
            })),
        })
    }

    return result
}

// Local IPv4 address to bind outgoing requests to for the selected mode, or
// undefined for 'nat' / when the interface has no address.
export function getBindAddress(mode: string | undefined): string | undefined {
    if (mode !== 'wifi' && mode !== 'lan') return undefined
    for (const iface of getNetworkInterfaces()) {
        if (iface.type !== mode) continue
        // Skip self-assigned 169.254.x.x addresses (interface up but no DHCP lease)
        const v4 = iface.addresses.find((a) => a.family === 'IPv4' && !a.address.startsWith('169.254.'))
        if (v4) return v4.address
    }
    return undefined
}
