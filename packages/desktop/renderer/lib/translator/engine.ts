import { Region, FitMode, clampRegion, regionToSource, videoRectToScreen, SourceRect } from './geometry'
import { getOcrWorker, recognizeCanvas, OcrLine } from './ocr'

export type TextColor = 'light' | 'dark' | 'auto'
type Polarity = 'light' | 'dark'

export type EngineStatus = 'loading' | 'ready' | 'error'

export interface TranslatorConfig {
    region: Region;
    color: TextColor;
    // Language of the text in the game (what the text reader reads) and the language to translate it into
    source: string;
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
    translate: (text: string, target: string, source: string) => Promise<string>;
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

const TICK_MS = 300
const FORCE_OCR_MS = 2000

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

// The camera is moving and the interface swings with it (text that is part of the game world): after this many
// unsettled ticks in a row the translation is hidden, and nothing is read until the picture calms down
// (or until it has been moving for MOTION_PATIENCE_MS, then it is read anyway)
const MOTION_TICKS_BEFORE_HIDE = 2
const MOTION_PATIENCE_MS = 6000

// New text that is seen right after a movement (or is very short) must be read twice before it is translated:
// a swinging, blurred interface gives different garbage on every read
const RECENT_MOTION_MS = 2000
const SHORT_TEXT = 6
const PENDING_MS = 6000

// Text that differs from what is shown in the same place, while the text pixels changed less than this since the last
// read, must be read twice before it replaces the shown text (a living background makes the reader misread)
const IN_PLACE_CHANGE = 0.22

// Every translated line stays on screen for a reading time (this much plus a bit per character), even when the
// original is already gone, and a line that replaces it waits its turn: when subtitles come faster than they can
// be read, they are shown one after another (a few at most) instead of losing some of them
const MIN_SHOW_MS = 1600
const SHOW_PER_CHAR_MS = 45
const MAX_SHOW_MS = 6000
const MAX_QUEUED = 3
const QUEUE_STALE_MS = 15000

// The more lines wait, the shorter each one stays (the reader catches up with the conversation)
function readingTime(segment: { translated: string }, waiting: number): number {
    const base = Math.min(MAX_SHOW_MS, MIN_SHOW_MS + segment.translated.length * SHOW_PER_CHAR_MS)
    return base * (waiting >= 2 ? 0.6 : (waiting === 1 ? 0.8 : 1))
}

// A line that was not found by the reader this many times in a row is dropped from the screen
const MAX_MISSED_READS = 2

// Built from strings: the unicode flag is not allowed by the TypeScript target of the project
const NOT_TEXT = new RegExp('[^\\p{L}\\p{N}\\s.,!?\'"’:;()\\-–—…/%&+]', 'gu')
const ALNUM = new RegExp('[\\p{L}\\p{N}]', 'gu')
const LETTER = new RegExp('\\p{L}', 'gu')
const NOT_ALNUM = new RegExp('[^\\p{L}\\p{N}]', 'gu')
const LOWER_START = new RegExp('^[^\\p{L}]*\\p{Ll}', 'u')
const NUMBER = /\d+(?:[.,:]\d+)*/g

// How much of the smaller box lies inside the other one (0..1)
function overlapShare(a: Region, b: Region): number {
    const width = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const height = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    if(width <= 0 || height <= 0){
        return 0
    }
    return (width * height) / Math.max(1e-9, Math.min(a.w * a.h, b.w * b.h))
}

// Do two boxes (fractions of the stream area) cover a common part of the picture?
function rectsOverlap(a: Region, b: Region): boolean {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

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

// A single letter that is not a word of its own ("a", "I") is an icon or a speck, not text
function isStrayLetter(token: string): boolean {
    return token.length === 1 && /[A-Za-z]/.test(token) && token !== 'a' && token !== 'A' && token !== 'I'
}

/**
 * Text in capital letters is translated badly ("BUY THE UNIT" comes back half in English),
 * so it is turned into normal sentence case before it is sent.
 */
export function toTranslatable(text: string): string {
    const letters: string[] = text.match(LETTER) || []
    if(letters.length < 4){
        return text
    }

    const upper = letters.filter(letter => letter !== letter.toLowerCase()).length
    if(upper / letters.length < 0.8){
        return text
    }

    const lower = text.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/** Cleans what the text reader found and returns '' when it does not look like real text. */
export function cleanOcrText(raw: string): string {
    const lines = raw.replace(/\|/g, ' ').split(/\r?\n/)
    const kept: string[] = []

    for(const line of lines){
        let cleaned = line.replace(NOT_TEXT, '').replace(/\s+/g, ' ').trim()
        const alnum = (cleaned.match(ALNUM) || []).length

        if(alnum < 2 || alnum / cleaned.length < 0.6){
            continue
        }

        // A button icon in front of (or behind) a line is read as a stray letter ("S BUY THE UNIT")
        const tokens = cleaned.split(' ')
        while(tokens.length >= 2 && isStrayLetter(tokens[0])){
            tokens.shift()
        }
        while(tokens.length >= 2 && isStrayLetter(tokens[tokens.length - 1])){
            tokens.pop()
        }
        cleaned = tokens.join(' ')

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

// The smallest number of changes that turn `needle` into some part of `hay`
function substringDistance(needle: string, hay: string): number {
    let previous = new Array(hay.length + 1)
    let current = new Array(hay.length + 1)

    for(let j = 0; j <= hay.length; j++){
        previous[j] = 0
    }

    for(let i = 1; i <= needle.length; i++){
        current[0] = i
        for(let j = 1; j <= hay.length; j++){
            const cost = needle[i - 1] === hay[j - 1] ? 0 : 1
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
        }
        const swap = previous
        previous = current
        current = swap
    }

    let best = needle.length
    for(let j = 0; j <= hay.length; j++){
        best = Math.min(best, previous[j])
    }
    return best
}

/**
 * True when `next` is another (worse) reading of the line `old`: letters mixed up (a swinging or blurred interface
 * gives "DODGE", "DOOGE", "D0DGE"), or a part of the line was not read at all. Both are normalised texts.
 * A text that is clearly longer than the old one is new text (a subtitle that is still being typed), not a reading.
 */
export function isSameReading(next: string, old: string): boolean {
    if(isSameText(next, old)){
        return true
    }

    const longest = Math.max(next.length, old.length)
    if(Math.min(next.length, old.length) < 8 || longest > 400){
        return false
    }

    if(Math.abs(next.length - old.length) <= longest * 0.3 && next.length <= old.length * 1.15 && 1 - levenshtein(next, old) / longest >= 0.78){
        return true
    }

    // Part of the old line was not read
    if(next.length < old.length && next.length >= old.length * 0.6){
        return 1 - substringDistance(next, old) / next.length >= 0.85
    }

    return false
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
    // In how many reads in a row this line was not found (it stays on screen for a couple of reads, see MAX_MISSED_READS)
    missed: number;
    // When it was put on screen (or into the queue)
    shownAt: number;
}

// New text that waits for a second reading before it is translated
interface PendingText {
    key: string;
    seen: number;
    at: number;
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
    // What was on screen when it was hidden because the camera moves (used to recognise the same text afterwards)
    _held: ShownSegment[] = []
    _pending: PendingText[] = []
    _unstableTicks = 0
    _unstableSince = 0
    _lastUnstableAt = 0
    // Translated lines that wait until the line they replace has been on screen long enough
    _queue: ShownSegment[] = []
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

        getOcrWorker(this._options.getConfig().source).then(() => {
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
        this._pending = []
        this._unstableTicks = 0
        this._unstableSince = 0
        this._lastUnstableAt = 0
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
            this._flushQueue()
            await this._step()
        } catch(error) {
            console.warn('Translator: step failed:', error)
        }

        if(this._running){
            this._schedule(TICK_MS)
        }
    }

    /** Hides the translation. Unless `force` is set, lines that have not been on screen long enough to be read stay. */
    _clearShown(force = true) {
        this._held = []

        if(force){
            this._queue = []
        } else if(this._shown.length > 0) {
            const now = Date.now()
            const young = this._shown.filter(segment => now - segment.shownAt < readingTime(segment, this._queue.length))
            if(young.length > 0){
                if(young.length < this._shown.length){
                    this._shown = young
                    this._emit(young)
                }
                return
            }
        }

        if(this._shown.length > 0){
            this._shown = []
            this._options.onResult(null)
        }
    }

    _emit(segments: ShownSegment[]) {
        this._options.onStatus('ready')
        this._options.onResult({
            original: segments.map(segment => segment.original).join(' '),
            translated: segments.map(segment => segment.translated).join('\n'),
            segments,
        })
    }

    /** Puts the next waiting line on screen when the line it replaces has been read. */
    _flushQueue() {
        if(this._queue.length === 0){
            return
        }

        const now = Date.now()
        this._queue = this._queue.filter(item => now - item.shownAt < QUEUE_STALE_MS)
        const next = this._queue[0]
        if(next === undefined){
            return
        }

        const old = this._shown.find(segment => overlapShare(segment.rect, next.rect) > 0.5)
        if(old !== undefined && now - old.shownAt < readingTime(old, this._queue.length)){
            return
        }

        this._queue.shift()
        const segments = this._shown.filter(segment => segment !== old).concat({ ...next, shownAt: now, missed: 0 })
        segments.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
        this._shown = segments
        this._emit(segments)
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
                this._clearShown(false)
            }
            return
        }
        this._emptyTicks = 0

        // 2. Has the text changed, and has it settled?
        let stable = true
        // Unlike "stable", this is only true when the picture has really moved (not when there is nothing to compare with yet)
        let moving = false
        let changed = !this._hasReadMask

        for(const candidate of present){
            const previous = this._prevMask[candidate.polarity]
            if(previous === undefined || previous.length !== candidate.mask.length){
                stable = false
            } else if(maskDifference(previous, candidate.mask) > 0.35){
                stable = false
                moving = true
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

        // The picture is moving: the camera turns and the interface that belongs to the game world swings with it.
        // A translation that stays where the text was would hang in the air, and the blurred text is read differently
        // every time, so the translation is hidden and nothing is read until the picture calms down.
        if(!moving){
            this._unstableTicks = 0
            this._unstableSince = 0
        } else {
            this._unstableTicks++
            // One changed picture is a new line of text; only a picture that keeps changing is a moving camera
            if(this._unstableTicks >= MOTION_TICKS_BEFORE_HIDE){
                this._lastUnstableAt = now
            }
            if(this._unstableSince === 0){
                this._unstableSince = now
            }
        }

        if(moving && (this._shown.length > 0 || this._held.length > 0)){
            if(this._unstableTicks >= MOTION_TICKS_BEFORE_HIDE && this._shown.length > 0){
                this._held = this._shown
                this._shown = []
                this._options.onResult(null)
                // Read as soon as the picture is steady again
                this._sameCount = 0
                this._hasReadMask = false
            }

            if(now - this._unstableSince < MOTION_PATIENCE_MS){
                return
            }
        }

        // The longer the text stays the same, the less often it is read again; changed text is read without that delay
        const minGap = changed ? 350 : Math.min(3000, 400 + this._sameCount * 400)

        // Read again now and then even when the picture looks the same: it may be a different line in the same place.
        // Reading the same text again costs nothing visible (see step 4), and it happens less often the longer the text stays.
        const recheck = now - this._lastReadAt >= Math.min(3500, 1000 + this._sameCount * 500)

        if((!changed && !recheck) || now < this._retryAt || now - this._lastReadAt < minGap){
            return
        }

        // A busy background may never settle: read anyway once in a while
        if(!stable && now - this._lastReadAt < FORCE_OCR_MS){
            return
        }

        // 3. Read the text
        // How much the text pixels differ from the last read: a small difference is a living background, not new text
        let changeAmount = 1
        if(this._hasReadMask){
            changeAmount = 0
            for(const candidate of present){
                const read = this._readMask[candidate.polarity]
                changeAmount = (read === undefined || read.length !== candidate.mask.length) ? 1 : Math.max(changeAmount, maskDifference(read, candidate.mask))
            }
        }

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
                this._clearShown(false)
            }
            return
        }
        this._failedReads = 0

        // 4. Same text as before? Then nothing needs to be translated; only changed numbers are put in
        const shown = this._shown
        const matches = this._matchShown(best.segments)

        // Text that was not on screen before: right after a movement (or when it is very short) it has to be read
        // twice before it is believed
        const accepted: Array<{ raw: RawSegment; previous: ShownSegment | null }> = []
        const known = this._shown.concat(this._held)
        best.segments.forEach((raw, index) => {
            const previous = matches[index]
            if(previous === null){
                const key = templateKey(raw.text)
                if(this._queue.some(waiting => waiting.template === key || isSameReading(key, waiting.template))){
                    return
                }
            }

            let inPlace = false
            if(previous === null && changeAmount < IN_PLACE_CHANGE && known.length > 0){
                // Different text where a line is already shown, although the picture hardly changed: probably a misread
                const screen = videoRectToScreen(video.videoWidth, video.videoHeight, box.width, box.height, config.fit, raw.rect)
                inPlace = known.some(old => overlapShare(screen, old.rect) > 0.5)
            }

            if(previous !== null || this._confirm(raw, now, inPlace)){
                accepted.push({ raw, previous })
            }
        })

        if(accepted.length === 0){
            // Nothing believable yet: look again soon
            this._sameCount = 0
            this._hasReadMask = false
            return
        }

        // 5. Translate what is new
        let segments: ShownSegment[]
        try {
            segments = await Promise.all(accepted.map(item => this._translateSegment(item.raw, item.previous, config, video, box)))
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

        // New text where a line is still being read waits in the queue
        const held: ShownSegment[] = []
        const ready: ShownSegment[] = []
        const stamp = Date.now()
        segments.forEach((segment, index) => {
            const old = accepted[index].previous === null
                ? shown.find(other => overlapShare(segment.rect, other.rect) > 0.5 && stamp - other.shownAt < readingTime(other, this._queue.length))
                : undefined

            if(old === undefined){
                ready.push(segment)
            } else {
                if(held.indexOf(old) < 0){
                    held.push(old)
                }
                this._queue.push({ ...segment, shownAt: stamp })
                if(this._queue.length > MAX_QUEUED){
                    this._queue.shift()
                }
            }
        })
        segments = ready

        // A line that the reader missed this time stays on screen for a couple of reads (a reading may fail now and then),
        // unless something new is shown where it was
        const used = new Set<ShownSegment>()
        accepted.forEach((item) => {
            if(item.previous !== null){
                used.add(item.previous)
            }
        })
        held.forEach((old) => {
            used.add(old)
            if(!segments.some(segment => rectsOverlap(segment.rect, old.rect))){
                segments.push(old)
            }
        })
        shown.concat(this._held).forEach((old) => {
            if(!used.has(old) && old.missed < MAX_MISSED_READS && !segments.some(segment => rectsOverlap(segment.rect, old.rect))){
                segments.push({ ...old, missed: old.missed + 1 })
            }
        })
        segments.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
        this._held = []

        const unchanged = shown.length === segments.length && segments.every((segment, index) => {
            const old = shown[index]
            return old.translated === segment.translated
                && Math.abs(old.rect.x - segment.rect.x) < MOVE_TOLERANCE
                && Math.abs(old.rect.y - segment.rect.y) < MOVE_TOLERANCE
                && Math.abs(old.rect.w - segment.rect.w) < MOVE_TOLERANCE * 2
        })

        if(unchanged){
            this._sameCount++
            this._shown = segments
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

    /**
     * For every new piece of text: the piece that was shown before with the same text (apart from numbers
     * and reading errors), if any. Lines that were hidden while the camera moved count too.
     */
    _matchShown(segments: RawSegment[]): Array<ShownSegment | null> {
        const used = new Set<ShownSegment>()
        const known = this._shown.concat(this._held)

        return segments.map((segment) => {
            const template = templateKey(segment.text)
            let best: ShownSegment | null = null

            // The same text first, then the one that looks most like it
            for(const candidate of known){
                if(!used.has(candidate) && candidate.template === template){
                    best = candidate
                    break
                }
            }

            if(best === null){
                for(const candidate of known){
                    if(!used.has(candidate) && isSameReading(template, candidate.template)){
                        best = candidate
                        break
                    }
                }
            }

            if(best !== null){
                used.add(best)
            }
            return best
        })
    }

    /** Is this new text believable already? Text that shows up while the picture moves, or very short text, has to be read twice. */
    _confirm(segment: RawSegment, now: number, inPlace = false): boolean {
        const key = templateKey(segment.text)
        const strict = inPlace || now - this._lastUnstableAt < RECENT_MOTION_MS || key.length < SHORT_TEXT

        if(!strict){
            return true
        }

        this._pending = this._pending.filter(entry => now - entry.at < PENDING_MS)

        const entry = this._pending.find(item => isSameReading(key, item.key) || isSameReading(item.key, key))
        if(entry === undefined){
            this._pending.push({ key, seen: 1, at: now })
            return false
        }

        entry.seen++
        entry.at = now
        if(key.length > entry.key.length){
            entry.key = key
        }

        if(entry.seen >= 2){
            this._pending = this._pending.filter(item => item !== entry)
            return true
        }
        return false
    }

    async _translateSegment(raw: RawSegment, previous: ShownSegment | null, config: TranslatorConfig, video: HTMLVideoElement, box: { width: number; height: number }): Promise<ShownSegment> {
        const target = config.target
        const template = templateKey(raw.text)
        const fullKey = target + '|' + normalizeText(raw.text)

        let translated = this._cache.get(fullKey)

        // The line that was already on screen, read a little differently (another reading of the same text is not new text)
        let keep: ShownSegment | null = null

        if(previous !== null){
            const sameNumbers = (previous.original.match(NUMBER) || []).join('|') === (raw.text.match(NUMBER) || []).join('|')

            if(previous.original === raw.text){
                translated = previous.translated
            } else if(sameNumbers && template.length <= previous.template.length + 3){
                translated = previous.translated
                keep = previous
            } else if(translated === undefined){
                // The same text with other numbers
                translated = substituteNumbers(previous.original, raw.text, previous.translated) ?? undefined
            }
        }

        if(translated === undefined){
            const known = this._templates.get(target + '|' + template)
            if(known !== undefined){
                translated = substituteNumbers(known.original, raw.text, known.translated) ?? undefined
            }
        }

        if(translated === undefined){
            translated = await this._options.translate(toTranslatable(raw.text), target, config.source)

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
            // A line that was only read differently keeps the text it was first matched with
            original: keep !== null ? keep.original : raw.text,
            translated,
            rect: moved ? screen : previous.rect,
            lineHeight: moved ? lineHeight : previous.lineHeight,
            background: raw.background,
            foreground: raw.foreground,
            centered: raw.centered,
            template: keep !== null ? keep.template : template,
            missed: 0,
            shownAt: previous !== null ? previous.shownAt : Date.now(),
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

        const result = await recognizeCanvas(prepared.canvas, this._options.getConfig().source)
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

            if(last !== undefined && this._continues(last, item, lines)){
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

    /**
     * Does `next` continue the text that `last` is part of (the line right below it)? Either the sentence goes on
     * (no full stop, lower-case start), or it is a wrapped paragraph: same size, same left edge, and the line above
     * runs up to the right margin of the paragraph (a paragraph is translated as a whole, not in pieces).
     */
    _continues(last: { line: OcrLine; text: string }, next: { line: OcrLine; text: string }, all: Array<{ line: OcrLine; text: string }>): boolean {
        const lastHeight = last.line.bbox.y1 - last.line.bbox.y0
        const nextHeight = next.line.bbox.y1 - next.line.bbox.y0
        const gap = next.line.bbox.y0 - last.line.bbox.y1
        const overlapsInX = next.line.bbox.x0 < last.line.bbox.x1 && next.line.bbox.x1 > last.line.bbox.x0

        if(!(gap < lastHeight * 0.7 && overlapsInX) || /[.!?:…»"”]$/.test(last.text)){
            return false
        }

        if(LOWER_START.test(next.text)){
            return true
        }

        const sameSize = nextHeight > lastHeight * 0.75 && nextHeight < lastHeight * 1.33
        const sameLeft = Math.abs(next.line.bbox.x0 - last.line.bbox.x0) < lastHeight * 1.2
        const wrapped = last.text.split(/\s+/).length >= 3

        // The right margin of the paragraph: the furthest right edge of the lines of the same size and left edge
        let right = last.line.bbox.x1
        for(const other of all){
            const height = other.line.bbox.y1 - other.line.bbox.y0
            if(height > lastHeight * 0.75 && height < lastHeight * 1.33 && Math.abs(other.line.bbox.x0 - last.line.bbox.x0) < lastHeight * 1.2){
                right = Math.max(right, other.line.bbox.x1)
            }
        }

        return sameSize && sameLeft && wrapped && last.line.bbox.x1 >= right - lastHeight * 2.5
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
