// Derives a connection quality sample from two consecutive RTCPeerConnection.getStats() snapshots.

export interface QualitySample {
    rtt?: number;          // ms, from the selected candidate pair
    jitter?: number;       // ms, inbound video
    lossPercent: number;   // % of packets lost since the previous sample
    bitrateKbps: number;   // inbound video bitrate
    fps?: number;
    framesDropped: number; // since the previous sample
    resolution?: string;
    path?: string;         // e.g. "udp host -> srflx"
}

interface RawCounters {
    at: number;
    bytes: number;
    packetsReceived: number;
    packetsLost: number;
    framesDropped: number;
}

export function computeQuality(stats: RTCStatsReport, previous?: RawCounters): { sample?: QualitySample; raw?: RawCounters } {
    let video: any
    let pair: any
    let transportPairId: string | undefined

    stats.forEach((report: any) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') video = report
        if (report.type === 'transport' && report.selectedCandidatePairId) transportPairId = report.selectedCandidatePairId
    })
    if (transportPairId) pair = stats.get(transportPairId)
    if (!pair) {
        stats.forEach((report: any) => {
            if (report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded') pair = report
        })
    }
    if (!video) return {}

    const now = performance.now()
    const raw: RawCounters = {
        at: now,
        bytes: video.bytesReceived || 0,
        packetsReceived: video.packetsReceived || 0,
        packetsLost: video.packetsLost || 0,
        framesDropped: video.framesDropped || 0,
    }

    let bitrateKbps = 0
    let lossPercent = 0
    let framesDropped = 0
    if (previous && now > previous.at) {
        const seconds = (now - previous.at) / 1000
        bitrateKbps = Math.max(0, ((raw.bytes - previous.bytes) * 8) / 1000 / seconds)
        const received = Math.max(0, raw.packetsReceived - previous.packetsReceived)
        const lost = Math.max(0, raw.packetsLost - previous.packetsLost)
        lossPercent = received + lost > 0 ? (lost / (received + lost)) * 100 : 0
        framesDropped = Math.max(0, raw.framesDropped - previous.framesDropped)
    }

    let path: string | undefined
    if (pair) {
        const local: any = stats.get(pair.localCandidateId)
        const remote: any = stats.get(pair.remoteCandidateId)
        if (local && remote) path = `${local.protocol || '?'} ${local.candidateType} -> ${remote.candidateType}`
    }

    return {
        raw,
        sample: {
            rtt: pair && typeof pair.currentRoundTripTime === 'number' ? pair.currentRoundTripTime * 1000 : undefined,
            jitter: typeof video.jitter === 'number' ? video.jitter * 1000 : undefined,
            lossPercent,
            bitrateKbps,
            fps: typeof video.framesPerSecond === 'number' ? video.framesPerSecond : undefined,
            framesDropped,
            resolution: video.frameWidth && video.frameHeight ? `${video.frameWidth}x${video.frameHeight}` : undefined,
            path,
        },
    }
}

export type QualityLevel = 'good' | 'fair' | 'poor'

export function qualityLevel(sample?: QualitySample): QualityLevel {
    if (!sample) return 'good'
    const rtt = sample.rtt ?? 0
    const jitter = sample.jitter ?? 0
    if (rtt > 120 || sample.lossPercent > 3 || jitter > 30) return 'poor'
    if (rtt > 60 || sample.lossPercent > 1 || jitter > 15) return 'fair'
    return 'good'
}
