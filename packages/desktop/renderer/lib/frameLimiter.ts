// Frame rate limiting for the stream video.
//
// xCloud has no documented "frame rate" field, so we do two things:
// 1. addFramerateToSdp(): adds an `a=framerate:` hint to the video section of the
//    WebRTC offer. The server may or may not honour it (check framesPerSecond in the
//    stream stats overlay).
// 2. FrameLimiter: draws the <video> onto a canvas no more than N times per second and
//    hides the original video. This always caps what is displayed, whatever the server sends.

export type VideoSize = 'default' | 'stretch' | 'zoom'

export function addFramerateToSdp(sdp: string, fps: number): string {
    if (!fps || fps <= 0) return sdp

    const eol = sdp.includes('\r\n') ? '\r\n' : '\n'
    const lines = sdp.split(eol)
    const start = lines.findIndex((line) => line.startsWith('m=video'))
    if (start === -1) return sdp

    let end = lines.findIndex((line, i) => i > start && line.startsWith('m='))
    if (end === -1) end = lines.length

    // Replace an existing hint in the video section, or add one before the first attribute
    const existing = lines.findIndex((line, i) => i > start && i < end && line.startsWith('a=framerate:'))
    if (existing !== -1) {
        lines[existing] = 'a=framerate:' + fps
    } else {
        let insertAt = lines.findIndex((line, i) => i > start && i < end && line.startsWith('a='))
        if (insertAt === -1) insertAt = end
        lines.splice(insertAt, 0, 'a=framerate:' + fps)
    }
    return lines.join(eol)
}

export class FrameLimiter {
    private _video: HTMLVideoElement
    private _canvas: HTMLCanvasElement
    private _ctx: CanvasRenderingContext2D
    private _interval: number
    private _size: VideoSize
    private _lastDraw = 0
    private _callbackId: number | undefined
    private _resizeObserver: ResizeObserver
    private _stopped = false

    constructor(video: HTMLVideoElement, fps: number, size: VideoSize = 'default') {
        this._video = video
        this._interval = 1000 / fps
        this._size = size

        this._canvas = document.createElement('canvas')
        this._canvas.className = 'framelimiter-canvas'
        // Input listeners live on the <video>, so let pointer events pass through the canvas
        this._canvas.style.pointerEvents = 'none'
        this._ctx = this._canvas.getContext('2d', { alpha: false })

        video.parentElement?.appendChild(this._canvas)
        // Keep the video in layout (it receives input) but don't show it
        video.style.opacity = '0'

        this._resizeObserver = new ResizeObserver(() => this._resize())
        this._resizeObserver.observe(video)
        this._resize()

        this._callbackId = video.requestVideoFrameCallback(this._onFrame)
    }

    private _resize() {
        const dpr = window.devicePixelRatio || 1
        this._canvas.width = Math.max(1, Math.round(this._video.clientWidth * dpr))
        this._canvas.height = Math.max(1, Math.round(this._video.clientHeight * dpr))
        // Resizing clears the canvas, so allow an immediate redraw
        this._lastDraw = 0
    }

    private _onFrame = (now: DOMHighResTimeStamp) => {
        if (this._stopped) return
        this._callbackId = this._video.requestVideoFrameCallback(this._onFrame)

        // Small tolerance so a 60 fps source capped at 30 reliably shows every 2nd frame
        if (now - this._lastDraw < this._interval - 2) return
        this._lastDraw = now
        this._draw()
    }

    private _draw() {
        const vw = this._video.videoWidth
        const vh = this._video.videoHeight
        if (!vw || !vh) return

        const cw = this._canvas.width
        const ch = this._canvas.height
        let dw = cw
        let dh = ch

        // Mirror the CSS object-fit used by the size_* classes
        if (this._size !== 'stretch') {
            const scale = (this._size === 'zoom') ? Math.max(cw / vw, ch / vh) : Math.min(cw / vw, ch / vh)
            dw = vw * scale
            dh = vh * scale
        }

        this._ctx.fillStyle = '#000'
        this._ctx.fillRect(0, 0, cw, ch)
        this._ctx.drawImage(this._video, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
    }

    setVisible(visible: boolean) {
        this._canvas.style.visibility = visible ? 'visible' : 'hidden'
    }

    stop() {
        this._stopped = true
        if (this._callbackId !== undefined) {
            this._video.cancelVideoFrameCallback(this._callbackId)
        }
        this._resizeObserver.disconnect()
        this._canvas.remove()
        this._video.style.opacity = ''
    }
}
