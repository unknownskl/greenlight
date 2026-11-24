// Motion smoothing (frame interpolation) for the stream video.
//
// When the stream delivers ~30 fps (e.g. a game capped at 30), we generate in-between
// frames on the GPU so the display runs at the screen refresh rate (60/120 Hz):
//
//   1. Each new video frame is uploaded to a texture and downscaled to luma (1/4 and 1/8 size).
//   2. Block matching estimates motion between the previous and the current frame
//      (coarse search at 1/8, refinement + sub-pixel fit at 1/4, then a 3x3 vector median).
//   3. Every display refresh we draw the previous frame warped forward and the current
//      frame warped backward along the motion vectors, blended by the time phase.
//      Static pixels (HUD), occlusions and unreliable matches fall back to safe blends.
//
// To interpolate between frame N-1 and N we must already have frame N, so this adds
// one source frame of latency (~33 ms at 30 fps). The stream is only interpolated while
// the source frame rate is low; above ~50 fps frames are passed through with no delay.
//
// Shortcuts while streaming: Ctrl+Shift+S toggles smoothing, Ctrl+Shift+I pins the info badge.

import { VideoSize } from './frameLimiter'

type Slot = {
    frame: WebGLTexture
    lumaQ: WebGLTexture
    lumaE: WebGLTexture
    fbLumaQ: WebGLFramebuffer
    fbLumaE: WebGLFramebuffer
}

type Target = { tex: WebGLTexture, fb: WebGLFramebuffer }

const VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main(){
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}`

// Box-filtered luma downsample. u_factor = source pixels per output pixel (4 or 2).
const FS_LUMA = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_srcSize;
uniform float u_factor;
out vec4 o;
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(){
    vec2 center = gl_FragCoord.xy * u_factor;          // in source pixels
    vec2 d = vec2(u_factor * 0.25) ;                   // 4 bilinear taps cover the block
    vec2 s = 1.0 / u_srcSize;
    vec3 c = texture(u_src, (center + vec2(-d.x, -d.y)) * s).rgb
           + texture(u_src, (center + vec2( d.x, -d.y)) * s).rgb
           + texture(u_src, (center + vec2(-d.x,  d.y)) * s).rgb
           + texture(u_src, (center + vec2( d.x,  d.y)) * s).rgb;
    o = vec4(luma(c * 0.25), 0.0, 0.0, 1.0);
}`

const SAD_COMMON = `
uniform highp sampler2D u_cur;
uniform highp sampler2D u_prev;
uniform ivec2 u_size;
float px(highp sampler2D s, ivec2 p){ return texelFetch(s, clamp(p, ivec2(0), u_size - 1), 0).r; }
float sad(ivec2 base, ivec2 d){
    float s = 0.0;
    for(int y = 0; y < 4; y++){
        for(int x = 0; x < 4; x++){
            ivec2 p = base + ivec2(x, y);
            s += abs(px(u_cur, p) - px(u_prev, p - d));
        }
    }
    return s;
}`

// Coarse full search on 1/8 luma, 4x4 blocks (= 32x32 source px), +-6 px (= +-48 source px).
// Output: xy = motion (prev -> cur) in source pixels, z = SAD, w = zero-motion SAD.
const FS_ME_COARSE = `#version 300 es
precision highp float;
precision highp int;
${SAD_COMMON}
out vec4 o;
void main(){
    ivec2 base = ivec2(gl_FragCoord.xy) * 4;
    float zero = sad(base, ivec2(0));
    float best = zero;
    ivec2 bd = ivec2(0);
    for(int dy = -6; dy <= 6; dy++){
        for(int dx = -6; dx <= 6; dx++){
            ivec2 d = ivec2(dx, dy);
            float c = sad(base, d) + 0.02 * length(vec2(d));
            if(c < best){ best = c; bd = d; }
        }
    }
    o = vec4(vec2(bd) * 8.0, best, zero);
}`

// Refinement on 1/4 luma, 4x4 blocks (= 16x16 source px), seeded by the 3x3 coarse
// neighbourhood, then +-2 local search and a parabolic sub-pixel fit.
const FS_ME_FINE = `#version 300 es
precision highp float;
precision highp int;
${SAD_COMMON}
uniform highp sampler2D u_coarse;
uniform ivec2 u_coarseSize;
out vec4 o;
void main(){
    ivec2 cell = ivec2(gl_FragCoord.xy);
    ivec2 base = cell * 4;
    ivec2 cc = cell / 2;

    float zero = sad(base, ivec2(0));
    float best = zero;
    ivec2 bd = ivec2(0);
    for(int j = -1; j <= 1; j++){
        for(int i = -1; i <= 1; i++){
            vec2 v = texelFetch(u_coarse, clamp(cc + ivec2(i, j), ivec2(0), u_coarseSize - 1), 0).xy;
            ivec2 d = ivec2(round(v / 4.0));
            float c = sad(base, d) + 0.01 * length(vec2(d));
            if(c < best){ best = c; bd = d; }
        }
    }
    ivec2 c0 = bd;
    for(int dy = -2; dy <= 2; dy++){
        for(int dx = -2; dx <= 2; dx++){
            ivec2 d = c0 + ivec2(dx, dy);
            float c = sad(base, d) + 0.01 * length(vec2(d));
            if(c < best){ best = c; bd = d; }
        }
    }

    // Sub-pixel refinement (parabola through the neighbouring costs)
    vec2 sub = vec2(0.0);
    if(bd != ivec2(0)){
        float cm = sad(base, bd);
        float xl = sad(base, bd - ivec2(1, 0));
        float xr = sad(base, bd + ivec2(1, 0));
        float yl = sad(base, bd - ivec2(0, 1));
        float yr = sad(base, bd + ivec2(0, 1));
        float dxn = xl - 2.0 * cm + xr;
        float dyn = yl - 2.0 * cm + yr;
        if(dxn > 1e-4) sub.x = clamp((xl - xr) / (2.0 * dxn), -0.5, 0.5);
        if(dyn > 1e-4) sub.y = clamp((yl - yr) / (2.0 * dyn), -0.5, 0.5);
    }
    o = vec4((vec2(bd) + sub) * 4.0, best, zero);
}`

// 3x3 vector median: removes outlier vectors while keeping motion edges.
const FS_MEDIAN = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D u_field;
uniform ivec2 u_fieldSize;
out vec4 o;
void main(){
    ivec2 c = ivec2(gl_FragCoord.xy);
    vec2 v[9];
    int k = 0;
    for(int j = -1; j <= 1; j++){
        for(int i = -1; i <= 1; i++){
            v[k] = texelFetch(u_field, clamp(c + ivec2(i, j), ivec2(0), u_fieldSize - 1), 0).xy;
            k++;
        }
    }
    float bestSum = 1e20;
    vec2 best = v[4];
    for(int a = 0; a < 9; a++){
        float s = 0.0;
        for(int b = 0; b < 9; b++){ s += length(v[a] - v[b]); }
        if(s < bestSum){ bestSum = s; best = v[a]; }
    }
    vec4 center = texelFetch(u_field, c, 0);
    o = vec4(best, center.z, center.w);
}`

// Per-pixel vector selection at quarter resolution, for the current time phase t.
// The block field stores motion at each block's position in the *current* frame, which is
// wrong for pixels a moving object is passing over at time t. So every pixel tests the
// 3x3 neighbouring block vectors (plus zero) and keeps the one where the previous frame
// warped forward and the current frame warped backward agree best.
const FS_SELECT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_prevL;
uniform sampler2D u_curL;
uniform highp sampler2D u_field;
uniform ivec2 u_fieldSize;
uniform vec2 u_lsize;       // quarter luma size in px
uniform vec2 u_size;        // source frame size in px
uniform float u_t;
out vec4 o;
float cost(vec2 uv, vec2 mv){
    vec2 a = uv - u_t * mv;
    vec2 b = uv + (1.0 - u_t) * mv;
    vec2 px = 1.0 / u_lsize;
    float c = 0.0;
    for(int y = -1; y <= 1; y++){
        for(int x = -1; x <= 1; x++){
            vec2 d = vec2(x, y) * px;
            c += abs(texture(u_prevL, a + d).r - texture(u_curL, b + d).r);
        }
    }
    return c / 9.0;
}
void main(){
    vec2 uv = gl_FragCoord.xy / u_lsize;
    ivec2 cell = ivec2(uv * u_size / 16.0);
    vec2 best = vec2(0.0);
    float bestCost = cost(uv, vec2(0.0));
    for(int j = -1; j <= 1; j++){
        for(int i = -1; i <= 1; i++){
            vec2 v = texelFetch(u_field, clamp(cell + ivec2(i, j), ivec2(0), u_fieldSize - 1), 0).xy / u_size;
            float c = cost(uv, v) + 0.002;
            if(c < bestCost){ bestCost = c; best = v; }
        }
    }
    o = vec4(best, bestCost, 1.0);
}`

// Final composite at display rate.
const FS_COMPOSE = `#version 300 es
precision highp float;
uniform sampler2D u_prevF;
uniform sampler2D u_curF;
uniform sampler2D u_sel;     // per-pixel motion (uv units) + match cost
uniform float u_t;          // 0 = previous frame, 1 = current frame
uniform int u_mode;         // 0 = interpolate, 1 = current frame only
in vec2 v_uv;
out vec4 o;
void main(){
    vec2 uv = v_uv;
    vec3 s1 = texture(u_curF, uv).rgb;
    if(u_mode == 1){ o = vec4(s1, 1.0); return; }

    vec3 s0 = texture(u_prevF, uv).rgb;
    vec4 f = texture(u_sel, uv);
    vec2 mv = f.xy;
    float err = f.z;            // mean abs luma difference along the chosen vector

    vec3 a = texture(u_prevF, uv - u_t * mv).rgb;
    vec3 b = texture(u_curF, uv + (1.0 - u_t) * mv).rgb;
    vec3 col = mix(a, b, u_t);

    // Occlusion: the two warped samples disagree -> trust the temporally nearer one
    vec3 nearWarp = (u_t < 0.5) ? a : b;
    col = mix(col, nearWarp, smoothstep(0.10, 0.25, length(a - b)));

    // Unreliable motion -> nearest real frame (judder instead of ghosting)
    vec3 nearReal = (u_t < 0.5) ? s0 : s1;
    col = mix(col, nearReal, smoothstep(0.06, 0.12, err));

    // Pixels that did not change (HUD, still background) need no motion compensation
    col = mix(mix(s0, s1, u_t), col, smoothstep(0.02, 0.06, length(s0 - s1)));

    o = vec4(col, 1.0);
}`

// Duplicate detection: average |luma difference| over a 16x9 grid of the 1/8 luma images.
// Rendered to a 1x1 target and read back, so we can tell repeated frames from new ones.
const FS_DIFF = `#version 300 es
precision highp float;
uniform sampler2D u_a;
uniform sampler2D u_b;
out vec4 o;
void main(){
    float s = 0.0;
    float m = 0.0;
    for(int y = 0; y < 18; y++){
        for(int x = 0; x < 32; x++){
            vec2 uv = (vec2(x, y) + 0.5) / vec2(32.0, 18.0);
            float d = abs(texture(u_a, uv).r - texture(u_b, uv).r);
            s += d;
            m = max(m, d);
        }
    }
    o = vec4(s / 576.0, m, 0.0, 1.0);
}`

export type SmootherState = 'interpolating' | 'standby' | 'off' | 'unavailable'

export class MotionSmoother {
    private _video: HTMLVideoElement
    private _size: VideoSize
    private _canvas: HTMLCanvasElement
    private _badge: HTMLDivElement
    private _gl: WebGL2RenderingContext | null = null

    private _progLuma: WebGLProgram
    private _progCoarse: WebGLProgram
    private _progFine: WebGLProgram
    private _progMedian: WebGLProgram
    private _progCompose: WebGLProgram
    private _progSelect: WebGLProgram
    private _progDiff: WebGLProgram
    private _diff: Target
    private _diffPixel = new Float32Array(4)
    private _diffHistory: number[] = []
    private _vao: WebGLVertexArrayObject
    private _uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation>>()

    private _slots: Slot[] = []
    private _coarse: Target
    private _fine: Target
    private _field: Target
    private _sel: Target
    private _w = 0
    private _h = 0
    private _wq = 0
    private _hq = 0
    private _we = 0
    private _he = 0
    private _gcW = 0
    private _gcH = 0
    private _gfW = 0
    private _gfH = 0

    // Indexes into _slots: real previous / current frame, and the slot for incoming frames
    private _prevIdx = 0
    private _curIdx = 1
    private _inIdx = 2
    private _uniqueTimes: number[] = []
    private _duplicates = 0
    private _frameCount = 0
    private _haveField = false

    private _enabled = true
    private _interpolating = false
    private _intervalMs = 1000 / 60
    private _lastArrival = 0
    private _lastDrawnT = -1
    private _newFrame = false

    private _arrivals = 0
    private _uniqueFrames = 0
    private _gameFps = 0
    private _draws = 0
    private _srcFps = 0
    private _outFps = 0
    private _statsTimer: number | undefined

    private _videoCallbackId: number | undefined
    private _rafId: number | undefined
    private _resizeObserver: ResizeObserver | undefined
    private _badgePinned = false
    private _badgeTimer: number | undefined
    private _stopped = false
    private _lastState: SmootherState | undefined

    constructor(video: HTMLVideoElement, size: VideoSize = 'default') {
        this._video = video
        this._size = size

        this._badge = document.createElement('div')
        this._badge.className = 'motionsmoother-badge'
        video.parentElement?.appendChild(this._badge)

        this._canvas = document.createElement('canvas')
        this._canvas.className = 'framelimiter-canvas'
        this._canvas.style.pointerEvents = 'none'

        window.addEventListener('keydown', this._onKeyDown, true)

        if (!this._initGl()) {
            this._setState('unavailable')
            return
        }

        // The canvas is opaque and sits on top of the <video>. The video itself stays
        // visible underneath so the browser keeps decoding and delivering frames to it.
        video.parentElement?.insertBefore(this._canvas, this._badge)

        this._resizeObserver = new ResizeObserver(() => this._resizeCanvas())
        this._resizeObserver.observe(video)
        this._resizeCanvas()

        this._videoCallbackId = video.requestVideoFrameCallback(this._onVideoFrame)
        this._rafId = requestAnimationFrame(this._onAnimationFrame)
        this._statsTimer = window.setInterval(this._updateStats, 1000)
        this._setState('standby')
    }

    // --- Public API -------------------------------------------------------------------

    setEnabled(enabled: boolean) {
        this._enabled = enabled
        this._newFrame = true
        this._setState(this._computeState(), true)
    }

    isEnabled() {
        return this._enabled
    }

    stop() {
        this._stopped = true
        window.removeEventListener('keydown', this._onKeyDown, true)
        if (this._videoCallbackId !== undefined) this._video.cancelVideoFrameCallback(this._videoCallbackId)
        if (this._rafId !== undefined) cancelAnimationFrame(this._rafId)
        if (this._statsTimer !== undefined) clearInterval(this._statsTimer)
        if (this._badgeTimer !== undefined) clearTimeout(this._badgeTimer)
        this._resizeObserver?.disconnect()
        this._gl?.getExtension('WEBGL_lose_context')?.loseContext()
        this._canvas.remove()
        this._badge.remove()
    }

    // --- Setup ------------------------------------------------------------------------

    private _initGl(): boolean {
        const gl = this._canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            desynchronized: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
        }) as WebGL2RenderingContext | null
        if (!gl) {
            console.warn('[motion smoothing] WebGL2 is not available')
            return false
        }
        if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) {
            console.warn('[motion smoothing] Float render targets are not supported')
            return false
        }
        this._gl = gl

        try {
            this._progLuma = this._program(FS_LUMA)
            this._progCoarse = this._program(FS_ME_COARSE)
            this._progFine = this._program(FS_ME_FINE)
            this._progMedian = this._program(FS_MEDIAN)
            this._progCompose = this._program(FS_COMPOSE)
            this._progSelect = this._program(FS_SELECT)
            this._progDiff = this._program(FS_DIFF)
        } catch (error) {
            console.warn('[motion smoothing] Shader setup failed:', error)
            this._gl = null
            return false
        }

        // Single triangle covering the viewport
        this._vao = gl.createVertexArray()
        gl.bindVertexArray(this._vao)
        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        gl.bindVertexArray(null)

        gl.disable(gl.DEPTH_TEST)
        gl.disable(gl.BLEND)
        return true
    }

    private _program(fragmentSource: string): WebGLProgram {
        const gl = this._gl
        const compile = (type: number, source: string) => {
            const shader = gl.createShader(type)
            gl.shaderSource(shader, source)
            gl.compileShader(shader)
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                throw new Error(gl.getShaderInfoLog(shader) || 'shader compile error')
            }
            return shader
        }
        const program = gl.createProgram()
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VS))
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource))
        gl.bindAttribLocation(program, 0, 'a_pos')
        gl.linkProgram(program)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program) || 'program link error')
        }
        this._uniforms.set(program, new Map())
        return program
    }

    private _u(program: WebGLProgram, name: string): WebGLUniformLocation {
        const cache = this._uniforms.get(program)
        let location = cache.get(name)
        if (location === undefined) {
            location = this._gl.getUniformLocation(program, name)
            cache.set(name, location)
        }
        return location
    }

    private _texture(w: number, h: number, internalFormat: number, format: number, type: number, linear: boolean): WebGLTexture {
        const gl = this._gl
        const tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null)
        return tex
    }

    private _framebuffer(tex: WebGLTexture): WebGLFramebuffer {
        const gl = this._gl
        const fb = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        return fb
    }

    private _target(w: number, h: number, linear: boolean): Target {
        const gl = this._gl
        const tex = this._texture(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, linear)
        return { tex, fb: this._framebuffer(tex) }
    }

    private _deleteResources() {
        const gl = this._gl
        for (const slot of this._slots) {
            gl.deleteTexture(slot.frame)
            gl.deleteTexture(slot.lumaQ)
            gl.deleteTexture(slot.lumaE)
            gl.deleteFramebuffer(slot.fbLumaQ)
            gl.deleteFramebuffer(slot.fbLumaE)
        }
        this._slots = []
        for (const target of [this._coarse, this._fine, this._field, this._sel, this._diff]) {
            if (target) {
                gl.deleteTexture(target.tex)
                gl.deleteFramebuffer(target.fb)
            }
        }
    }

    // (Re)allocate GPU buffers whenever the stream resolution changes
    private _allocate(w: number, h: number) {
        const gl = this._gl
        this._deleteResources()

        this._w = w
        this._h = h
        this._wq = Math.ceil(w / 4)
        this._hq = Math.ceil(h / 4)
        this._we = Math.ceil(this._wq / 2)
        this._he = Math.ceil(this._hq / 2)
        this._gcW = Math.ceil(this._we / 4)
        this._gcH = Math.ceil(this._he / 4)
        this._gfW = Math.ceil(this._wq / 4)
        this._gfH = Math.ceil(this._hq / 4)

        // Slot 0/1 hold the previous and current *distinct* frames; slot 2 receives new frames
        for (let i = 0; i < 3; i++) {
            const frame = this._texture(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, true)
            const lumaQ = this._texture(this._wq, this._hq, gl.R8, gl.RED, gl.UNSIGNED_BYTE, true)
            const lumaE = this._texture(this._we, this._he, gl.R8, gl.RED, gl.UNSIGNED_BYTE, true)
            this._slots.push({
                frame,
                lumaQ,
                lumaE,
                fbLumaQ: this._framebuffer(lumaQ),
                fbLumaE: this._framebuffer(lumaE),
            })
        }
        this._coarse = this._target(this._gcW, this._gcH, false)
        this._fine = this._target(this._gfW, this._gfH, false)
        this._field = this._target(this._gfW, this._gfH, false)
        this._sel = this._target(this._wq, this._hq, false)
        this._diff = this._target(1, 1, false)

        this._frameCount = 0
        this._haveField = false
        console.log('[motion smoothing] Allocated buffers for', w + 'x' + h)
    }

    private _resizeCanvas() {
        const dpr = window.devicePixelRatio || 1
        this._canvas.width = Math.max(1, Math.round(this._video.clientWidth * dpr))
        this._canvas.height = Math.max(1, Math.round(this._video.clientHeight * dpr))
        this._newFrame = true
    }

    // --- Per source frame -------------------------------------------------------------

    private _onVideoFrame = (now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
        if (this._stopped) return
        this._videoCallbackId = this._video.requestVideoFrameCallback(this._onVideoFrame)

        const w = metadata.width || this._video.videoWidth
        const h = metadata.height || this._video.videoHeight
        if (!w || !h) return
        if (w !== this._w || h !== this._h) this._allocate(w, h)

        const gl = this._gl
        const incoming = this._slots[this._inIdx]
        gl.bindTexture(gl.TEXTURE_2D, incoming.frame)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, this._video)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        this._buildLuma(incoming)
        this._arrivals++

        // A game capped at 30 fps is usually streamed at 60 fps with every frame sent twice.
        // Skip repeats so we interpolate between frames the game actually rendered.
        if (this._frameCount > 0 && this._isDuplicate(incoming, this._slots[this._curIdx])) {
            this._duplicates++
            return
        }

        // Rotate: incoming becomes current, current becomes previous
        const oldPrev = this._prevIdx
        this._prevIdx = this._curIdx
        this._curIdx = this._inIdx
        this._inIdx = oldPrev
        this._frameCount++

        this._measureInterval(now)
        this._updateMode()
        if (this._enabled && this._interpolating && this._frameCount >= 2) {
            this._estimateMotion()
        } else {
            this._haveField = false
        }

        this._lastArrival = now
        this._lastDrawnT = -1
        this._newFrame = true
        this._uniqueFrames++
    }

    private _isDuplicate(a: Slot, b: Slot): boolean {
        const gl = this._gl
        const p = this._progDiff
        gl.useProgram(p)
        gl.bindVertexArray(this._vao)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._diff.fb)
        gl.viewport(0, 0, 1, 1)
        this._bindTex(p, 'u_a', 0, a.lumaE)
        this._bindTex(p, 'u_b', 1, b.lumaE)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, this._diffPixel)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        const diff = this._diffPixel[0]
        this._diffHistory.push(diff)
        if (this._diffHistory.length > 30) this._diffHistory.shift()

        // A 30-in-60 stream alternates "repeat" (compression noise only) and "new frame".
        // Compare with the typical difference of recent frames instead of a fixed threshold,
        // so slow pans in real 60 fps games aren't mistaken for repeats.
        const sorted = [...this._diffHistory].sort((x, y) => x - y)
        const high = sorted[Math.floor(sorted.length * 0.75)] || 0
        if (diff < 0.0008) return true                        // practically identical
        if (this._diffHistory.length < 8) return false        // not enough history yet
        return diff < high * 0.25
    }

    private _measureInterval(now: number) {
        // Source cadence = time between *distinct* frames, median of the last 15
        this._uniqueTimes.push(now)
        if (this._uniqueTimes.length > 16) this._uniqueTimes.shift()
        if (this._uniqueTimes.length < 4) return
        const deltas: number[] = []
        for (let i = 1; i < this._uniqueTimes.length; i++) {
            const d = this._uniqueTimes[i] - this._uniqueTimes[i - 1]
            if (d > 4 && d < 150) deltas.push(d)
        }
        if (deltas.length < 3) return
        deltas.sort((x, y) => x - y)
        this._intervalMs = deltas[Math.floor(deltas.length / 2)]
    }

    private _updateMode() {
        const fps = 1000 / this._intervalMs
        // Hysteresis: start interpolating below 40 fps, stop above 50 fps
        if (!this._interpolating && fps < 40) this._interpolating = true
        else if (this._interpolating && fps > 50) this._interpolating = false
        this._setState(this._computeState())
    }

    private _computeState(): SmootherState {
        if (!this._gl) return 'unavailable'
        if (!this._enabled) return 'off'
        return this._interpolating ? 'interpolating' : 'standby'
    }

    private _buildLuma(slot: Slot) {
        const gl = this._gl
        gl.bindVertexArray(this._vao)
        gl.useProgram(this._progLuma)
        gl.uniform1i(this._u(this._progLuma, 'u_src'), 0)
        gl.activeTexture(gl.TEXTURE0)

        gl.bindFramebuffer(gl.FRAMEBUFFER, slot.fbLumaQ)
        gl.viewport(0, 0, this._wq, this._hq)
        gl.bindTexture(gl.TEXTURE_2D, slot.frame)
        gl.uniform2f(this._u(this._progLuma, 'u_srcSize'), this._w, this._h)
        gl.uniform1f(this._u(this._progLuma, 'u_factor'), 4)
        gl.drawArrays(gl.TRIANGLES, 0, 3)

        gl.bindFramebuffer(gl.FRAMEBUFFER, slot.fbLumaE)
        gl.viewport(0, 0, this._we, this._he)
        gl.bindTexture(gl.TEXTURE_2D, slot.lumaQ)
        gl.uniform2f(this._u(this._progLuma, 'u_srcSize'), this._wq, this._hq)
        gl.uniform1f(this._u(this._progLuma, 'u_factor'), 2)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }

    private _estimateMotion() {
        const gl = this._gl
        const cur = this._slots[this._curIdx]
        const prev = this._slots[this._prevIdx]
        gl.bindVertexArray(this._vao)

        // Coarse search
        gl.useProgram(this._progCoarse)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._coarse.fb)
        gl.viewport(0, 0, this._gcW, this._gcH)
        this._bindTex(this._progCoarse, 'u_cur', 0, cur.lumaE)
        this._bindTex(this._progCoarse, 'u_prev', 1, prev.lumaE)
        gl.uniform2i(this._u(this._progCoarse, 'u_size'), this._we, this._he)
        gl.drawArrays(gl.TRIANGLES, 0, 3)

        // Refinement
        gl.useProgram(this._progFine)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._fine.fb)
        gl.viewport(0, 0, this._gfW, this._gfH)
        this._bindTex(this._progFine, 'u_cur', 0, cur.lumaQ)
        this._bindTex(this._progFine, 'u_prev', 1, prev.lumaQ)
        this._bindTex(this._progFine, 'u_coarse', 2, this._coarse.tex)
        gl.uniform2i(this._u(this._progFine, 'u_size'), this._wq, this._hq)
        gl.uniform2i(this._u(this._progFine, 'u_coarseSize'), this._gcW, this._gcH)
        gl.drawArrays(gl.TRIANGLES, 0, 3)

        // Vector median
        gl.useProgram(this._progMedian)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._field.fb)
        gl.viewport(0, 0, this._gfW, this._gfH)
        this._bindTex(this._progMedian, 'u_field', 0, this._fine.tex)
        gl.uniform2i(this._u(this._progMedian, 'u_fieldSize'), this._gfW, this._gfH)
        gl.drawArrays(gl.TRIANGLES, 0, 3)

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        this._haveField = true
    }

    private _bindTex(program: WebGLProgram, name: string, unit: number, tex: WebGLTexture) {
        const gl = this._gl
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.uniform1i(this._u(program, name), unit)
    }

    // --- Per display refresh ----------------------------------------------------------

    private _onAnimationFrame = (now: DOMHighResTimeStamp) => {
        if (this._stopped) return
        this._rafId = requestAnimationFrame(this._onAnimationFrame)
        if (this._frameCount === 0) return

        const interpolate = this._enabled && this._interpolating && this._haveField
        if (interpolate) {
            const t = Math.min(1, Math.max(0, (now - this._lastArrival) / this._intervalMs))
            if (t === this._lastDrawnT && !this._newFrame) return
            this._lastDrawnT = t
            this._newFrame = false
            this._compose(0, t)
        } else {
            if (!this._newFrame) return
            this._newFrame = false
            this._compose(1, 1)
        }
        this._draws++
    }

    private _select(t: number) {
        const gl = this._gl
        const p = this._progSelect
        gl.useProgram(p)
        gl.bindVertexArray(this._vao)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._sel.fb)
        gl.viewport(0, 0, this._wq, this._hq)
        this._bindTex(p, 'u_prevL', 0, this._slots[this._prevIdx].lumaQ)
        this._bindTex(p, 'u_curL', 1, this._slots[this._curIdx].lumaQ)
        this._bindTex(p, 'u_field', 2, this._field.tex)
        gl.uniform2i(this._u(p, 'u_fieldSize'), this._gfW, this._gfH)
        gl.uniform2f(this._u(p, 'u_lsize'), this._wq, this._hq)
        gl.uniform2f(this._u(p, 'u_size'), this._w, this._h)
        gl.uniform1f(this._u(p, 'u_t'), t)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    private _compose(mode: number, t: number) {
        const gl = this._gl
        if (mode === 0) this._select(t)
        const cw = this._canvas.width
        const ch = this._canvas.height

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, cw, ch)
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        // Mirror the CSS object-fit used by the size_* classes
        let dw = cw
        let dh = ch
        if (this._size !== 'stretch') {
            const scale = (this._size === 'zoom') ? Math.max(cw / this._w, ch / this._h) : Math.min(cw / this._w, ch / this._h)
            dw = Math.round(this._w * scale)
            dh = Math.round(this._h * scale)
        }
        gl.viewport(Math.round((cw - dw) / 2), Math.round((ch - dh) / 2), dw, dh)

        const p = this._progCompose
        gl.useProgram(p)
        gl.bindVertexArray(this._vao)
        this._bindTex(p, 'u_prevF', 0, this._slots[this._prevIdx].frame)
        this._bindTex(p, 'u_curF', 1, this._slots[this._curIdx].frame)
        this._bindTex(p, 'u_sel', 2, this._sel.tex)
        gl.uniform1f(this._u(p, 'u_t'), t)
        gl.uniform1i(this._u(p, 'u_mode'), mode)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    // --- Info badge & shortcuts -------------------------------------------------------

    private _updateStats = () => {
        this._srcFps = this._arrivals
        this._gameFps = this._uniqueFrames
        // Nothing changing on screen (menu, paused): no new frames to measure, so don't
        // keep a stale "30 fps" reading. Smoothing stays as is until motion resumes.
        if (this._uniqueFrames === 0 && this._arrivals > 0) this._gameFps = 0
        this._uniqueFrames = 0
        this._outFps = this._draws
        this._arrivals = 0
        this._draws = 0
        if (this._badgePinned) this._renderBadge()
    }

    private _setState(state: SmootherState, forceShow = false) {
        if (state === this._lastState && !forceShow) return
        this._lastState = state
        console.log('[motion smoothing] State:', state, 'source interval', this._intervalMs.toFixed(1), 'ms')
        this._showBadge()
    }

    private _showBadge() {
        this._renderBadge()
        this._badge.style.display = 'block'
        if (this._badgeTimer !== undefined) clearTimeout(this._badgeTimer)
        if (!this._badgePinned) {
            this._badgeTimer = window.setTimeout(() => {
                if (!this._badgePinned) this._badge.style.display = 'none'
            }, 10000)
        }
    }

    private _renderBadge() {
        const src = this._srcFps || Math.round(1000 / this._intervalMs)
        const game = this._gameFps || Math.round(1000 / this._intervalMs)
        const res = this._h ? ` · ${this._w}×${this._h}` : ''
        let text: string
        switch (this._computeState()) {
            case 'interpolating':
                text = `Motion smoothing: ON · game ${game} fps → shown ${this._outFps || '…'} fps · stream ${src} fps · +${Math.round(this._intervalMs)} ms${res}`
                break
            case 'standby':
                text = `Motion smoothing: standby · game ${game} fps · stream ${src} fps (no delay added)${res}`
                break
            case 'off':
                text = `Motion smoothing: OFF · game ${game} fps · stream ${src} fps${res}`
                break
            default:
                text = 'Motion smoothing: unavailable on this device (WebGL2 not supported)'
        }
        this._badge.textContent = text
    }

    private _onKeyDown = (e: KeyboardEvent) => {
        if (!e.ctrlKey || !e.shiftKey || e.repeat) return
        const key = e.key.toLowerCase()
        if (key !== 's' && key !== 'i') return
        // Don't forward the shortcut to the game (keyboard input mode)
        e.preventDefault()
        e.stopImmediatePropagation()
        if (key === 's' && this._gl) {
            this.setEnabled(!this._enabled)
        } else if (key === 'i') {
            this._badgePinned = !this._badgePinned
            if (this._badgePinned) this._showBadge()
            else this._badge.style.display = 'none'
        }
    }
}
