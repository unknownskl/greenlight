import TranslatorEngine, { EngineStatus, Polarity, TextColor, TranslatorResult } from './engine'
import { Region, FitMode, DEFAULT_REGION, clampRegion, regionToSource, videoRectToScreen, regionsOverlap } from './geometry'
import { BlockRole, findTextBlocks } from './scout'

/**
 * The adaptive translator: instead of windows that the player places by hand, a scout looks at the whole picture every
 * now and then, finds the places that look like text (subtitles, messages, notes), and gives each of them (a few at
 * a time) to a text reader of its own. A place where nothing readable turns up is put on a list and left alone for a
 * while (longer every time); a place where text was translated before is trusted faster the next time.
 */

export const MAX_AUTO_WINDOWS = 3

export interface AutoFrame {
    rect: Region;
    role: BlockRole;
    // candidate: found, waiting for its turn; reading: has a window, nothing translated yet; text: shows a translation;
    // idle: has a window, text is gone; rejected: nothing readable there, ignored for a while
    state: 'candidate' | 'reading' | 'text' | 'idle' | 'rejected';
    slot?: number;
    // On a plate (a panel of the interface), and a window that holds a steady text (a task list)
    plate?: boolean;
    steady?: boolean;
}

export interface AutoOptions {
    getVideo: () => HTMLVideoElement | null;
    getBox: () => { width: number; height: number };
    getSettings: () => { fit: FitMode; source: string; target: string; color: TextColor };
    // The windows the player has placed himself: the scout leaves those places alone
    getManualRegions: () => Region[];
    translate: (text: string, target: string, source: string) => Promise<string>;
    onResult: (slot: number, result: TranslatorResult | null) => void;
    onFrames?: (frames: AutoFrame[]) => void;
}

// How often the whole picture is looked at (the look costs some milliseconds, so it is never more than a tenth of the time)
const SCAN_MS = 700
const IDLE_SCAN_MS = 1200
const SCAN_WIDTH = 720

// A block has to be seen on this many looks in a row before it gets a window. A subtitle (the place is known) at once;
// a message in a corner, or any text on a plate, twice; other text (it may be a sign in the world) four times.
// Text that is dark on a light background needs one more look (more false alarms). A place where text was translated
// before is trusted at once.
const NEED_SUBTITLE = 1
const NEED_NOTICE = 2
const NEED_PLATE = 2
const NEED_OTHER = 4

// A window that has not seen its text for this long is given away (a translation that is still shown is never taken away)
const HOLD_MS = 8000
// A window that has not read anything in this time (from the moment the text reader is ready) was a false alarm
const REJECT_MS = 7000
// A false alarm is left alone for this long, twice as long every time it happens again (but not longer than IGNORE_MAX_MS)
const IGNORE_MS = 25000
const IGNORE_MAX_MS = 300000
// A place where text was translated is remembered for this long
const GOOD_MS = 600000
// A window grows when its text has grown out of it on two looks in a row, but not more often than this
const GROW_MS = 3000
// A window whose translation has not changed for this long holds a steady text (a task list): it is handled like a
// window of the "Tasks" kind (a different reading has to be seen twice, and the text is not read again and again);
// it goes back to lines that come and go when its translation changes this often
const STEADY_MS = 8000
const BUSY_CHANGES = 3
const BUSY_WINDOW_MS = 15000

interface Track {
    rect: Region;
    role: BlockRole;
    polarity: Polarity;
    plate: boolean;
    streak: number;
    score: number;
}

interface Slot {
    region: Region | null;
    polarity: Polarity;
    role: BlockRole;
    mode: 'dialog' | 'task';
    // Another number for every new place the window is given to (a window that only grows keeps its number)
    epoch: number;
    // When the window was given out / when its text was last seen / when it last grew
    since: number;
    lastSeen: number;
    grownAt: number;
    // On how many looks in a row the text has been sticking out of the window
    outside: number;
    // A translation is on screen now (since when) / there has been one / the translations that were shown, and when they changed
    shown: boolean;
    shownSince: number;
    everShown: boolean;
    lastText: string;
    changes: number[];
    plate: boolean;
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

function union(a: Region, b: Region): Region {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}

export default class AutoWindows {

    _options: AutoOptions
    _running = false
    _timer: ReturnType<typeof setTimeout> | undefined
    _engines: TranslatorEngine[] = []
    _starters: ReturnType<typeof setTimeout>[] = []
    _slots: Slot[] = []
    _tracks: Track[] = []
    _ignored: Array<{ rect: Region; until: number; strikes: number }> = []
    _good: Array<{ rect: Region; until: number }> = []
    // Translations are shared by all the windows (a text that comes back in another window is not translated again)
    _cache: Map<string, string> = new Map()
    _translating: Map<string, Promise<string>> = new Map()
    // The text reader is ready (until then nothing counts as a false alarm)
    _ready = false
    _canvas = document.createElement('canvas')
    _scanTook = 0

    constructor(options: AutoOptions) {
        this._options = options

        for(let index = 0; index < MAX_AUTO_WINDOWS; index++){
            this._slots.push({
                region: null, polarity: 'light', role: 'other', mode: 'dialog', epoch: 0, since: 0, lastSeen: 0, grownAt: 0, outside: 0,
                shown: false, shownSince: 0, everShown: false, lastText: '', changes: [], plate: false,
            })
        }
    }

    start() {
        if(this._running){
            return
        }
        this._running = true

        for(let index = 0; index < MAX_AUTO_WINDOWS; index++){
            const engine = new TranslatorEngine({
                getVideo: this._options.getVideo,
                getBox: this._options.getBox,
                getConfig: () => {
                    const slot = this._slots[index]
                    const settings = this._options.getSettings()
                    return {
                        region: slot.region ?? DEFAULT_REGION,
                        enabled: slot.region !== null,
                        mode: slot.mode,
                        color: slot.polarity,
                        source: settings.source,
                        target: settings.target,
                        fit: settings.fit,
                        soft: true,
                        epoch: slot.epoch,
                    }
                },
                translate: (text, target, source) => this._translate(text, target, source),
                onResult: (result) => this._onResult(index, result),
                onStatus: (status: EngineStatus) => {
                    if(status === 'ready'){
                        this._ready = true
                    }
                },
            })

            this._engines.push(engine)
            // Not all at once: the readers take turns on the processor
            this._starters.push(setTimeout(() => engine.start(), index * 250))
        }

        this._timer = setTimeout(() => this._scan(), 500)
    }

    stop() {
        this._running = false
        if(this._timer !== undefined){
            clearTimeout(this._timer)
            this._timer = undefined
        }
        this._starters.forEach(timer => clearTimeout(timer))
        this._starters = []
        this._engines.forEach(engine => engine.stop())
        this._engines = []

        for(let index = 0; index < this._slots.length; index++){
            this._slots[index].region = null
            this._slots[index].shown = false
            this._options.onResult(index, null)
        }
        this._tracks = []
        this._ignored = []
        this._good = []
        this._cache.clear()
        this._translating.clear()
        this._options.onFrames?.([])
    }

    _translate(text: string, target: string, source: string): Promise<string> {
        const key = source + '|' + target + '|' + text
        const known = this._cache.get(key)
        if(known !== undefined){
            return Promise.resolve(known)
        }

        let pending = this._translating.get(key)
        if(pending === undefined){
            pending = this._options.translate(text, target, source).then((translated) => {
                this._translating.delete(key)
                if(this._cache.size > 300){
                    this._cache.delete(this._cache.keys().next().value as string)
                }
                this._cache.set(key, translated)
                return translated
            }, (error) => {
                this._translating.delete(key)
                throw error
            })
            this._translating.set(key, pending)
        }
        return pending
    }

    _onResult(index: number, result: TranslatorResult | null) {
        const slot = this._slots[index]
        const now = Date.now()
        const shown = result !== null && result.segments.length > 0
        const text = shown ? result!.segments.map(segment => segment.translated).join('|') : ''

        if(shown){
            if(!slot.shown){
                slot.shownSince = now
            } else if(text !== slot.lastText){
                slot.changes.push(now)
            }

            // A place where text was translated is trusted more from now on
            if(!slot.everShown && slot.region !== null){
                this._good.push({ rect: slot.region, until: now + GOOD_MS })
            }
            slot.everShown = true
        } else {
            slot.shownSince = 0
        }

        slot.shown = shown
        slot.lastText = text
        this._options.onResult(index, result)
    }

    _scan() {
        if(!this._running){
            return
        }

        const began = Date.now()
        try {
            this._scanOnce()
        } catch(error) {
            console.warn('Translator: scan failed:', error)
        }
        this._scanTook = Date.now() - began

        if(this._running){
            const quiet = this._tracks.length === 0 && this._slots.every(slot => slot.region === null)
            // A slow look is repeated less often
            this._timer = setTimeout(() => this._scan(), Math.max(quiet ? IDLE_SCAN_MS : SCAN_MS, this._scanTook * 10))
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

        const width = Math.min(SCAN_WIDTH, Math.round(visible.sw))
        const height = Math.max(8, Math.round(width * visible.sh / visible.sw))
        this._canvas.width = width
        this._canvas.height = height
        const context = this._canvas.getContext('2d', { willReadFrequently: true })
        if(context === null){
            return
        }
        context.drawImage(video, visible.sx, visible.sy, visible.sw, visible.sh, 0, 0, width, height)
        const pixels = context.getImageData(0, 0, width, height).data

        const polarities: Polarity[] = ['light', 'dark']
        const blocks = findTextBlocks(pixels, width, height, polarities)

        const now = Date.now()
        const manual = this._options.getManualRegions()
        this._ignored = this._ignored.filter(item => item.until + IGNORE_MAX_MS * 2 > now)
        this._good = this._good.filter(item => item.until > now)

        // Where on the screen (fractions of the stream area) each block is
        const found: Track[] = []
        for(const block of blocks){
            const rect = videoRectToScreen(video.videoWidth, video.videoHeight, box.width, box.height, settings.fit, {
                x: visible.sx + block.x * visible.sw,
                y: visible.sy + block.y * visible.sh,
                w: block.w * visible.sw,
                h: block.h * visible.sh,
            })

            // The player's own windows take care of their places
            if(manual.some(region => region.enabled !== false && inside(rect, region) > 0.2)){
                continue
            }

            const previous = this._tracks.find(track => track.polarity === block.polarity && inside(rect, track.rect) > 0.6 && inside(track.rect, rect) > 0.4)
            found.push({ rect, role: block.role, polarity: block.polarity, plate: block.plate, streak: (previous?.streak ?? 0) + 1, score: block.score })
        }
        this._tracks = found

        this._update(found, manual, now)
        this._report(found)
    }

    _isGood(rect: Region): boolean {
        return this._good.some(item => inside(rect, item.rect) > 0.5)
    }

    _isIgnored(rect: Region, now: number): boolean {
        return this._ignored.some(item => item.until > now && inside(rect, item.rect) > 0.5)
    }

    _need(track: Track): number {
        if(this._isGood(track.rect)){
            return 1
        }

        let need = track.role === 'subtitle' ? NEED_SUBTITLE : (track.role === 'notice' ? NEED_NOTICE : (track.plate ? NEED_PLATE : NEED_OTHER))
        if(track.role === 'subtitle' && track.plate){
            need = 1
        }
        return need + (track.polarity === 'dark' ? 1 : 0)
    }

    _update(found: Track[], manual: Region[], now: number) {
        // 1. Windows that have their text in sight
        const claimed = new Set<Track>()
        this._slots.forEach((slot) => {
            if(slot.region === null){
                return
            }

            let sticking = false
            for(const track of found){
                if(inside(track.rect, slot.region) < 0.5){
                    continue
                }

                claimed.add(track)
                slot.lastSeen = now

                // The text has grown out of the window (a longer subtitle, one more line)
                if(inside(track.rect, slot.region) < 0.85){
                    sticking = true
                    if(slot.outside >= 1 && now - slot.grownAt >= GROW_MS){
                        const grown = this._place(union(slot.region, track.rect), track.role, track.plate, manual, slot)
                        if(grown !== null){
                            slot.region = grown
                            slot.grownAt = now
                            slot.outside = 0
                        }
                    }
                }
            }
            slot.outside = sticking ? slot.outside + 1 : 0
        })

        // 2. Windows that are no longer needed, and the kind of text a window holds
        this._slots.forEach((slot, index) => {
            if(slot.region === null){
                return
            }

            // A steady text (nothing has changed in it for a while) is kept calmly, lines that come and go are watched closely
            slot.changes = slot.changes.filter(time => now - time < BUSY_WINDOW_MS)
            if(slot.role !== 'subtitle'){
                if(slot.mode === 'dialog' && slot.shown && now - slot.shownSince >= STEADY_MS && slot.changes.length === 0){
                    slot.mode = 'task'
                } else if(slot.mode === 'task' && slot.changes.length >= BUSY_CHANGES){
                    slot.mode = 'dialog'
                }
            }

            if(!this._ready){
                // Nothing can be read yet, so nothing can be judged
                slot.since = now
                return
            }

            if(!slot.everShown && !slot.shown && now - slot.since >= REJECT_MS){
                // Nothing readable was there: leave the place alone for a while, longer if it happens again
                const old = this._ignored.find(item => inside(slot.region as Region, item.rect) > 0.5 || inside(item.rect, slot.region as Region) > 0.5)
                const strikes = (old?.strikes ?? 0) + 1
                const until = now + Math.min(IGNORE_MAX_MS, IGNORE_MS * Math.pow(2, strikes - 1))
                if(old !== undefined){
                    old.until = until
                    old.strikes = strikes
                } else {
                    this._ignored.push({ rect: slot.region, until, strikes })
                }
                this._release(index)
            } else if(!slot.shown && now - slot.lastSeen >= HOLD_MS){
                this._release(index)
            }
        })

        // 3. New text: the most text-like first
        const fresh = found
            .filter(track => !claimed.has(track) && !this._isIgnored(track.rect, now) && track.streak >= this._need(track))
            .sort((a, b) => this._priority(b) - this._priority(a))

        for(const track of fresh){
            // Already covered by a window that was made for something else (two blocks of one text)
            if(this._slots.some(slot => slot.region !== null && inside(track.rect, slot.region) > 0.5)){
                continue
            }

            let index = this._slots.findIndex(slot => slot.region === null)
            if(index < 0){
                index = this._victim(now)
            }
            if(index < 0){
                break
            }

            const region = this._place(track.rect, track.role, track.plate, manual, this._slots[index])
            if(region === null){
                continue
            }

            const slot = this._slots[index]
            slot.region = region
            slot.polarity = track.polarity
            slot.role = track.role
            // Text that is not a subtitle or a message is usually a steady interface (names, tasks, menus)
            slot.mode = track.role === 'other' ? 'task' : 'dialog'
            slot.epoch++
            slot.since = now
            slot.lastSeen = now
            slot.grownAt = now
            slot.outside = 0
            slot.shown = false
            slot.shownSince = 0
            slot.everShown = false
            slot.lastText = ''
            slot.changes = []
            slot.plate = track.plate
        }
    }

    _priority(track: Track): number {
        return track.score * (track.role === 'subtitle' ? 2 : (track.role === 'notice' ? 1.4 : 1)) * (this._isGood(track.rect) ? 2 : 1)
    }

    // A window that can be given to somebody else: one that has translated nothing, or one whose text is gone for good
    _victim(now: number): number {
        let best = -1
        let bestAge = 0

        this._slots.forEach((slot, index) => {
            if(slot.region === null || slot.shown){
                return
            }

            const quiet = now - slot.lastSeen
            const age = slot.everShown ? quiet : quiet + 3000
            if(quiet >= 2500 && age > bestAge){
                best = index
                bestAge = age
            }
        })

        return best
    }

    _release(index: number) {
        const slot = this._slots[index]
        slot.region = null
        slot.shown = false
        slot.everShown = false
    }

    /**
     * The window for a block of text: a little bigger than the text (so it hardly ever has to grow), and for subtitles
     * wide (the next line may be longer). Never over a window of the player or over another automatic window.
     */
    _place(rect: Region, role: BlockRole, plate: boolean, manual: Region[], own: Slot): Region | null {
        const padX = role === 'subtitle' ? 0.02 : 0.03
        const padY = Math.min(0.035, Math.max(0.015, rect.h * 0.6))

        const wide = role === 'subtitle'
            ? { x: Math.min(rect.x - padX, 0.2), y: rect.y - padY - rect.h * 0.5, w: 0, h: rect.h * 2 + 2 * padY }
            : { x: rect.x - padX, y: rect.y - padY, w: 0, h: rect.h + 2 * padY }
        wide.w = (role === 'subtitle' ? Math.max(rect.x + rect.w + padX, 0.8) : rect.x + rect.w + padX) - wide.x

        const tight = { x: rect.x - padX / 2, y: rect.y - padY / 2, w: rect.w + padX, h: rect.h + padY }
        const others = manual.filter(region => region.enabled !== false)
            .concat(this._slots.filter(slot => slot !== own && slot.region !== null).map(slot => slot.region as Region))

        for(const wanted of [wide, tight, rect]){
            const region = clampRegion(wanted)
            if(!others.some(other => regionsOverlap(region, other))){
                return region
            }
        }

        return null
    }

    _report(found: Track[]) {
        if(this._options.onFrames === undefined){
            return
        }

        const now = Date.now()
        const frames: AutoFrame[] = []

        this._slots.forEach((slot, index) => {
            if(slot.region !== null){
                frames.push({ rect: slot.region, role: slot.role, slot: index, plate: slot.plate, steady: slot.mode === 'task', state: slot.shown ? 'text' : (slot.everShown ? 'idle' : 'reading') })
            }
        })

        for(const track of found){
            if(!this._slots.some(slot => slot.region !== null && inside(track.rect, slot.region) > 0.5)){
                frames.push({ rect: track.rect, role: track.role, plate: track.plate, state: this._isIgnored(track.rect, now) ? 'rejected' : 'candidate' })
            }
        }

        this._options.onFrames(frames)
    }
}
