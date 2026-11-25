import { execFile } from 'child_process'

// Adds host/subnet routes that send chosen destinations out of the physical
// interface instead of the VPN tunnel (macOS only). Needs admin rights, which are
// requested through the standard macOS password prompt.

export interface PhysicalGateway {
    gateway: string;
    iface: string;
}

export interface RouteStatus {
    target: string;
    iface?: string;
    viaVpn?: boolean;
}

const VPN_IFACE = /^(utun|ipsec|ppp|tun|tap|wg)/i
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

function run(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: 60000 }, (error, stdout, stderr) => {
            if (error) reject(new Error((stderr || error.message).toString().trim()))
            else resolve(stdout.toString())
        })
    })
}

// Accepts "a.b.c.d" or "a.b.c.d/nn". Returns the normalised target or undefined.
export function validateTarget(raw: string): string | undefined {
    const value = raw.trim()
    const [ip, bits, extra] = value.split('/')
    if (extra !== undefined || !IPV4.test(ip)) return undefined
    if (bits === undefined) return ip
    const n = Number(bits)
    if (!/^\d{1,2}$/.test(bits) || n < 8 || n > 32) return undefined // refuse huge ranges like /0
    return n === 32 ? ip : `${ip}/${n}`
}

export function isSupported(): boolean {
    return process.platform === 'darwin'
}

// Finds the non-VPN default route (the one the VPN displaced or sits on top of).
export async function findPhysicalGateway(): Promise<PhysicalGateway | undefined> {
    const out = await run('/usr/sbin/netstat', ['-rn', '-f', 'inet'])
    for (const line of out.split('\n')) {
        const cols = line.trim().split(/\s+/)
        // default  192.168.1.1  UGScg  en4
        if (cols[0] !== 'default' || cols.length < 4) continue
        const gateway = cols[1]
        const iface = cols[cols.length - 1]
        if (!IPV4.test(gateway)) continue // link#N / scoped entries have no usable gateway
        if (VPN_IFACE.test(iface)) continue
        return { gateway, iface }
    }
    return undefined
}

// Which interface does the OS currently use to reach this destination?
export async function routeStatus(target: string): Promise<RouteStatus> {
    const ip = target.split('/')[0]
    try {
        const out = await run('/sbin/route', ['-n', 'get', ip])
        const m = out.match(/interface:\s*(\S+)/)
        const iface = m ? m[1] : undefined
        return { target, iface, viaVpn: iface ? VPN_IFACE.test(iface) : undefined }
    } catch (e) {
        return { target }
    }
}

// Runs a shell command line as admin via the macOS auth dialog.
function runAsAdmin(commands: string[]): Promise<void> {
    // Every command is built from validated IPv4/CIDR strings, so no user text reaches the shell.
    const script = `do shell script "${commands.join('; ')}" with administrator privileges`
    return run('/usr/bin/osascript', ['-e', script]).then(() => undefined).catch((error) => {
        if (/User canceled|-128/.test(error.message)) throw new Error('Admin permission was cancelled')
        throw error
    })
}

function routeCmd(action: 'add' | 'delete', target: string, gateway?: string): string {
    const isNet = target.includes('/')
    const base = `/sbin/route -n ${action} ${isNet ? '-net' : '-host'} ${target}`
    return gateway ? `${base} ${gateway}` : base
}

export async function addRoutes(targets: string[], gateway: PhysicalGateway): Promise<void> {
    await runAsAdmin(targets.map((t) => routeCmd('add', t, gateway.gateway)))
}

export async function removeRoutes(targets: string[]): Promise<void> {
    // "|| true" keeps going if a route is already gone
    await runAsAdmin(targets.map((t) => routeCmd('delete', t) + ' || true'))
}
