// Video codec selection for the stream.
//
// The server (xCloud or the console) picks a codec from the list we offer, in our order of
// preference. We always keep H.264 in the list as a fallback, so choosing H.265/AV1 can never
// stop a stream from starting: if the server doesn't support the preferred codec, it simply
// uses H.264 like before.

export type VideoCodecChoice = 'auto' | 'h265' | 'av1' | 'h264'

const MIME: Record<Exclude<VideoCodecChoice, 'auto'>, string> = {
    h265: 'video/H265',
    av1: 'video/AV1',
    h264: 'video/H264',
}

// Codecs that are part of the RTP machinery rather than picture codecs; keep them available
const HELPERS = ['video/rtx', 'video/red', 'video/ulpfec', 'video/flexfec-03']

function capabilities(): RTCRtpCodec[] {
    if (typeof RTCRtpReceiver === 'undefined' || !RTCRtpReceiver.getCapabilities) return []
    return RTCRtpReceiver.getCapabilities('video')?.codecs || []
}

// Codecs this device can receive, for the settings page
export function supportedCodecs(): Record<VideoCodecChoice, boolean> {
    const mimes = new Set(capabilities().map((codec) => codec.mimeType))
    return {
        auto: true,
        h265: mimes.has(MIME.h265),
        av1: mimes.has(MIME.av1),
        h264: mimes.has(MIME.h264),
    }
}

// H.264 profile order: user choice first (e.g. '4d' high), then high > main > baseline
function h264Order(codecs: RTCRtpCodec[], profiles: string[]): RTCRtpCodec[] {
    const order = [...profiles, '4d', '42e', '420']
    const rank = (codec: RTCRtpCodec) => {
        const fmtp = codec.sdpFmtpLine || ''
        const i = order.findIndex((p) => fmtp.includes('profile-level-id=' + p))
        return i === -1 ? order.length : i
    }
    return codecs.filter((codec) => codec.mimeType === MIME.h264).sort((a, b) => rank(a) - rank(b))
}

export function buildCodecPreferences(choice: VideoCodecChoice, h264Profiles: string[] = []): RTCRtpCodec[] {
    const all = capabilities()
    const of = (mime: string) => all.filter((codec) => codec.mimeType === mime)
    const h264 = h264Order(all, h264Profiles)

    let picture: RTCRtpCodec[]
    switch (choice) {
        case 'h265':
            picture = [...of(MIME.h265), ...h264]
            break
        case 'av1':
            // AV1 first, then H.264. H.265 is left out on purpose: it is experimental, so it is
            // only used when the user picks it explicitly.
            picture = [...of(MIME.av1), ...h264]
            break
        case 'h264':
            picture = h264
            break
        default:
            // 'auto': the original behaviour. Leave codec negotiation to the browser and server.
            return []
    }
    return [...picture, ...all.filter((codec) => HELPERS.includes(codec.mimeType))]
}

// Apply our codec order to the player's video transceiver before the offer is created.
// Returns false if the browser doesn't support codec preferences (stream still works, as 'auto').
export function applyCodecPreferences(peerConnection: RTCPeerConnection, choice: VideoCodecChoice, h264Profiles: string[] = []): boolean {
    const preferences = buildCodecPreferences(choice, h264Profiles)
    if (preferences.length === 0) return false
    const transceiver = peerConnection.getTransceivers().find((t) => t.receiver.track?.kind === 'video')
    if (!transceiver || typeof transceiver.setCodecPreferences !== 'function') return false
    try {
        transceiver.setCodecPreferences(preferences)
        console.log('[codec] Offering codecs in order:', [...new Set(preferences.map((codec) => codec.mimeType))].join(', '))
        return true
    } catch (error) {
        console.warn('[codec] Unable to set codec preferences:', error)
        return false
    }
}

// Decoded frame count for the inbound video, to detect a stream that negotiated but shows nothing
export async function getFramesDecoded(peerConnection: RTCPeerConnection): Promise<number> {
    const stats = await peerConnection.getStats()
    let frames = 0
    stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') frames = report.framesDecoded || 0
    })
    return frames
}

// The codec the server actually chose, read from the inbound video stats
export async function getActiveCodec(peerConnection: RTCPeerConnection): Promise<string | undefined> {
    const stats = await peerConnection.getStats()
    let codecId: string | undefined
    stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') codecId = report.codecId
    })
    if (!codecId) return undefined
    const codec = stats.get(codecId)
    return codec?.mimeType?.replace('video/', '')
}
