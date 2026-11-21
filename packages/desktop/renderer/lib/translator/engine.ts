import { Region, FitMode, clampRegion, regionToSource, videoRectToScreen, SourceRect } from './geometry'
import { getOcrWorker, recognizeCanvas, OcrLine } from './ocr'

export type TextColor = 'light' | 'dark' | 'auto'
type Polarity = 'light' | 'dark'

export type EngineStatus = 'loading' | 'ready' | 'error'

export interface TranslatorConfig {
    region: Region;
    color: TextColor;
    target: string;
    fit: FitMode;
}

/** One piece of text of the interface (a line, or a few lines that belong together) with its translation. */
export interface TranslatedSegment {
    original: string;
    translated: string;
    // Where the original text is, in fractions of the stream area
    rect: Region;
    // Height of one line of the original text, as a fraction of the height of the stream area
    lineHeight: number;
    // Colour of the interface behind the original text and a text colour that reads well on it
    background: [number, number, number];
    foreground: string;
    // True when the text is centred in the window (a subtitle), false when it starts at the left edge of the window
    centered: boolean;
}

export interface TranslatorResult {
    original: string;
    translated: string;
    segments: TranslatedSegment[];
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

// A pixel counts as "text" when it stands out from its surroundings: brighter (light text) or darker (dark text)
// than the average of the area around it by at least this much. This works on bright, dark and shaded
// backgrounds alike, which a fixed brightness limit does not.
const CONTRAST_MIN = 38
const LIGHT_FLOOR = 105
const DARK_CEIL = 150

// Size of the picture that is compared between ticks: it is looked at in detail (up to this width)
// and then reduced to a coarse grid of this many cells across
const SIGNATURE_SOURCE_WIDTH = 640
const SIGNATURE_GRID_WIDTH = 96

// Share of the window that has to look like text before the text reader is started
const MIN_COVERAGE = 0.002
const MAX_COVERAGE = 0.5

const TICK_MS = 450
const FORCE_OCR_MS = 3000

// Mask differences below this are shaking / noise. Different text with a similar layout can look almost the same
// on a coarse mask, so the text is also read again from time to time while it is on screen (see "recheck").
const CHANGE_THRESHOLD = 0.05

// The translation stays on screen through short gaps (video noise, a flickering interface):
// it is only hidden when no text has been seen for this many ticks in a row
const EMPTY_TICKS_BEFORE_HIDE = 9
const FAILED_READS_BEFORE_HIDE = 6

// Words the text reader is less sure about than this are dropped
const MIN_CONFIDENCE = 45

// A box that moved by less than this (fraction of the stream area) is the same box: the picture only shakes
const MOVE_TOLERANCE = 0.012

// Built from strings: the unicode flag is not allowed by the TypeScript target of the project
const NOT_TEXT = new RegExp('[^\\p{L}\\p{N}\\s.,!?\'"’:;()\\-–—…/%&+]', 'gu')
const ALNUM = new RegExp('[\\p{L}\\p{N}]', 'gu')
const LETTER = new RegExp('\\p{L}', 'gu')
const NOT_ALNUM = new RegExp('[^\\p{L}\\p{N}]', 'gu')
const LOWER_START = new RegExp('^[^\\p{L}]*\\p{Ll}', 'u')
const NUMBER = /\d+(?:[.,:]\d+)*/g

function luminance(data: Uint8ClampedArray, offset: number): number {
    return (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) / 1000
}

/** Marks the pixels that stand out from their surroundings (see CONTRAST_MIN). */
function inkMask(data: Uint8ClampedArray, width: number, height: number, polarity: Polarity): { mask: Uint8Array; count: number } {
    const pixels = width * height
    const luma = new Uint8Array(pixels)
    for(let i = 0; i < pixels; i++){
        luma[i] = luminance(data, i * 4)
    }

    // Integral image: the average of any window is then four lookups
    const stride = width + 1
    const integral = new Uint32Array(stride * (height + 1))
    for(let y = 0; y < height; y++){
        let row = 0
        for(let x = 0; x < width; x++){
            row += luma[y * width + x]
            integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row
        }
    }

    const radius = Math.max(4, Math.round(width * 0.014))
    const mask = new Uint8Array(pixels)
    let count = 0

    for(let y = 0; y < height; y++){
        const y0 = Math.max(0, y - radius)
        const y1 = Math.min(height - 1, y + radius)

        for(let x = 0; x < width; x++){
            const x0 = Math.max(0, x - radius)
            const x1 = Math.min(width - 1, x + radius)
            const area = (x1 - x0 + 1) * (y1 - y0 + 1)
            const sum = integral[(y1 + 1) * stride + x1 + 1] - integral[y0 * stride + x1 + 1] - integral[(y1 + 1) * stride + x0] + integral[y0 * stride + x0]
            const mean = sum / area
            const value = luma[y * width + x]

            const ink = polarity === 'light'
                ? (value - mean >= CONTRAST_MIN && value >= LIGHT_FLOOR)
                : (mean - value >= CONTRAST_MIN && value <= DARK_CEIL)

            if(ink){
                mask[y * width + x] = 1
                count++
            }
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

// How different two masks are, from 0 (same) to 1 (nothing in common). Ink that has moved by a cell or so
// (the picture shakes a little because of video compression) still counts as the same.
function maskDifference(a: Uint8Array, b: Uint8Array): number {
    const columns = SIGNATURE_GRID_WIDTH
    const rows = a.length / columns

    const near = (mask: Uint8Array, x: number, y: number): boolean => {
        for(let dy = -1; dy <= 1; dy++){
            const yy = y + dy
            if(yy < 0 || yy >= rows){ continue }
            for(let dx = -1; dx <= 1; dx++){
                const xx = x + dx
                if(xx >= 0 && xx < columns && mask[yy * columns + xx] === 1){
                    return true
                }
            }
        }
        return false
    }

    let unmatched = 0
    let ink = 0

    for(let y = 0; y < rows; y++){
        for(let x = 0; x < columns; x++){
            const i = y * columns + x
            if(a[i] === 1){
                ink++
                if(!near(b, x, y)){ unmatched++ }
            }
            if(b[i] === 1){
                ink++
                if(!near(a, x, y)){ unmatched++ }
            }
        }
    }

    return unmatched / Math.max(1, ink)
}

/** Cleans what the text reader found and returns '' when it does not look like real text. */
export function cleanOcrText(raw: string): string {
    const lines = raw.replace(/\|/g, ' ').split(/\r?\n/)
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

/** The text without its numbers: "Enemies left: 5" and "Enemies left: 4" have the same template. */
export function templateKey(text: string): string {
    return normalizeText(text.replace(NUMBER, '#'))
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
 * Puts the new numbers of a text into the translation of the old one, so a counter or a timer that only changes
 * its digits does not need a new translation. Returns null when that is not possible.
 */
export function substituteNumbers(oldOriginal: string, newOriginal: string, oldTranslated: string): string | null {
    const before = oldOriginal.match(NUMBER) || []
    const after = newOriginal.match(NUMBER) || []
    const inTranslation = oldTranslated.match(NUMBER) || []

    if(before.length === 0 || before.length !== after.length || before.length !== inTranslation.length){
        return null
    }

    if(!before.every((value, index) => value === inTranslation[index])){
        return null
    }

    let index = 0
    return oldTranslated.replace(NUMBER, () => after[index++])
}

interface RawSegment {
    text: string;
    // In pixels of the video frame
    rect: { x: number; y: number; w: number; h: number };
    lineHeight: number;
    background: [number, number, number];
    foreground: string;
    centered: boolean;
}

interface ReadResult {
    segments: RawSegment[];
    text: string;
    score: number;
}

interface ShownSegment extends TranslatedSegment {
    template: string;
}

/**
 * Looks at a window of the video, reads the text in it and translates it, line by line.
 *
 * The same text is never read or translated twice:
 *  - a cheap picture of the "text pixels" is compared between ticks, so a changing background does not start the reader,
 *  - the reader only runs when that picture has really changed and has settled (or now and then, see "recheck"),
 *  - when the reader finds the same text again (small reading errors are ignored) nothing is updated,
 *  - when only numbers change (a counter, a timer) the new numbers are put into the old translation,
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
    _shown: ShownSegment[] = []
    _regionKey = ''

    // Translations by the text, and by the text without its numbers
    _cache: Map<string, string> = new Map()
    _templates: Map<string, { original: string; translated: string }> = new Map()

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
        if(this._shown.length > 0){
            this._shown = []
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
                const fine = inkMask(pixels, width, height, polarity)
                return { polarity, mask: poolMask(fine.mask, width, height), coverage: fine.count / (width * height) }
            })
        const present = candidates.filter(candidate => candidate.coverage >= MIN_COVERAGE && candidate.coverage <= MAX_COVERAGE)

        if(present.length === 0){
            this._prevMask = {}

            // Too much "ink" means a busy picture, not an empty one: neither hide nor read
            if(candidates.some(candidate => candidate.coverage > MAX_COVERAGE)){
                return
            }

            // Nothing that looks like text: hide the translation, but only after a longer gap
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

        for(const candidate of present){
            const previous = this._prevMask[candidate.polarity]
            if(previous === undefined || previous.length !== candidate.mask.length || maskDifference(previous, candidate.mask) > 0.35){
                stable = false
            }

            const read = this._readMask[candidate.polarity]
            if(read === undefined || read.length !== candidate.mask.length || maskDifference(read, candidate.mask) >= CHANGE_THRESHOLD){
                changed = true
            }
        }

        this._prevMask = {}
        for(const candidate of present){
            this._prevMask[candidate.polarity] = candidate.mask
        }

        const now = Date.now()
        const minGap = Math.min(3500, 700 + this._sameCount * 500)

        // Read again now and then even when the picture looks the same: it may be a different line in the same place.
        // Reading the same text again costs nothing visible (see step 4), and it happens less often the longer the text stays.
        const recheck = now - this._lastReadAt >= Math.min(3500, 1200 + this._sameCount * 600)

        if((!changed && !recheck) || now < this._retryAt || now - this._lastReadAt < minGap){
            return
        }

        // A busy background may never settle: read anyway once in a while
        if(!stable && now - this._lastReadAt < FORCE_OCR_MS){
            return
        }

        // 3. Read the text
        this._lastReadAt = now
        this._readMask = {}
        for(const candidate of present){
            this._readMask[candidate.polarity] = candidate.mask
        }
        this._hasReadMask = true

        const generation = this._generation
        let best: ReadResult = { segments: [], text: '', score: 0 }

        for(const candidate of present){
            const result = await this._read(video, source, candidate.polarity)
            if(result !== null && result.score > best.score){
                best = result
            }
        }

        if(generation !== this._generation || !this._running){
            return
        }

        if(best.segments.length === 0){
            this._failedReads++
            if(this._failedReads >= FAILED_READS_BEFORE_HIDE){
                this._clearShown()
            }
            return
        }
        this._failedReads = 0

        // 4. Same text as before? Then nothing needs to be translated; only changed numbers are put in
        const shown = this._shown
        const matches = this._matchShown(best.segments)

        // 5. Translate what is new
        let segments: ShownSegment[]
        try {
            segments = await Promise.all(best.segments.map((raw, index) => this._translateSegment(raw, matches[index], config, video, box)))
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

        if(generation !== this._generation || !this._running){
            return
        }

        const unchanged = shown.length === segments.length && segments.every((segment, index) => {
            const old = shown[index]
            return old.translated === segment.translated
                && Math.abs(old.rect.x - segment.rect.x) < MOVE_TOLERANCE
                && Math.abs(old.rect.y - segment.rect.y) < MOVE_TOLERANCE
                && Math.abs(old.rect.w - segment.rect.w) < MOVE_TOLERANCE * 2
        })

        if(unchanged){
            this._sameCount++
            return
        }

        // Only the shape moved a little: keep the old boxes, so the translation does not twitch
        const sameTexts = shown.length === segments.length && segments.every((segment, index) => shown[index].translated === segment.translated)
        this._sameCount = sameTexts ? this._sameCount + 1 : 0

        this._options.onStatus('ready')
        this._shown = segments
        this._options.onResult({
            original: segments.map(segment => segment.original).join(' '),
            translated: segments.map(segment => segment.translated).join('\n'),
            segments,
        })
    }

    /** For every new piece of text: the piece that was shown before with the same text (apart from numbers), if any. */
    _matchShown(segments: RawSegment[]): Array<ShownSegment | null> {
        const used = new Set<ShownSegment>()

        return segments.map((segment) => {
            const template = templateKey(segment.text)
            let best: ShownSegment | null = null

            for(const candidate of this._shown){
                if(!used.has(candidate) && isSameText(template, candidate.template)){
                    best = candidate
                    break
                }
            }

            if(best !== null){
                used.add(best)
            }
            return best
        })
    }

    async _translateSegment(raw: RawSegment, previous: ShownSegment | null, config: TranslatorConfig, video: HTMLVideoElement, box: { width: number; height: number }): Promise<ShownSegment> {
        const target = config.target
        const template = templateKey(raw.text)
        const fullKey = target + '|' + normalizeText(raw.text)

        let translated = this._cache.get(fullKey)

        if(translated === undefined && previous !== null){
            // The same text with other numbers (or the same text)
            translated = previous.original === raw.text
                ? previous.translated
                : (substituteNumbers(previous.original, raw.text, previous.translated) ?? undefined)
        }

        if(translated === undefined){
            const known = this._templates.get(target + '|' + template)
            if(known !== undefined){
                translated = substituteNumbers(known.original, raw.text, known.translated) ?? undefined
            }
        }

        if(translated === undefined){
            translated = await this._options.translate(raw.text, target)

            if(translated === ''){
                translated = raw.text
            }

            this._remember(fullKey, translated)
            this._templates.set(target + '|' + template, { original: raw.text, translated })
        }

        // Keep the old box when the picture only shook a little (the translation would twitch otherwise)
        const screen = videoRectToScreen(video.videoWidth, video.videoHeight, box.width, box.height, config.fit, raw.rect)
        const lineHeight = videoRectToScreen(video.videoWidth, video.videoHeight, box.width, box.height, config.fit, { x: 0, y: 0, w: 0, h: raw.lineHeight }).h

        const moved = previous === null
            || Math.abs(previous.rect.x - screen.x) >= MOVE_TOLERANCE
            || Math.abs(previous.rect.y - screen.y) >= MOVE_TOLERANCE
            || Math.abs(previous.rect.w - screen.w) >= MOVE_TOLERANCE * 2

        return {
            original: raw.text,
            translated,
            rect: moved ? screen : previous.rect,
            lineHeight: moved ? lineHeight : previous.lineHeight,
            background: raw.background,
            foreground: raw.foreground,
            centered: raw.centered,
            template,
        }
    }

    _remember(key: string, translated: string) {
        if(this._cache.size > 300){
            this._cache.delete(this._cache.keys().next().value as string)
        }
        this._cache.set(key, translated)
    }

    /** Reads the window with one text colour and turns the result into pieces of text with their position and colours. */
    async _read(video: HTMLVideoElement, source: SourceRect, polarity: Polarity): Promise<ReadResult | null> {
        const prepared = this._prepareForReading(video, source, polarity)
        if(prepared === null){
            return null
        }

        const result = await recognizeCanvas(prepared.canvas)
        if(result.confidence < MIN_CONFIDENCE){
            return null
        }

        // Clean the lines and drop what is not text
        const lines: Array<{ line: OcrLine; text: string }> = []
        for(const line of result.lines){
            const text = cleanOcrText(line.text)
            if(text !== ''){
                lines.push({ line, text })
            }
        }

        // Lines that continue the same sentence (a subtitle that wraps) are translated together, other lines on their own
        const groups: Array<Array<{ line: OcrLine; text: string }>> = []
        for(const item of lines.sort((a, b) => a.line.bbox.y0 - b.line.bbox.y0 || a.line.bbox.x0 - b.line.bbox.x0)){
            const group = groups[groups.length - 1]
            const last = group === undefined ? undefined : group[group.length - 1]

            if(last !== undefined && this._continues(last, item)){
                group.push(item)
            } else {
                groups.push([item])
            }
        }

        const segments: RawSegment[] = groups.map((group) => {
            const x0 = Math.min(...group.map(item => item.line.bbox.x0))
            const y0 = Math.min(...group.map(item => item.line.bbox.y0))
            const x1 = Math.max(...group.map(item => item.line.bbox.x1))
            const y1 = Math.max(...group.map(item => item.line.bbox.y1))
            const heights = group.map(item => item.line.bbox.y1 - item.line.bbox.y0).sort((a, b) => a - b)
            const lineHeight = heights[Math.floor(heights.length / 2)]

            const background = this._sampleBackground(prepared, x0, y0, x1, y1)
            const brightness = (background[0] * 299 + background[1] * 587 + background[2] * 114) / 1000

            // Position in pixels of the video frame
            const toVideoX = (x: number) => source.sx + (x - prepared.padding) / prepared.scaleX
            const toVideoY = (y: number) => source.sy + (y - prepared.padding) / prepared.scaleY

            const left = toVideoX(x0)
            const right = toVideoX(x1)
            const windowCenter = source.sx + source.sw / 2
            const centered = Math.abs((left + right) / 2 - windowCenter) < source.sw * 0.12 && left - source.sx > source.sw * 0.08

            return {
                text: group.map(item => item.text).join(' '),
                rect: { x: left, y: toVideoY(y0), w: right - left, h: toVideoY(y1) - toVideoY(y0) },
                lineHeight: lineHeight / prepared.scaleY,
                background,
                foreground: brightness > 150 ? '#111111' : '#ffffff',
                centered,
            }
        })

        const characters = segments.reduce((sum, segment) => sum + segment.text.length, 0)

        return {
            segments,
            text: segments.map(segment => segment.text).join(' '),
            score: segments.length === 0 ? 0 : result.confidence * Math.min(characters, 60),
        }
    }

    /** Does `next` continue the sentence that `last` is part of (the line below it, and `last` did not end the sentence)? */
    _continues(last: { line: OcrLine; text: string }, next: { line: OcrLine; text: string }): boolean {
        const lastHeight = last.line.bbox.y1 - last.line.bbox.y0
        const gap = next.line.bbox.y0 - last.line.bbox.y1
        const overlapsInX = next.line.bbox.x0 < last.line.bbox.x1 && next.line.bbox.x1 > last.line.bbox.x0

        return gap < lastHeight * 0.7
            && overlapsInX
            && !/[.!?:…»"”]$/.test(last.text)
            && LOWER_START.test(next.text)
    }

    /** The colour of the interface behind a piece of text: the average of the pixels in its box that are not text. */
    _sampleBackground(prepared: PreparedImage, x0: number, y0: number, x1: number, y1: number): [number, number, number] {
        const left = Math.max(0, Math.floor(x0 - prepared.padding))
        const top = Math.max(0, Math.floor(y0 - prepared.padding))
        const right = Math.min(prepared.width - 1, Math.ceil(x1 - prepared.padding))
        const bottom = Math.min(prepared.height - 1, Math.ceil(y1 - prepared.padding))

        let r = 0
        let g = 0
        let b = 0
        let count = 0

        for(let y = top; y <= bottom; y += 2){
            for(let x = left; x <= right; x += 2){
                const index = y * prepared.width + x
                if(prepared.ink[index] === 0){
                    r += prepared.colors[index * 4]
                    g += prepared.colors[index * 4 + 1]
                    b += prepared.colors[index * 4 + 2]
                    count++
                }
            }
        }

        if(count === 0){
            return [20, 20, 24]
        }

        return [Math.round(r / count), Math.round(g / count), Math.round(b / count)]
    }

    /** Crops the window from the video and turns it into black text on white, which is what the text reader likes. */
    _prepareForReading(video: HTMLVideoElement, source: SourceRect, polarity: Polarity): PreparedImage | null {
        // Small interface text needs to be enlarged a lot to be read reliably
        const scale = Math.min(3, Math.max(2, 1300 / source.sw))
        const width = Math.min(2400, Math.round(source.sw * scale))
        const height = Math.min(1200, Math.round(source.sh * scale))
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

        // Keep the original colours (to find the colour of the interface behind the text) before the picture is turned black and white
        const colors = new Uint8ClampedArray(data)
        const ink = inkMask(data, width, height, polarity).mask

        for(let i = 0; i < ink.length; i++){
            const value = ink[i] === 1 ? 0 : 255
            data[i * 4] = value
            data[i * 4 + 1] = value
            data[i * 4 + 2] = value
            data[i * 4 + 3] = 255
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

        return {
            canvas: output,
            width,
            height,
            padding,
            scaleX: width / source.sw,
            scaleY: height / source.sh,
            colors,
            ink,
        }
    }
}

interface PreparedImage {
    canvas: HTMLCanvasElement;
    // Size of the picture without the white border, the width of the border and the enlargement
    width: number;
    height: number;
    padding: number;
    scaleX: number;
    scaleY: number;
    colors: Uint8ClampedArray;
    ink: Uint8Array;
}
