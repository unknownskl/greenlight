import { Region, FitMode, clampRegion, regionToSource, SourceRect } from './geometry'
import { getOcrWorker, recognizeCanvas } from './ocr'

export type TextColor = 'light' | 'dark' | 'auto'
type Polarity = 'light' | 'dark'

export type EngineStatus = 'loading' | 'ready' | 'error'

export interface TranslatorConfig {
    region: Region;
    color: TextColor;
    target: string;
    fit: FitMode;
}

export interface TranslatorResult {
    original: string;
    translated: string;
}

export interface EngineOptions {
    getVideo: () => HTMLVideoElement | null;
    // Size of the area the video is shown in (the window)
    getBox: () => { width: number; height: number };
    getConfig: () => TranslatorConfig;
    translate: (text: string, target: string) => Promise<string>;
    onResult: (result: TranslatorResult | null) => void;
    onStatus: (status: EngineStatus) => void;
}

// Brightness (0..255) above / below which a pixel counts as "text"
const LIGHT_MIN = 185
const DARK_MAX = 70

// Size of the picture that is compared between ticks: it is looked at in detail (up to this width)
// and then reduced to a coarse grid of this many cells across
const SIGNATURE_SOURCE_WIDTH = 640
const SIGNATURE_GRID_WIDTH = 96

// Share of the window that has to look like text before the text reader is started
const MIN_COVERAGE = 0.003
const MAX_COVERAGE = 0.4

const TICK_MS = 450
const FORCE_OCR_MS = 5000
const EMPTY_TICKS_BEFORE_HIDE = 3

// Built from strings: the unicode flag is not allowed by the TypeScript target of the project
const NOT_TEXT = new RegExp('[^\\p{L}\\p{N}\\s.,!?\'"’:;()\\-–—…/%&+]', 'gu')
const ALNUM = new RegExp('[\\p{L}\\p{N}]', 'gu')
const LETTER = new RegExp('\\p{L}', 'gu')
const NOT_ALNUM = new RegExp('[^\\p{L}\\p{N}]', 'gu')

function luminance(data: Uint8ClampedArray, offset: number): number {
    return (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) / 1000
}

function isInk(lum: number, polarity: Polarity): boolean {
    return polarity === 'light' ? lum >= LIGHT_MIN : lum <= DARK_MAX
}

function buildMask(data: Uint8ClampedArray, polarity: Polarity): { mask: Uint8Array; count: number } {
    const pixels = data.length / 4
    const mask = new Uint8Array(pixels)
    let count = 0

    for(let i = 0; i < pixels; i++){
        if(isInk(luminance(data, i * 4), polarity)){
            mask[i] = 1
            count++
        }
    }

    return { mask, count }
}

// Reduces a mask to a coarse grid: a cell is on when it holds some ink
function poolMask(mask: Uint8Array, width: number, height: number): Uint8Array {
    const columns = SIGNATURE_GRID_WIDTH
    const rows = Math.min(48, Math.max(4, Math.round(columns * height / width)))
    const counts = new Uint16Array(columns * rows)

    for(let y = 0; y < height; y++){
        const row = Math.floor(y * rows / height) * columns
        for(let x = 0; x < width; x++){
            if(mask[y * width + x] === 1){
                counts[row + Math.floor(x * columns / width)]++
            }
        }
    }

    const pooled = new Uint8Array(columns * rows)
    for(let i = 0; i < pooled.length; i++){
        pooled[i] = counts[i] >= 2 ? 1 : 0
    }

    return pooled
}

// Share of pixels that differ between two masks (relative to how much "ink" there is)
function maskDifference(a: Uint8Array, b: Uint8Array): number {
    let diff = 0
    let ink = 0

    for(let i = 0; i < a.length; i++){
        if(a[i] !== b[i]){
            diff++
        }
        if(a[i] === 1 || b[i] === 1){
            ink++
        }
    }

    return diff / Math.max(1, ink)
}

/** Cleans what the text reader found and returns '' when it does not look like real text. */
export function cleanOcrText(raw: string): string {
    const lines = raw.replace(/\|/g, 'I').split(/\r?\n/)
    const kept: string[] = []

    for(const line of lines){
        const cleaned = line.replace(NOT_TEXT, '').replace(/\s+/g, ' ').trim()
        const alnum = (cleaned.match(ALNUM) || []).length

        if(alnum < 2 || alnum / cleaned.length < 0.6){
            continue
        }

        kept.push(cleaned)
    }

    // Single dots / commas that are left over from specks in the picture
    const text = kept.join(' ').replace(/(^|\s)[.,:;]+(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim()
    const letters = (text.match(LETTER) || []).length

    return letters >= 3 ? text : ''
}

export function normalizeText(text: string): string {
    return text.toLowerCase().replace(NOT_ALNUM, '')
}

function levenshtein(a: string, b: string): number {
    const previous = new Array(b.length + 1)
    const current = new Array(b.length + 1)

    for(let j = 0; j <= b.length; j++){
        previous[j] = j
    }

    for(let i = 1; i <= a.length; i++){
        current[0] = i
        for(let j = 1; j <= b.length; j++){
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
        }
        for(let j = 0; j <= b.length; j++){
            previous[j] = current[j]
        }
    }

    return previous[b.length]
}

/** True when two texts are the same line (small differences are reading noise, not new text). */
export function isSameText(a: string, b: string): boolean {
    if(a === b){
        return true
    }

    const longest = Math.max(a.length, b.length)
    if(longest === 0 || Math.abs(a.length - b.length) > longest * 0.2 || longest > 400){
        return false
    }

    return 1 - levenshtein(a, b) / longest >= 0.88
}

/**
 * Looks at a window of the video, reads the text in it and translates it.
 *
 * The same text is never read or translated twice:
 *  - a cheap picture of the "text pixels" is compared between ticks, so a changing background does not start the reader,
 *  - the reader only runs when that picture has really changed and has settled,
 *  - when the reader finds the same text again (small reading errors are ignored) nothing is updated,
 *  - translations are cached.
 */
export default class TranslatorEngine {

    _options: EngineOptions

    _running = false
    _timer: ReturnType<typeof setTimeout> | undefined
    _generation = 0
    _ready = false

    _emptyTicks = 0
    _failedReads = 0
    _prevMask: Partial<Record<Polarity, Uint8Array>> = {}
    _readMask: Partial<Record<Polarity, Uint8Array>> = {}
    _hasReadMask = false
    _lastReadAt = 0
    _retryAt = 0
    _sameCount = 0
    _shown = ''
    _regionKey = ''

    _cache: Map<string, string> = new Map()
    _signatureCanvas = document.createElement('canvas')
    _readCanvas = document.createElement('canvas')

    constructor(options: EngineOptions) {
        this._options = options
    }

    start() {
        if(this._running){
            return
        }

        this._running = true
        this._options.onStatus('loading')

        getOcrWorker().then(() => {
            if(this._running){
                this._ready = true
                this._options.onStatus('ready')
            }
        }).catch((error) => {
            console.error('Translator: failed to start the text reader:', error)
            if(this._running){
                this._options.onStatus('error')
            }
        })

        this._schedule(0)
    }

    stop() {
        this._running = false
        this._generation++
        if(this._timer !== undefined){
            clearTimeout(this._timer)
            this._timer = undefined
        }
    }

    /** Forget what was shown (used when the window is moved). */
    reset() {
        this._generation++
        this._prevMask = {}
        this._readMask = {}
        this._hasReadMask = false
        this._emptyTicks = 0
        this._failedReads = 0
        this._sameCount = 0
        this._retryAt = 0
        this._clearShown()
    }

    _schedule(delay: number) {
        this._timer = setTimeout(() => this._tick(), delay)
    }

    async _tick() {
        if(!this._running){
            return
        }

        try {
            await this._step()
        } catch(error) {
            console.warn('Translator: step failed:', error)
        }

        if(this._running){
            this._schedule(TICK_MS)
        }
    }

    _clearShown() {
        if(this._shown !== ''){
            this._shown = ''
            this._options.onResult(null)
        }
    }

    async _step() {
        if(document.hidden || !this._ready){
            return
        }

        const video = this._options.getVideo()
        if(video === null || video.readyState < 2){
            return
        }

        const config = this._options.getConfig()
        const region = clampRegion(config.region)

        // The window was moved: start over
        const regionKey = [region.x, region.y, region.w, region.h, config.fit, config.color].map(v => typeof v === 'number' ? v.toFixed(4) : v).join('|')
        if(regionKey !== this._regionKey){
            this._regionKey = regionKey
            this.reset()
        }

        const box = this._options.getBox()
        const source = regionToSource(video.videoWidth, video.videoHeight, box.width, box.height, config.fit, region)
        if(source === null){
            return
        }

        // 1. A picture of the window (at most 640px wide, so thin letters keep their contrast), reduced to
        //    "where is text-coloured ink" on a coarse grid
        const width = Math.min(SIGNATURE_SOURCE_WIDTH, Math.max(64, Math.round(source.sw)))
        const height = Math.max(8, Math.round(width * source.sh / source.sw))
        const canvas = this._signatureCanvas
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d', { willReadFrequently: true })
        if(context === null){
            return
        }
        context.drawImage(video, source.sx, source.sy, source.sw, source.sh, 0, 0, width, height)
        const pixels = context.getImageData(0, 0, width, height).data

        const polarities: Polarity[] = config.color === 'auto' ? ['light', 'dark'] : [config.color]
        const candidates = polarities
            .map((polarity) => {
                const fine = buildMask(pixels, polarity)
                return { polarity, mask: poolMask(fine.mask, width, height), coverage: fine.count / (width * height) }
            })
            .filter(candidate => candidate.coverage >= MIN_COVERAGE && candidate.coverage <= MAX_COVERAGE)

        if(candidates.length === 0){
            // Nothing that looks like text: hide the translation after a moment
            this._prevMask = {}
            this._emptyTicks++
            if(this._emptyTicks >= EMPTY_TICKS_BEFORE_HIDE){
                this._readMask = {}
                this._hasReadMask = false
                this._sameCount = 0
                this._clearShown()
            }
            return
        }
        this._emptyTicks = 0

        // 2. Has the text changed, and has it settled?
        let stable = true
        let changed = !this._hasReadMask

        for(const candidate of candidates){
            const previous = this._prevMask[candidate.polarity]
            if(previous === undefined || previous.length !== candidate.mask.length || maskDifference(previous, candidate.mask) > 0.35){
                stable = false
            }

            const read = this._readMask[candidate.polarity]
            if(read === undefined || read.length !== candidate.mask.length || maskDifference(read, candidate.mask) >= 0.12){
                changed = true
            }
        }

        this._prevMask = {}
        for(const candidate of candidates){
            this._prevMask[candidate.polarity] = candidate.mask
        }

        const now = Date.now()
        const minGap = Math.min(3500, 700 + this._sameCount * 500)

        if(!changed || now < this._retryAt || now - this._lastReadAt < minGap){
            return
        }

        // A busy background may never settle: read anyway once in a while
        if(!stable && now - this._lastReadAt < FORCE_OCR_MS){
            return
        }

        // 3. Read the text
        this._lastReadAt = now
        this._readMask = {}
        for(const candidate of candidates){
            this._readMask[candidate.polarity] = candidate.mask
        }
        this._hasReadMask = true

        const generation = this._generation
        let best = { text: '', score: 0 }

        for(const candidate of candidates){
            const prepared = this._prepareForReading(video, source, candidate.polarity)
            if(prepared === null){
                continue
            }

            const result = await recognizeCanvas(prepared)
            const text = cleanOcrText(result.text)
            const score = result.confidence >= 60 ? result.confidence * Math.min(text.length, 60) : 0

            if(text !== '' && score > best.score){
                best = { text, score }
            }
        }

        if(generation !== this._generation || !this._running){
            return
        }

        if(best.text === ''){
            this._failedReads++
            if(this._failedReads >= 2){
                this._clearShown()
            }
            return
        }
        this._failedReads = 0

        // 4. Same text as before: nothing to do
        const normalized = normalizeText(best.text)
        if(this._shown !== '' && isSameText(normalized, this._shown)){
            this._sameCount++
            return
        }
        this._sameCount = 0

        // 5. Translate
        const cacheKey = config.target + '|' + normalized
        let translated = this._cache.get(cacheKey)

        if(translated === undefined){
            try {
                translated = await this._options.translate(best.text, config.target)
            } catch(error) {
                console.warn('Translator: translation failed:', error)
                if(generation === this._generation){
                    this._options.onStatus('error')
                    // Try again in a few seconds
                    this._hasReadMask = false
                    this._retryAt = Date.now() + 3000
                }
                return
            }

            if(translated !== ''){
                if(this._cache.size > 300){
                    this._cache.delete(this._cache.keys().next().value as string)
                }
                this._cache.set(cacheKey, translated)
            }
        }

        if(generation !== this._generation || !this._running || translated === ''){
            return
        }

        this._options.onStatus('ready')
        this._shown = normalized
        this._options.onResult({ original: best.text, translated })
    }

    /** Crops the window from the video and turns it into black text on white, which is what the text reader likes. */
    _prepareForReading(video: HTMLVideoElement, source: SourceRect, polarity: Polarity): HTMLCanvasElement | null {
        const scale = Math.min(3, Math.max(1.5, 1100 / source.sw))
        const width = Math.min(1800, Math.round(source.sw * scale))
        const height = Math.min(900, Math.round(source.sh * scale))
        const padding = 16

        const work = document.createElement('canvas')
        work.width = width
        work.height = height
        const workContext = work.getContext('2d', { willReadFrequently: true })
        if(workContext === null){
            return null
        }

        workContext.drawImage(video, source.sx, source.sy, source.sw, source.sh, 0, 0, width, height)
        const image = workContext.getImageData(0, 0, width, height)
        const data = image.data

        for(let i = 0; i < data.length; i += 4){
            const value = isInk(luminance(data, i), polarity) ? 0 : 255
            data[i] = value
            data[i + 1] = value
            data[i + 2] = value
            data[i + 3] = 255
        }

        const output = this._readCanvas
        output.width = width + padding * 2
        output.height = height + padding * 2

        const outputContext = output.getContext('2d')
        if(outputContext === null){
            return null
        }

        outputContext.fillStyle = '#ffffff'
        outputContext.fillRect(0, 0, output.width, output.height)
        outputContext.putImageData(image, padding, padding)

        return output
    }
}
