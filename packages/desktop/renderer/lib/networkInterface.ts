// Restricts WebRTC (the stream transport) to a single network interface type.
//
// xbox-xcloud-player creates its own RTCPeerConnection and collects every ICE
// candidate it gathers, then sends them to the console. We wrap the
// RTCPeerConnection constructor so that, for 'wifi' / 'lan', only candidates whose
// local address belongs to the selected interface are exposed. With only those
// candidates the connection binds to that interface's address, so traffic leaves
// through Wi-Fi / Ethernet even when a VPN owns the default route.

export type NetworkMode = 'nat' | 'wifi' | 'lan'

export interface NetworkInterfaceInfo {
    name: string;
    label: string;
    type: 'wifi' | 'lan' | 'vpn' | 'other';
    addresses: { address: string; family: 'IPv4' | 'IPv6' }[];
}

function normalize(address: string): string {
    return address.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase()
}

// Extract the connection address from a candidate line:
// "candidate:<foundation> <component> <proto> <priority> <address> <port> typ <type> [raddr <addr> ...]"
export function parseCandidate(candidate: string): { address?: string; type?: string; relatedAddress?: string } {
    const parts = candidate.replace(/^a=/, '').trim().split(/\s+/)
    if (parts.length < 8) return {}
    const typIdx = parts.indexOf('typ')
    const raddrIdx = parts.indexOf('raddr')
    return {
        address: parts[4],
        type: typIdx >= 0 ? parts[typIdx + 1] : undefined,
        relatedAddress: raddrIdx >= 0 ? parts[raddrIdx + 1] : undefined,
    }
}

export function isCandidateAllowed(candidate: string, allowed: Set<string>): boolean {
    if (!candidate) return true // end-of-candidates marker
    const { address, type, relatedAddress } = parseCandidate(candidate)
    if (!address) return false

    // mDNS-obfuscated host candidates cannot be attributed to an interface
    if (address.endsWith('.local')) return false

    if (type === 'host') return allowed.has(normalize(address))

    // Server reflexive / relay / peer reflexive: keep only if the base (local)
    // address is on the selected interface.
    if (relatedAddress && relatedAddress !== '0.0.0.0' && relatedAddress !== '::') {
        return allowed.has(normalize(relatedAddress))
    }
    return false
}

export function allowedAddresses(interfaces: NetworkInterfaceInfo[], mode: NetworkMode): Set<string> {
    const set = new Set<string>()
    for (const iface of interfaces) {
        if (iface.type !== mode) continue
        for (const a of iface.addresses) set.add(normalize(a.address))
    }
    return set
}

// Returns a restore function. When mode is 'nat' nothing is patched.
export function installNetworkFilter(mode: NetworkMode, allowed: Set<string>): () => void {
    if (mode === 'nat' || typeof window === 'undefined' || !window.RTCPeerConnection) {
        return () => undefined
    }

    const Original = window.RTCPeerConnection
    console.log('[network] Restricting WebRTC to', mode, 'addresses:', Array.from(allowed))

    class FilteredPeerConnection extends Original {
        constructor(config?: RTCConfiguration) {
            super(config)

            // Filter candidates before any listener (player) sees them
            const origAdd = this.addEventListener.bind(this)
            this.addEventListener = ((type: string, listener: any, options?: any) => {
                if (type === 'icecandidate' && typeof listener === 'function') {
                    const wrapped = (event: RTCPeerConnectionIceEvent) => {
                        if (event.candidate && !isCandidateAllowed(event.candidate.candidate, allowed)) {
                            console.log('[network] Dropped ICE candidate (not on ' + mode + '):', event.candidate.candidate)
                            return
                        }
                        listener.call(this, event)
                    }
                    return origAdd(type, wrapped, options)
                }
                return origAdd(type, listener, options)
            }) as any
        }
    }

    window.RTCPeerConnection = FilteredPeerConnection as any

    return () => {
        if (window.RTCPeerConnection === (FilteredPeerConnection as any)) {
            window.RTCPeerConnection = Original
        }
    }
}

export interface SelectedRoute {
    localAddress?: string;
    localType?: string;
    remoteAddress?: string;
    remoteType?: string;
    protocol?: string;
    onSelectedInterface?: boolean;
}

// Reads the ICE candidate pair WebRTC actually selected for the stream.
export async function getSelectedRoute(pc: RTCPeerConnection, allowed?: Set<string>): Promise<SelectedRoute | undefined> {
    if (!pc || typeof pc.getStats !== 'function') return undefined
    const stats = await pc.getStats()
    let pairId: string | undefined

    stats.forEach((report: any) => {
        if (report.type === 'transport' && report.selectedCandidatePairId) pairId = report.selectedCandidatePairId
    })
    if (!pairId) {
        stats.forEach((report: any) => {
            if (report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded') pairId = report.id
        })
    }
    if (!pairId) return undefined

    const pair: any = stats.get(pairId)
    const local: any = pair && stats.get(pair.localCandidateId)
    const remote: any = pair && stats.get(pair.remoteCandidateId)
    if (!local) return undefined

    const localAddress = local.address || local.ip
    // For srflx/relay the base address is the interface address
    const base = local.candidateType === 'host' ? localAddress : (local.relatedAddress || localAddress)

    return {
        localAddress,
        localType: local.candidateType,
        remoteAddress: remote ? (remote.address || remote.ip) : undefined,
        remoteType: remote ? remote.candidateType : undefined,
        protocol: local.protocol,
        onSelectedInterface: allowed ? (base ? allowed.has(normalize(base)) : false) : undefined,
    }
}
