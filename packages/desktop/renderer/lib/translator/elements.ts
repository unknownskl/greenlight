import TranslatorEngine, { EngineStatus, Polarity, TextColor, TranslatedSegment, TranslateFunction, TranslatorResult, isSameReading, normalizeText, templateKey, toTranslatable } from './engine'
import { Region, FitMode, regionToSource, videoRectToScreen } from './geometry'
import { getOcrWorker } from './ocr'
import { BlockRole, analyseScreen } from './scout'
import type { AutoFrame } from './autowindows'

/**
 * The translator that works with elements of the interface instead of windows and modes.
 *
 * The scout looks at the whole picture every now and then and finds the pieces of text (a tab, a button, a line of a table,
 * a subtitle). Every piece is an ELEMENT with a memory of its own:
 *  - it has a number and a place, and stays the same element from one look to the next (a small shift of the place, or
 *    a look that misses it now and then, does not make a new one);
 *  - its text pixels are remembered when it is read: as long as they stay the same, it is not read again and its
 *    translation does not change (nothing blinks); when they change, only this element is read again;
 *  - a place where nothing readable was found is remembered as a false alarm and left alone for a while;
 *  - the translation is drawn where the text is.
 * A menu is just a screen with many elements; there are no modes.
 */

export interface ElementsOptions {
    getVideo: () => HTMLVideoElement | null;
    getBox: () => { width: number; height: number };
    getSettings: () => { fit: FitMode; source: string; target: string; color: TextColor; panels?: boolean };
    // The windows the player has placed himself: those places are left to them
    getManualRegions: () => Region[];
    translate: TranslateFunction;
    // The translations that are on screen, one result per element (the role tells a subtitle from the rest)
    onResults: (results: ElementResult[]) => void;
    onFrames?: (frames: AutoFrame[]) => void;
    onStatus?: (status: EngineStatus) => void;
}

export interface ElementResult {
    id: number;
    role: BlockRole;
    result: TranslatorResult;
}

// How often the picture is looked at, and in what size (small text is lost in a smaller picture)
const SCAN_MS = 700
// The picture is looked at in the size it comes (up to SCAN_WIDTH): thin or faint text on a busy picture (the description of
// an item) is lost when it is made smaller. When a look takes too long it is made smaller, and bigger again when it is fast.
const SCAN_WIDTH = 1920
const SCAN_WIDTH_SMALL = 1280
const SCAN_SLOW_MS = 260
const SCAN_FAST_MS = 70
const MAX_BLOCKS = 30
const MAX_ELEMENTS = 48

// An element that was not found on this many looks in a row is gone (a place of text that proved to be a false alarm is
// remembered for longer, so that it is not tried again and again)
const DROP_MISSES = 3
const DEAD_DROP_MISSES = 12
// How much the text pixels of an element differ from what was read (0 = the same, 1 = nothing in common): more than
// CHANGED and the element is read again; when less than GONE of the ink that was read is left, the text is gone
const CHANGED = 0.3
const GONE = 0.2
// An element that had nothing to read stays "dead" for this long, unless its pixels change a lot
const DEAD_MS = 20000
const REVIVE_CHANGE = 0.55
// An element is not read more often than this (a text that is still the same is not worth it)
const READ_GAP_MS = 600
const SHOWN_READ_GAP_MS = 1800
// A shift of the place smaller than this is not followed (the picture is looked at coarsely and the place shakes a little)
const MOVE_TOLERANCE = 0.006
// A translation that has got a better version is replaced only while it is young
const BETTER_MS = 4000
// Pieces of text that are at least this tall (fractions of the screen) and not further apart than this many heights are one title
const TITLE_MIN_HEIGHT = 0.03
const TITLE_GAP = 0.7
// More ink than this between two pieces (an icon) and they are not one title
const GAP_INK = 0.3
// ... or when a line of ink runs through the gap: a column that is this much ink
const GAP_LINE = 0.75
// ... and one row of text (a block of several rows or a picture is not a title)
const TITLE_MAX_HEIGHT = 0.08
// Up to this many letters is a short text: it has to be read with at least this confidence, or it is not believed
const SHORT_TEXT_LETTERS = 6
const SHORT_TEXT_CONFIDENCE = 68
// A reading that the reader is this unsure about is not believed at all (pictures and noise)
const MIN_CONFIDENCE = 55
// A reading this sure is taken at once; a weaker one is tried again in another way, and the best one is taken
const GOOD_CONFIDENCE = 72
// ... and covers at least this part of the place (the rest of a paragraph is tried in other ways)
const GOOD_COVERAGE = 0.6
// The picture in grey is tried (it takes time) only for places that look like text to the scout
const RAW_MIN_SCORE = 120

const LETTER = new RegExp('\\p{L}', 'gu')

interface Segment extends TranslatedSegment {
    template: string;
    shownAt: number;
}

interface Element {
    id: number;
    // Where it is (fractions of the stream area) and where its text pixels are in the picture that was looked at (fractions)
    rect: Region;
    scan: Region;
    polarity: Polarity;
    role: BlockRole;
    plate: boolean;
    panel?: Region;
    // How much the place looked like text to the scout
    score: number;
    // On how many looks in a row it was found / not found
    seen: number;
    missed: number;
    // new: not read yet; text: has a translation; dead: nothing readable (a false alarm); idle: its text has gone
    state: 'new' | 'text' | 'dead' | 'idle';
    dirty: boolean;
    dirtySince: number;
    reading: boolean;
    readAt: number;
    deadUntil: number;
    deadCount: number;
    // The text pixels when it was read (cells), and how much ink there was
    sig: Uint8Array | null;
    sigSum: number;
    segments: Segment[];
}

interface Cells {
    cells: Uint8Array;
    sum: number;
}

// How much of the first box lies inside the second one (0..1)
function inside(inner: Region, outer: Region): number {
    const width = Math.min(inner.x + inner.w, outer.x + outer.w) - Math.max(inner.x, outer.x)
    const height = Math.min(inner.y + inner.h, outer.y + outer.h) - Math.max(inner.y, outer.y)
    if(width <= 0 || height <= 0){
        return 0
    }
    return (width * height) / Math.max(1e-9, inner.w * inner.h)
}

function center(region: Region): { x: number; y: number } {
    return { x: region.x + region.w / 2, y: region.y + region.h / 2 }
}

function distance(a: Region, b: Region): number {
    const first = center(a)
    const second = center(b)
    return Math.hypot(first.x - second.x, first.y - second.y)
}

function similarSize(a: Region, b: Region): boolean {
    return a.w > b.w * 0.75 && a.w < b.w * 1.33 && a.h > b.h * 0.65 && a.h < b.h * 1.5
}

function centralness(region: Region): number {
    const middle = center(region)
    return Math.max(0, 1 - Math.hypot((middle.x - 0.5) / 0.35, (middle.y - 0.5) / 0.35))
}

/** The text pixels of a place as a coarse grid: how much of every cell is text (0..255). */
function cellsOf(mask: Uint8Array, width: number, height: number, box: Region): Cells {
    const x0 = Math.max(0, Math.floor(box.x * width))
    const y0 = Math.max(0, Math.floor(box.y * height))
    const x1 = Math.min(width, Math.ceil((box.x + box.w) * width))
    const y1 = Math.min(height, Math.ceil((box.y + box.h) * height))
    const gx = Math.max(6, Math.min(64, Math.round((x1 - x0) / 3)))
    const gy = Math.max(3, Math.min(24, Math.round((y1 - y0) / 3)))
    const cells = new Uint8Array(gx * gy)
    let sum = 0

    if(x1 <= x0 || y1 <= y0){
        return { cells, sum }
    }

    const counts = new Uint16Array(gx * gy)
    const totals = new Uint16Array(gx * gy)
    for(let y = y0; y < y1; y++){
        const cy = Math.min(gy - 1, Math.floor((y - y0) * gy / (y1 - y0)))
        for(let x = x0; x < x1; x++){
            const cell = cy * gx + Math.min(gx - 1, Math.floor((x - x0) * gx / (x1 - x0)))
            totals[cell]++
            if(mask[y * width + x] === 1){
                counts[cell]++
            }
        }
    }
    for(let i = 0; i < cells.length; i++){
        cells[i] = totals[i] === 0 ? 0 : Math.round(255 * counts[i] / totals[i])
        sum += cells[i]
    }
    return { cells, sum }
}

/** How different two grids are: 0 the same, 1 nothing in common. */
function cellsDifference(a: Uint8Array, b: Uint8Array): number {
    if(a.length !== b.length){
        return 1
    }
    let different = 0
    let union = 0
    for(let i = 0; i < a.length; i++){
        different += Math.abs(a[i] - b[i])
        union += Math.max(a[i], b[i])
    }
    return union === 0 ? 0 : different / union
}

export default class ElementsEngine {
    _options: ElementsOptions
    _running = false
    _ready = false
    _timer: ReturnType<typeof setTimeout> | undefined
    _readTimer: ReturnType<typeof setTimeout> | undefined
    _elements: Element[] = []
    _nextId = 1
    _canvas = document.createElement('canvas')
    _scanTook = 0
    _width = SCAN_WIDTH
    // The text pixels of the last look (for the signatures of the elements)
    _masks: Array<{ mask: Uint8Array; count: number }> = []
    _scanSize = { width: 0, height: 0 }
    _polarities: Polarity[] = ['light', 'dark']
    // The tools of the text reader and the translations that were made
    _toolbox: TranslatorEngine
    _cache: Map<string, string> = new Map()
    _pending: Map<string, Promise<string>> = new Map()
    _lastKey = ''
    // What the last look found (for tests)
    _lastPieces: Array<{ x: number; y: number; w: number; h: number; polarity: Polarity; role: BlockRole; score: number }> = []

    constructor(options: ElementsOptions) {
        this._options = options
        // The reader of the translator engine does the reading of one place (it is not started: it is only a toolbox)
        this._toolbox = new TranslatorEngine({
            getVideo: options.getVideo,
            getBox: options.getBox,
            getConfig: () => ({ region: { x: 0, y: 0, w: 1, h: 1 }, color: 'auto', source: options.getSettings().source, target: options.getSettings().target, fit: options.getSettings().fit }),
            translate: options.translate,
            onResult: () => { /* not used */ },
            onStatus: () => { /* not used */ },
            priority: 1,
        })
    }

    start() {
        if(this._running){
            return
        }
        this._running = true
        this._options.onStatus?.('loading')

        getOcrWorker(this._options.getSettings().source).then(() => {
            if(this._running){
                this._ready = true
                this._options.onStatus?.('ready')
            }
        }).catch((error) => {
            console.error('Translator: failed to start the text reader:', error)
            if(this._running){
                this._options.onStatus?.('error')
            }
        })

        this._timer = setTimeout(() => this._scan(), 300)
        this._readTimer = setTimeout(() => this._readLoop(), 500)
    }

    stop() {
        this._running = false
        if(this._timer !== undefined){
            clearTimeout(this._timer)
            this._timer = undefined
        }
        if(this._readTimer !== undefined){
            clearTimeout(this._readTimer)
            this._readTimer = undefined
        }
        this._elements = []
        this._lastKey = ''
        this._options.onResults([])
        this._options.onFrames?.([])
        this._cache.clear()
        this._pending.clear()
    }

    // ----------------------------------------------------------------------------------------------- looking

    _scan() {
        if(!this._running){
            return
        }

        const began = Date.now()
        try {
            this._scanOnce()
        } catch(error) {
            console.warn('Translator: look failed:', error)
        }
        this._scanTook = Date.now() - began
        if(this._width > SCAN_WIDTH_SMALL && this._scanTook > SCAN_SLOW_MS){
            this._width = SCAN_WIDTH_SMALL
        } else if(this._width < SCAN_WIDTH && this._scanTook < SCAN_FAST_MS){
            this._width = SCAN_WIDTH
        }

        if(this._running){
            this._timer = setTimeout(() => this._scan(), Math.max(SCAN_MS, this._scanTook * 8))
        }
    }

    _scanOnce() {
        if(document.hidden){
            return
        }

        const video = this._options.getVideo()
        if(video === null || video.readyState < 2){
            return
        }

        const box = this._options.getBox()
        const settings = this._options.getSettings()
        const visible = regionToSource(video.videoWidth, video.videoHeight, box.width, box.height, settings.fit, { x: 0, y: 0, w: 1, h: 1 })
        if(visible === null){
            return
        }

        const width = Math.min(this._width, Math.round(visible.sw))
        const height = Math.max(8, Math.round(width * visible.sh / visible.sw))
        this._canvas.width = width
        this._canvas.height = height
        const context = this._canvas.getContext('2d', { willReadFrequently: true })
        if(context === null){
            return
        }
        context.drawImage(video, visible.sx, visible.sy, visible.sw, visible.sh, 0, 0, width, height)
        const pixels = context.getImageData(0, 0, width, height).data

        const { blocks, masks } = analyseScreen(pixels, width, height, this._polarities, MAX_BLOCKS)
        this._masks = masks
        this._scanSize = { width, height }

        const now = Date.now()
        const manual = this._options.getManualRegions()
        const toScreen = (b: { x: number; y: number; w: number; h: number }): Region => videoRectToScreen(video.videoWidth, video.videoHeight, box.width, box.height, settings.fit, {
            x: visible.sx + b.x * visible.sw,
            y: visible.sy + b.y * visible.sh,
            w: b.w * visible.sw,
            h: b.h * visible.sh,
        })

        // The words of a big title are far apart ("H U N T E R  F O R U M S"): they are found as separate pieces and are put
        // together here, so that the title is translated as one phrase ("Hunter Forums" is "Форум мисливців", not "Мисливець Форуми")
        const pieces = this._joinTitles(blocks, toScreen)
        this._lastPieces = pieces.map(piece => ({ x: piece.x, y: piece.y, w: piece.w, h: piece.h, polarity: piece.polarity, role: piece.role, score: piece.score }))

        const taken = new Set<Element>()
        for(const block of pieces){
            const rect = toScreen(block)

            // The places the player has taken are not ours
            if(manual.some(region => region.enabled !== false && inside(rect, { x: region.x - 0.01, y: region.y - 0.01, w: region.w + 0.02, h: region.h + 0.02 }) > 0.02)){
                continue
            }

            const scan: Region = { x: block.x, y: block.y, w: block.w, h: block.h }
            const panel = block.panel === undefined ? undefined : toScreen(block.panel)

            // The same element as before: about the same place and size (a shift is followed: a text that floats, but never as far
            // as the next row of a list: that is another element)
            let best: Element | null = null
            let bestDistance = Infinity
            for(const element of this._elements){
                if(taken.has(element)){
                    continue
                }
                const same = (inside(rect, element.rect) > 0.6 && inside(element.rect, rect) > 0.4) || (similarSize(rect, element.rect) && distance(rect, element.rect) <= Math.max(0.015, Math.min(rect.h, element.rect.h) * 0.9))
                if(same){
                    const gap = distance(rect, element.rect)
                    if(gap < bestDistance){
                        best = element
                        bestDistance = gap
                    }
                }
            }

            if(best === null){
                if(this._elements.length >= MAX_ELEMENTS){
                    continue
                }
                best = {
                    id: this._nextId++, rect, scan, polarity: block.polarity, role: block.role, plate: block.plate, panel, score: block.score,
                    seen: 0, missed: 0, state: 'new', dirty: false, dirtySince: now, reading: false, readAt: 0, deadUntil: 0, deadCount: 0,
                    sig: null, sigSum: 0, segments: [],
                }
                this._elements.push(best)
            }
            taken.add(best)
            this._follow(best, rect, scan, panel, block.role, block.plate, block.polarity, block.score, now)
        }

        // Elements that were not found this time
        for(const element of this._elements){
            if(!taken.has(element)){
                element.missed++
                element.seen = 0

                // The text is not there any more (the scene has changed, a menu was closed): the translation is taken away at
                // once, not after a few more looks
                if(element.state === 'text' && element.sig !== null && element.sigSum > 0){
                    const mask = this._masks[this._polarities.indexOf(element.polarity)]
                    if(mask !== undefined){
                        const current = cellsOf(mask.mask, width, height, element.scan)
                        if(current.sum < element.sigSum * 0.5 || cellsDifference(element.sig, current.cells) > 0.7){
                            element.segments = []
                            element.state = 'idle'
                        }
                    }
                }
            }
        }
        this._elements = this._elements.filter(element => element.missed < (element.state === 'dead' ? DEAD_DROP_MISSES : DROP_MISSES) || element.reading)

        this._emit()
        this._report()
    }

    /** Is there nothing between two pieces of text (no frame of a button, no icon)? Only then they can be one title. */
    _gapIsEmpty(a: { x: number; y: number; w: number; h: number; polarity: Polarity; score: number }, b: { x: number; y: number; w: number; h: number; polarity: Polarity; score: number }): boolean {
        const left = a.x <= b.x ? a : b
        const right = a.x <= b.x ? b : a
        const { width, height } = this._scanSize
        const x0 = Math.floor((left.x + left.w) * width)
        const x1 = Math.ceil(right.x * width)
        const y0 = Math.floor(Math.max(a.y, b.y) * height)
        const y1 = Math.ceil(Math.min(a.y + a.h, b.y + b.h) * height)
        if(x1 <= x0 || y1 <= y0){
            return true
        }

        // The text pixels of the kind of the better piece (the other kind is the plain background next to the letters)
        const mask = this._masks[this._polarities.indexOf(a.score >= b.score ? a.polarity : b.polarity)]
        if(mask === undefined){
            return true
        }
        // A line that runs through the gap (the edge of a button, a divider) tells the pieces are not one phrase; so does a lot of ink
        // (an icon). A little ink at the edges of the letters is only the glow around them.
        let count = 0
        let line = false
        for(let x = x0; x < x1; x++){
            let column = 0
            for(let y = y0; y < y1; y++){
                if(mask.mask[y * width + x] === 1){
                    column++
                }
            }
            count += column
            if(column >= GAP_LINE * (y1 - y0)){
                line = true
            }
        }
        return !line && count / ((x1 - x0) * (y1 - y0)) < GAP_INK
    }

    /** Big pieces of text that stand on one row, close to each other and about as big, are one piece (a title in several words). */
    _joinTitles<T extends { x: number; y: number; w: number; h: number; score: number; polarity: Polarity }>(blocks: T[], toScreen: (b: { x: number; y: number; w: number; h: number }) => Region): T[] {
        const list = blocks.slice()
        let joined = true

        while(joined){
            joined = false
            for(let a = 0; a < list.length && !joined; a++){
                for(let b = a + 1; b < list.length && !joined; b++){
                    const first = toScreen(list[a])
                    const second = toScreen(list[b])
                    const high = Math.max(first.h, second.h)
                    const low = Math.min(first.h, second.h)
                    const overlap = Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y)
                    const gap = Math.max(first.x, second.x) - Math.min(first.x + first.w, second.x + second.w)
                    if(low >= TITLE_MIN_HEIGHT && high <= TITLE_MAX_HEIGHT && low / high >= 0.6 && overlap >= 0.7 * low && gap <= TITLE_GAP * high){
                        const x = Math.min(list[a].x, list[b].x)
                        const y = Math.min(list[a].y, list[b].y)
                        const best = list[a].score >= list[b].score ? list[a] : list[b]
                        list[a] = { ...best, x, y, w: Math.max(list[a].x + list[a].w, list[b].x + list[b].w) - x, h: Math.max(list[a].y + list[a].h, list[b].y + list[b].h) - y, score: Math.max(list[a].score, list[b].score) }
                        list.splice(b, 1)
                        joined = true
                    }
                }
            }
        }
        return list
    }

    /** An element was found again: its place is followed, and its text pixels say whether it has to be read (again). */
    _follow(element: Element, rect: Region, scan: Region, panel: Region | undefined, role: BlockRole, plate: boolean, polarity: Polarity, score: number, now: number) {
        element.missed = 0
        element.seen++
        element.score = Math.max(element.score * 0.9, score)
        element.role = role
        element.plate = plate
        element.panel = panel
        element.polarity = polarity

        // A text that moves (it floats in the world): its translation goes with it
        const dx = rect.x - element.rect.x
        const dy = rect.y - element.rect.y
        if((Math.abs(dx) >= MOVE_TOLERANCE || Math.abs(dy) >= MOVE_TOLERANCE) && similarSize(rect, element.rect)){
            element.segments = element.segments.map(segment => ({ ...segment, rect: { ...segment.rect, x: segment.rect.x + dx, y: segment.rect.y + dy } }))
            element.rect = rect
        } else if(!similarSize(rect, element.rect)){
            element.rect = rect
        }
        element.scan = scan

        const polarityIndex = this._polarities.indexOf(element.polarity)
        const mask = this._masks[polarityIndex]
        if(mask === undefined){
            return
        }
        const current = cellsOf(mask.mask, this._scanSize.width, this._scanSize.height, scan)

        if(element.state === 'new'){
            if(!element.dirty && element.seen >= this._need(element)){
                element.dirty = true
                element.dirtySince = now
            }
            return
        }

        if(element.sig === null){
            return
        }

        const difference = cellsDifference(element.sig, current.cells)

        if(element.state === 'dead'){
            if((now >= element.deadUntil || difference > REVIVE_CHANGE) && !element.dirty){
                element.dirty = true
                element.dirtySince = now
            }
            return
        }

        // The text is gone (what was read is not there any more): the translation is taken away at once
        if(element.sigSum > 0 && current.sum < element.sigSum * GONE){
            if(element.segments.length > 0){
                element.segments = []
                element.state = 'idle'
            }
            return
        }

        // The text is back after it had gone (or the text pixels changed): the element is read again
        if((difference > CHANGED || element.state === 'idle') && !element.dirty){
            element.dirty = true
            element.dirtySince = now
        }
    }

    /** On how many looks in a row an element has to be found before it is read (a subtitle at once, the rest of the interface a little later). */
    _need(element: Element): number {
        let need = element.role === 'subtitle' ? 1 : (element.plate || element.role === 'notice' ? 2 : 3)
        if(centralness(element.rect) > 0){
            need = Math.min(need, 2)
        }
        return need + (element.polarity === 'dark' ? 1 : 0)
    }

    // ----------------------------------------------------------------------------------------------- reading

    async _readLoop() {
        if(!this._running){
            return
        }

        let next: Element | null = null
        if(this._ready){
            next = this._pick()
        }

        if(next !== null){
            try {
                await this._readElement(next)
            } catch(error) {
                console.warn('Translator: reading failed:', error)
                next.reading = false
            }
        }

        if(this._running){
            this._readTimer = setTimeout(() => this._readLoop(), next === null ? 120 : 0)
        }
    }

    /** The element that is read next: new text of subtitles and of the middle of the screen first, then the rest. */
    _pick(): Element | null {
        const now = Date.now()
        let best: Element | null = null
        let bestScore = -Infinity

        for(const element of this._elements){
            if(!element.dirty || element.reading || element.missed > 0){
                continue
            }
            const gap = element.state === 'text' ? SHOWN_READ_GAP_MS : READ_GAP_MS
            if(now - element.readAt < gap){
                continue
            }

            const score = (element.role === 'subtitle' ? 4 : 0) + centralness(element.rect) * 3 + (element.plate ? 1 : 0) + (element.state === 'new' ? 1.5 : 0) + Math.min(3, (now - element.dirtySince) / 1500)
            if(score > bestScore){
                best = element
                bestScore = score
            }
        }
        return best
    }

    async _readElement(element: Element) {
        const video = this._options.getVideo()
        if(video === null || video.readyState < 2){
            return
        }

        const box = this._options.getBox()
        const settings = this._options.getSettings()

        // The text pixels at this moment: this is what is read
        const polarityIndex = this._polarities.indexOf(element.polarity)
        const mask = this._masks[polarityIndex]
        const current = mask === undefined ? null : cellsOf(mask.mask, this._scanSize.width, this._scanSize.height, element.scan)

        // The place of the element a little bigger, so that the edges of the letters are not cut
        const padY = Math.max(0.006, element.rect.h * 0.3)
        const padX = Math.max(0.006, element.rect.h * 0.4)
        const region: Region = { x: Math.max(0, element.rect.x - padX), y: Math.max(0, element.rect.y - padY), w: element.rect.w + 2 * padX, h: element.rect.h + 2 * padY }
        const source = regionToSource(video.videoWidth, video.videoHeight, box.width, box.height, settings.fit, region)
        if(source === null){
            element.dirty = false
            return
        }

        element.dirty = false
        element.reading = true
        element.readAt = Date.now()

        const crop = document.createElement('canvas')
        crop.width = Math.max(8, Math.round(source.sw))
        crop.height = Math.max(8, Math.round(source.sh))
        const context = crop.getContext('2d')
        if(context === null){
            element.reading = false
            return
        }
        context.drawImage(video, source.sx, source.sy, source.sw, source.sh, 0, 0, crop.width, crop.height)

        const job: any = {
            canvas: crop,
            source,
            config: { region, mode: element.role === 'subtitle' ? 'dialog' : 'task', color: 'auto', source: settings.source, target: settings.target, fit: settings.fit },
        }
        // The text colour the scout found first; when nothing is read, the other one (white text on a light bar looks dark)
        // and, when that does not work, the picture in grey (thin or faint letters are lost when it is cut into black and white)
        const other: Polarity = element.polarity === 'light' ? 'dark' : 'light'
        const attempts: Array<[Polarity, boolean]> = [[element.polarity, false], [other, false]]
        if(element.score >= RAW_MIN_SCORE){
            attempts.push([element.polarity, true])
        }
        let result: Awaited<ReturnType<TranslatorEngine['_read']>> = null
        let resultValue = 0
        for(const [polarity, raw] of attempts){
            if(!this._running){
                break
            }
            const attempt = await this._toolbox._read(job, polarity, raw)
            if(attempt !== null && attempt.segments.length > 0){
                // How much of the place the text that was read covers: a reading of one line out of a paragraph is a poor one
                const coverage = this._coverage(element, attempt, video, box, settings.fit)
                const value = attempt.confidence * (0.4 + 0.6 * coverage)
                if(result === null || value > resultValue){
                    result = attempt
                    resultValue = value
                }
                if(attempt.confidence >= GOOD_CONFIDENCE && coverage >= GOOD_COVERAGE){
                    break
                }
            }
        }
        crop.width = 0
        crop.height = 0
        element.reading = false

        if(!this._running || !this._elements.includes(element)){
            return
        }

        if(current !== null){
            element.sig = current.cells
            element.sigSum = current.sum
        }

        // A few letters that the reader is not sure about are the pattern of an icon (a button of the pad, a symbol), not a word
        if(result !== null && result.confidence < MIN_CONFIDENCE){
            result = null
        }
        if(result !== null && result.segments.length > 0 && result.confidence < SHORT_TEXT_CONFIDENCE){
            const letters = result.segments.reduce((sum, segment) => sum + (segment.text.match(LETTER) || []).length, 0)
            if(letters <= SHORT_TEXT_LETTERS){
                result = null
            }
        }

        if(result === null || result.segments.length === 0){
            // Nothing readable: a false alarm (a picture, a decoration) is left alone for a while, longer every time
            if(element.state === 'text' && element.deadCount === 0){
                // It had text before and a reading may fail now and then: once more before it is given up
                element.deadCount = 1
                element.dirty = true
                element.dirtySince = Date.now()
                return
            }
            element.state = 'dead'
            element.segments = []
            element.deadCount++
            element.deadUntil = Date.now() + DEAD_MS * Math.pow(2, Math.min(4, element.deadCount - 1))
            this._emit()
            return
        }
        element.deadCount = 0

        // The lines that were read: the ones that are the same text as before keep their translation (nothing blinks)
        const target = settings.target
        const old = element.segments
        const used = new Set<Segment>()
        const segments: Segment[] = []
        const pendingTranslations: Array<Promise<void>> = []

        for(const raw of result.segments){
            const screen = videoRectToScreen(video.videoWidth, video.videoHeight, box.width, box.height, settings.fit, raw.rect)
            const lineHeight = videoRectToScreen(video.videoWidth, video.videoHeight, box.width, box.height, settings.fit, { x: 0, y: 0, w: 0, h: raw.lineHeight }).h
            const template = templateKey(raw.text)
            const same = old.find(segment => !used.has(segment) && (segment.template === template || isSameReading(template, segment.template)))

            if(same !== undefined){
                used.add(same)
                const moved = Math.abs(same.rect.x - screen.x) >= MOVE_TOLERANCE || Math.abs(same.rect.y - screen.y) >= MOVE_TOLERANCE || Math.abs(same.rect.w - screen.w) >= MOVE_TOLERANCE * 2
                segments.push(moved ? { ...same, rect: screen, lineHeight } : same)
                continue
            }

            const segment: Segment = {
                original: raw.text,
                translated: '',
                rect: screen,
                lineHeight,
                background: raw.background,
                foreground: raw.foreground,
                centered: raw.centered,
                template,
                shownAt: Date.now(),
            }
            segments.push(segment)
            pendingTranslations.push(this._translate(raw.text, target, settings.source).then((translated) => { segment.translated = translated }))
        }

        try {
            await Promise.all(pendingTranslations)
        } catch(error) {
            console.warn('Translator: translation failed:', error)
            this._options.onStatus?.('error')
            // Again in a few seconds
            element.dirty = true
            element.dirtySince = Date.now()
            element.readAt = Date.now() + 2500
            return
        }

        if(!this._running || !this._elements.includes(element)){
            return
        }

        this._options.onStatus?.('ready')
        element.segments = segments.filter(segment => segment.translated !== '')
        element.state = element.segments.length > 0 ? 'text' : 'dead'
        this._emit()
    }

    // ----------------------------------------------------------------------------------------------- translating

    _translate(text: string, target: string, source: string): Promise<string> {
        const key = target + '|' + normalizeText(text)
        const known = this._cache.get(key)
        if(known !== undefined){
            return Promise.resolve(known)
        }

        let pending = this._pending.get(key)
        if(pending === undefined){
            pending = this._options.translate(toTranslatable(text), target, source).then((answer) => {
                this._pending.delete(key)
                let translated = typeof answer === 'string' ? answer : answer.text
                if(translated === ''){
                    translated = text
                }
                this._remember(key, translated)

                // A draft that gets better: the better text replaces it where it is shown (while it is young), and in the memory
                if(typeof answer !== 'string' && answer.better !== undefined){
                    const draft = translated
                    answer.better.then((better) => {
                        if(better === null || better === '' || better === draft || !this._running){
                            return
                        }
                        this._remember(key, better)
                        const now = Date.now()
                        let changed = false
                        this._elements.forEach((element) => {
                            element.segments.forEach((segment) => {
                                if(segment.translated === draft && target + '|' + normalizeText(segment.original) === key && now - segment.shownAt < BETTER_MS){
                                    segment.translated = better
                                    changed = true
                                }
                            })
                        })
                        if(changed){
                            this._emit()
                        }
                    }).catch(() => { /* the draft stays */ })
                }
                return translated
            }, (error) => {
                this._pending.delete(key)
                throw error
            })
            this._pending.set(key, pending)
        }
        return pending
    }

    _remember(key: string, translated: string) {
        if(this._cache.size > 400){
            this._cache.delete(this._cache.keys().next().value as string)
        }
        this._cache.set(key, translated)
    }

    // ----------------------------------------------------------------------------------------------- showing

    /** What is on screen: the translations of the elements that have one. It is passed on only when it has changed. */
    _emit() {
        const settings = this._options.getSettings()
        const results: ElementResult[] = []

        for(const element of this._elements){
            if(element.state !== 'text' || element.segments.length === 0){
                continue
            }
            const segments: TranslatedSegment[] = element.segments.map(segment => ({
                original: segment.original, translated: segment.translated, rect: segment.rect, lineHeight: segment.lineHeight,
                background: segment.background, foreground: segment.foreground, centered: segment.centered, shownAt: segment.shownAt,
            }))
            results.push({
                id: element.id,
                role: element.role,
                result: {
                    original: segments.map(segment => segment.original).join(' '),
                    translated: segments.map(segment => segment.translated).join('\n'),
                    segments,
                    ...(settings.panels !== false && element.panel !== undefined ? { bounds: element.panel } : {}),
                },
            })
        }

        const key = JSON.stringify(results.map(item => [item.id, item.result.translated, item.result.segments.map(segment => [Math.round(segment.rect.x * 1000), Math.round(segment.rect.y * 1000), Math.round(segment.rect.w * 1000)])]))
        if(key !== this._lastKey){
            this._lastKey = key
            this._options.onResults(results)
        }
    }

    _report() {
        if(this._options.onFrames === undefined){
            return
        }

        const frames: AutoFrame[] = this._elements.filter(element => element.missed === 0).map((element, index) => ({
            rect: element.rect,
            role: element.role,
            state: element.state === 'text' ? 'text' : (element.state === 'dead' ? 'rejected' : (element.reading || element.dirty ? 'reading' : (element.state === 'idle' ? 'idle' : 'candidate'))),
            slot: index,
            plate: element.plate,
        }))
        this._options.onFrames(frames)
    }

    /** How much of the place of an element the text of a reading covers (0..1). */
    _coverage(element: Element, reading: { segments: Array<{ rect: { x: number; y: number; w: number; h: number } }> }, video: HTMLVideoElement, box: { width: number; height: number }, fit: FitMode): number {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
        for(const segment of reading.segments){
            const screen = videoRectToScreen(video.videoWidth, video.videoHeight, box.width, box.height, fit, segment.rect)
            x0 = Math.min(x0, screen.x)
            y0 = Math.min(y0, screen.y)
            x1 = Math.max(x1, screen.x + screen.w)
            y1 = Math.max(y1, screen.y + screen.h)
        }
        const area = element.rect.w * element.rect.h
        if(area <= 0 || x1 <= x0 || y1 <= y0){
            return 1
        }
        return Math.min(1, ((x1 - x0) * (y1 - y0)) / area)
    }

    /** What every element is doing (for tests). */
    getDebug(): string[] {
        return this._elements.map(element => '#' + element.id + ' ' + element.state + ' ' + element.role + ' seen' + element.seen + ' miss' + element.missed + ' x' + element.rect.x.toFixed(2) + ' y' + element.rect.y.toFixed(2) + ' w' + element.rect.w.toFixed(2) + ' ' + (element.segments.map(segment => segment.original).join(' / ') || '-'))
    }

    /** How many elements there are (for the debug view). */
    getCount(): number {
        return this._elements.length
    }
}
