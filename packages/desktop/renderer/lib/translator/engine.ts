import { Region, FitMode, clampRegion, regionToSource, videoRectToScreen, SourceRect } from './geometry'
import { getOcrWorker, recognizeCanvas, OcrLine } from './ocr'

export type TextColor = 'light' | 'dark' | 'auto'
export type Polarity = 'light' | 'dark'

export type EngineStatus = 'loading' | 'ready' | 'error'

export interface TranslatorConfig {
    region: Region;
    // A window that is turned off reads nothing and shows nothing
    enabled?: boolean;
    // 'task': a steady interface that sways with the camera (tasks): it is not hidden while the picture moves and a
    // different reading must be seen twice before it replaces what is shown. 'dialog': lines that come and go.
    mode?: 'dialog' | 'task';
    color: TextColor;
    // Language of the text in the game (what the text reader reads) and the language to translate it into
    source: string;
    target: string;
    fit: FitMode;
    // A window that is made bigger (not moved) keeps what it shows when `soft` is set; another `epoch` is another window
    soft?: boolean;
    epoch?: number;
    // The window is the whole screen: its text is read as a page (text of different sizes in different places)
    fullScreen?: boolean;
    // Where the text of the screen is (fractions of the stream area): the whole screen is then read piece by piece, each piece
    // enlarged like a window of its own, instead of in one go (small text is lost when a whole screen is read at once)
    tiles?: Region[];
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
    // When it was put on screen (the newer of two translations that overlap stays)
    shownAt?: number;
}

export interface TranslatorResult {
    original: string;
    translated: string;
    segments: TranslatedSegment[];
    // The panel of the interface the text is in (the translation is fitted into it), when it is known
    bounds?: Region;
}

/**
 * A translation that is there at once and may get better: `better` answers with a better text (or null) a moment
 * later, and the text that is on screen is replaced then.
 */
export interface Translation {
    text: string;
    better?: Promise<string | null>;
}

export type TranslateFunction = (text: string, target: string, source: string) => Promise<string | Translation>

export interface EngineOptions {
    getVideo: () => HTMLVideoElement | null;
    // Size of the area the video is shown in (the window)
    getBox: () => { width: number; height: number };
    getConfig: () => TranslatorConfig;
    translate: TranslateFunction;
    onResult: (result: TranslatorResult | null) => void;
    onStatus: (status: EngineStatus) => void;
    // Who goes first when several windows wait for the text reader (higher first; the default is 1)
    priority?: number;
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

// The picture that is given to the text reader has at most this many pixels (it heats the processor)
const MAX_OCR_PIXELS = 1300000

const TICK_MS = 300
// While something is going on (and for a while after) the window is looked at this often: the look is cheap
const FAST_TICK_MS = 150
const ACTIVE_MS = 4000
// A window that covers a big part of the screen is looked at less often (every look costs more)
const HEAVY_PIXELS = 600000
const FORCE_OCR_MS = 2000

// A picture is "settled" when it differs from the last look by less than this; more than MOTION_DIFFERENCE is movement
const SETTLE_DIFFERENCE = 0.12
const MOTION_DIFFERENCE = 0.35
// Snapshots waiting for the reader (memory!), how old they may get, and when two of them count as the same picture
const MAX_JOBS = 3
const BIG_SNAPSHOT_PIXELS = 1000000
const JOB_STALE_MS = 12000
const NEAR_COPY_MS = 1200
const NEAR_COPY_DIFFERENCE = 0.1
const NEAR_COPY_PROFILE = 0.05
// A new snapshot of changed text is taken at most this often
const SNAPSHOT_GAP_MS = 200
// Other words in the same place: the share of the ink that sits in other columns
const PROFILE_BINS = 128
const PROFILE_THRESHOLD = 0.14
const PROFILE_GAP_MS = 900

// Mask differences below this are shaking / noise. Different text with a similar layout can look almost the same
// on a coarse mask, so the text is also read again from time to time while it is on screen (see "recheck").
const CHANGE_THRESHOLD = 0.05

// The translation stays on screen through short gaps (video noise, a flickering interface):
// it is only hidden when no text has been seen for this many ticks in a row
const EMPTY_MS_BEFORE_HIDE = 2700
const FAILED_READS_BEFORE_HIDE = 6

// Words the text reader is less sure about than this are dropped
const MIN_CONFIDENCE = 45

// A box that moved by less than this (fraction of the stream area) is the same box: the picture only shakes
const MOVE_TOLERANCE = 0.012

// The camera is moving and the interface swings with it (text that is part of the game world): after this many
// unsettled ticks in a row the translation is hidden, and nothing is read until the picture calms down
// (or until it has been moving for MOTION_PATIENCE_MS, then it is read anyway)
const MOTION_MIN_TICKS = 2
const MOTION_MS_BEFORE_HIDE = 450
const MOTION_CALM_MS = 600
const MOTION_PATIENCE_MS = 6000

// New text that is seen right after a movement (or is very short) must be read twice before it is translated:
// a swinging, blurred interface gives different garbage on every read
const RECENT_MOTION_MS = 2000
const SHORT_TEXT = 6
const PENDING_MS = 6000

// Text that differs from what is shown in the same place, while the text pixels changed less than this since the last
// read, must be read twice before it replaces the shown text (a living background makes the reader misread)
const IN_PLACE_CHANGE = 0.22
// ... and the columns of ink (where the words are) changed less than this too: other words give another profile
const IN_PLACE_PROFILE = 0.1

// Every translated line stays on screen for a reading time (this much plus a bit per character), even when the
// original is already gone, and a line that replaces it waits its turn: when subtitles come faster than they can
// be read, they are shown one after another (a few at most) instead of losing some of them
const MIN_SHOW_MS = 2200
const SHOW_PER_CHAR_MS = 60
const MAX_SHOW_MS = 8000
const MAX_QUEUED = 5
// A line is never shown for less than this, however long the queue is
const MIN_SHOW_FLOOR_MS = 1000
const QUEUE_STALE_MS = 15000

// The more lines wait, the shorter each one stays (the reader catches up with the conversation)
function readingTime(segment: { translated: string }, waiting: number): number {
    const base = Math.min(MAX_SHOW_MS, MIN_SHOW_MS + segment.translated.length * SHOW_PER_CHAR_MS)
    const factor = waiting >= 3 ? 0.45 : (waiting === 2 ? 0.6 : (waiting === 1 ? 0.8 : 1))
    return Math.max(MIN_SHOW_FLOOR_MS, base * factor)
}

// Text pixels that are the same as at the last reading (up to this share of them) are the same text: it is not read again
// just in case, only now and then (see EXACT_RECHECK_MS)
const FINE_SAME = 0.04
// A steady text that is shown (a task, a description) is read again only when this much of its pixels is different:
// a glowing or shaking panel changes the picture a little all the time, but not the text
const STEADY_FINE_CHANGE = 0.1
// The whole screen: a line of text that comes in (a description that fades in, the next item of a list) is a small part
// of all the pixels, so even a small change is a reason to read again; it is read at most this often, less and less often
// while the readings are the same
const SCREEN_FINE_CHANGE = 0.02
const SCREEN_GAP_MS = 2000
const SCREEN_GAP_MAX_MS = 15000
// New text that waits for a second reading (see _confirm) gets it soon
const SCREEN_PENDING_GAP_MS = 1200
const EXACT_RECHECK_MS = 20000
// Text that is still where it was (the pixels of the last reading are still text pixels) is not "moving" and is not
// read again because the picture behind it changes (the camera turns, the text of the interface stays). Only text
// that is added to it (a line that is typed, a second sentence) is read: that is more ink than the last reading had.
// A draft on screen gets its better translation only within this time of appearing
const REFINE_WINDOW_MS = 900
const HELD_RETENTION = 0.8
const MIN_HELD_INK = 30
const GROWTH_SHARE = 0.2
const GROWTH_GAP_MS = 2000
// How wide a gap inside one piece of text may be (in heights of a word): a subtitle is one text, a menu has pieces
const DIALOG_WORD_GAP = 8
const TASK_WORD_GAP = 2

// A row of letters is at most this many times as tall as the (taller) words in it
const WORD_HEIGHT_CAP = 1.3

// A line that was not found by the reader this many times in a row is dropped from the screen
const MAX_MISSED_READS = 2
// The whole screen is read rarely, and a line of a menu that the reader misses once or twice is still there
const SCREEN_MAX_MISSED_READS = 5

// Built from strings: the unicode flag is not allowed by the TypeScript target of the project
const NOT_TEXT = new RegExp('[^\\p{L}\\p{N}\\s.,!?\'"’:;()\\-–—…/%&+]', 'gu')
const ALNUM = new RegExp('[\\p{L}\\p{N}]', 'gu')
const LETTER = new RegExp('\\p{L}', 'gu')
const ONLY_LETTERS = new RegExp('^\\p{L}+$', 'u')
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

/** Marks the pixels that stand out from their surroundings (see CONTRAST_MIN), for one or both kinds of text at once. */
export function inkMasks(data: Uint8ClampedArray, width: number, height: number, polarities: Polarity[]): Array<{ mask: Uint8Array; count: number }> {
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
    const results = polarities.map(() => ({ mask: new Uint8Array(pixels), count: 0 }))

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

            for(let k = 0; k < polarities.length; k++){
                const ink = polarities[k] === 'light'
                    ? (value - mean >= CONTRAST_MIN && value >= LIGHT_FLOOR)
                    : (mean - value >= CONTRAST_MIN && value <= DARK_CEIL)

                if(ink){
                    results[k].mask[y * width + x] = 1
                    results[k].count++
                }
            }
        }
    }

    return results
}

function inkMask(data: Uint8ClampedArray, width: number, height: number, polarity: Polarity): { mask: Uint8Array; count: number } {
    return inkMasks(data, width, height, [polarity])[0]
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

// Where the ink is, column by column (as shares of all the ink)
function columnProfile(mask: Uint8Array, width: number, height: number): Float32Array {
    const bins = new Float32Array(PROFILE_BINS)
    let total = 0

    for(let y = 0; y < height; y++){
        const row = y * width
        for(let x = 0; x < width; x++){
            if(mask[row + x] === 1){
                bins[Math.min(PROFILE_BINS - 1, Math.floor(x * PROFILE_BINS / width))]++
                total++
            }
        }
    }

    if(total > 0){
        for(let i = 0; i < PROFILE_BINS; i++){
            bins[i] /= total
        }
    }
    return bins
}

// 0 (same distribution of ink) .. 1 (nothing in common)
function profileDifference(a: Float32Array, b: Float32Array): number {
    let sum = 0
    for(let i = 0; i < a.length; i++){
        sum += Math.abs(a[i] - b[i])
    }
    return sum / 2
}

// A single letter that is not a word of its own ("a", "I") is an icon or a speck, not text
function isStrayLetter(token: string): boolean {
    // A letter that is not a word of its own, or "OO" / "QO" (an icon read as letters)
    return (token.length === 1 && /[A-Za-z]/.test(token) && token !== 'a' && token !== 'A' && token !== 'I')
        || /^[OQ0][OQ0]$/.test(token)
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

        // A short word in small letters in front of (or behind) a line in capitals ("ss LIZ RETURNS") is an icon
        const restIsCapitals = (rest: string[]): boolean => {
            const letters: string[] = rest.join('').match(LETTER) || []
            return letters.length >= 3 && letters.filter(letter => letter !== letter.toLowerCase()).length / letters.length >= 0.9
        }
        const isBracketJunk = (token: string): boolean => token.length <= 4 && /^[^()]*\)$|^\([^()]*$/.test(token) && tokens.length >= 3
        const isSmallJunk = (token: string, rest: string[]): boolean => token.length <= 2 && token === token.toLowerCase() && ONLY_LETTERS.test(token) && restIsCapitals(rest)

        while(tokens.length >= 2 && (isStrayLetter(tokens[0]) || isBracketJunk(tokens[0]) || isSmallJunk(tokens[0], tokens.slice(1)))){
            tokens.shift()
        }
        while(tokens.length >= 2 && (isStrayLetter(tokens[tokens.length - 1]) || isBracketJunk(tokens[tokens.length - 1]) || isSmallJunk(tokens[tokens.length - 1], tokens.slice(0, -1)))){
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
 * True when `next` is the line `old` with more text (a subtitle that was caught while it was still being typed, or
 * while one more line was fading in): the old line is then only a part of the new one and must not be shown on its own.
 */
export function extendsText(old: string, next: string): boolean {
    if(old.length < 6 || next.length < old.length * 1.2 + 2 || next.length > 400){
        return false
    }
    return substringDistance(old, next) <= old.length * 0.15
}

/** The share of the text pixels of two pictures that has no counterpart (within one pixel) in the other picture. */
function fineDifference(a: Uint8Array, b: Uint8Array, width: number, height: number): number {
    const grow = (mask: Uint8Array): Uint8Array => {
        const wide = new Uint8Array(mask.length)
        for(let y = 0; y < height; y++){
            for(let x = 0; x < width; x++){
                if(mask[y * width + x] === 1){
                    for(let dy = -1; dy <= 1; dy++){
                        const yy = y + dy
                        if(yy < 0 || yy >= height){ continue }
                        for(let dx = -1; dx <= 1; dx++){
                            const xx = x + dx
                            if(xx >= 0 && xx < width){ wide[yy * width + xx] = 1 }
                        }
                    }
                }
            }
        }
        return wide
    }

    const wideA = grow(a)
    const wideB = grow(b)
    let total = 0
    let lost = 0
    for(let i = 0; i < a.length; i++){
        if(a[i] === 1){
            total++
            if(wideB[i] === 0){ lost++ }
        }
        if(b[i] === 1){
            total++
            if(wideA[i] === 0){ lost++ }
        }
    }
    return total === 0 ? 0 : lost / total
}

/** The pixels of the text itself (not of the picture behind it) at the last reading, and the box around them. */
interface TextInk {
    polarity: Polarity;
    mask: Uint8Array;
    width: number;
    height: number;
    box: { x0: number; y0: number; x1: number; y1: number };
}

/** Keeps the text pixels of `fine` that lie inside the boxes of the lines that were read. */
function textInkOf(polarity: Polarity, fine: Uint8Array, width: number, height: number, boxes: Array<{ x0: number; y0: number; x1: number; y1: number }>): TextInk | null {
    const mask = new Uint8Array(fine.length)
    const box = { x0: width, y0: height, x1: -1, y1: -1 }
    let ink = 0

    for(const wanted of boxes){
        const top = Math.max(0, Math.floor(wanted.y0) - 1)
        const bottom = Math.min(height - 1, Math.ceil(wanted.y1) + 1)
        const left = Math.max(0, Math.floor(wanted.x0) - 1)
        const right = Math.min(width - 1, Math.ceil(wanted.x1) + 1)
        for(let y = top; y <= bottom; y++){
            for(let x = left; x <= right; x++){
                const i = y * width + x
                if(fine[i] === 1 && mask[i] === 0){
                    mask[i] = 1
                    ink++
                    box.x0 = Math.min(box.x0, x)
                    box.y0 = Math.min(box.y0, y)
                    box.x1 = Math.max(box.x1, x)
                    box.y1 = Math.max(box.y1, y)
                }
            }
        }
    }

    return ink >= MIN_HELD_INK ? { polarity, mask, width, height, box } : null
}

/**
 * How much of the text pixels of the last reading is still there (within one pixel), and how much new ink there is
 * around the text (to its sides and above / below it) that was there at the look before as well, as a share of the text pixels. Ink somewhere else in the window
 * (the picture behind the text, which changes when the camera turns) is neither.
 */
function fineHold(text: TextInk, now: Uint8Array, before: Uint8Array | null): { kept: number; extra: number } {
    const { width, height, mask, box } = text
    const near = (other: Uint8Array, x: number, y: number): boolean => {
        for(let dy = -1; dy <= 1; dy++){
            const yy = y + dy
            if(yy < 0 || yy >= height){ continue }
            for(let dx = -1; dx <= 1; dx++){
                const xx = x + dx
                if(xx >= 0 && xx < width && other[yy * width + xx] === 1){ return true }
            }
        }
        return false
    }

    let ink = 0
    let kept = 0
    for(let y = box.y0; y <= box.y1; y++){
        for(let x = box.x0; x <= box.x1; x++){
            if(mask[y * width + x] === 1){
                ink++
                // The very same pixel: a different text in the same place has other letters, and hardly keeps a third of them
                if(now[y * width + x] === 1){ kept++ }
            }
        }
    }

    const reachX = Math.max(24, Math.round((box.x1 - box.x0) * 0.5))
    const reachY = Math.max(6, Math.round((box.y1 - box.y0) * 0.8))
    let extra = 0
    for(let y = Math.max(0, box.y0 - reachY); y <= Math.min(height - 1, box.y1 + reachY); y++){
        for(let x = Math.max(0, box.x0 - reachX); x <= Math.min(width - 1, box.x1 + reachX); x++){
            const inside = x >= box.x0 - 1 && x <= box.x1 + 1 && y >= box.y0 - 1 && y <= box.y1 + 1
            const i = y * width + x
            if(!inside && now[i] === 1 && (before === null || before[i] === 1)){
                extra++
            }
        }
    }

    return { kept: ink === 0 ? 1 : kept / ink, extra: ink === 0 ? 0 : extra / ink }
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
    // How sure the reader was about the picture (0..100)
    confidence: number;
}

interface ShownSegment extends TranslatedSegment {
    template: string;
    // In how many reads in a row this line was not found (it stays on screen for a couple of reads, see MAX_MISSED_READS)
    missed: number;
    // When it was put on screen (or into the queue)
    shownAt: number;
}

/** A copy of the window at one moment, waiting for the reader. */
interface Snapshot {
    canvas: HTMLCanvasElement;
    source: SourceRect;
    box: { width: number; height: number };
    config: TranslatorConfig;
    at: number;
    generation: number;
    polarities: Polarity[];
    // The text pixels at that moment (coarse): two snapshots with the same mask are the same picture
    masks: Partial<Record<Polarity, Uint8Array>>;
    profiles: Partial<Record<Polarity, Float32Array>>;
    fines: Partial<Record<Polarity, Uint8Array>>;
    sig: { width: number; height: number };
    // How much the text pixels differed from the snapshot before (coarse mask, and the columns of ink)
    changeAmount: number;
    profileAmount: number;
    // How far the window had been carried along with its text (see _shiftBy) when the snapshot was taken
    shift: { x: number; y: number };
}

// Are two snapshots the same picture (the second one is only a better moment of the same line)?
function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
    for(const polarity of b.polarities){
        const first = a.masks[polarity]
        const second = b.masks[polarity]
        const firstProfile = a.profiles[polarity]
        const secondProfile = b.profiles[polarity]
        if(first === undefined || second === undefined || first.length !== second.length || firstProfile === undefined || secondProfile === undefined){
            return false
        }
        if(maskDifference(first, second) >= NEAR_COPY_DIFFERENCE || profileDifference(firstProfile, secondProfile) >= NEAR_COPY_PROFILE){
            return false
        }
    }
    return true
}

// New text that waits for a second reading before it is translated
/**
 * Two translations never lie on top of each other: of two that overlap the newer one stays (the older one is out of
 * date), unless the newer one is only a small piece of the older one (a fragment of the same line): then the whole
 * line stays.
 */
export function dropCovered<T extends { rect: Region; shownAt?: number }>(segments: T[]): T[] {
    const area = (segment: T) => segment.rect.w * segment.rect.h
    const order = segments.map((segment, index) => ({ segment, index })).sort((a, b) => (b.segment.shownAt ?? 0) - (a.segment.shownAt ?? 0) || a.index - b.index)
    let kept: Array<{ segment: T; index: number }> = []

    for(const item of order){
        const conflicts = kept.filter(other => overlapShare(item.segment.rect, other.segment.rect) > 0.4)
        if(conflicts.length === 0){
            kept.push(item)
        } else if(conflicts.every(other => area(other.segment) * 2.5 < area(item.segment))){
            kept = kept.filter(other => conflicts.indexOf(other) < 0)
            kept.push(item)
        }
    }
    return kept.sort((a, b) => a.index - b.index).map(item => item.segment)
}

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

    // Since when nothing that looks like text has been seen (0: text is there)
    _emptySince = 0
    _failedReads = 0
    _prevMask: Partial<Record<Polarity, Uint8Array>> = {}
    _readMask: Partial<Record<Polarity, Uint8Array>> = {}
    _readProfile: Partial<Record<Polarity, Float32Array>> = {}
    // The text pixels (fine) at the last reading: if they are still the same, the text is the same
    _readFine: Partial<Record<Polarity, { mask: Uint8Array; width: number; height: number }>> = {}
    // Only the pixels of the text that was read (not the picture behind it), to see whether that text is still there
    _textInk: TextInk | null = null
    _grownTicks = 0
    _prevFine: Uint8Array | null = null
    _identity = ''
    // The window as it was at the last look, and how far it has been carried along with its text since the start
    _region: Region | null = null
    _shift = { x: 0, y: 0 }
    // Snapshots that wait for the reader, and whether the reader is busy
    _jobs: Snapshot[] = []
    _working = false
    _activeUntil = 0
    _taskMode = false
    _heavy = false
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
    _lastMovingAt = 0
    _enabled = true
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
        this._dropJobs()
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
        this._readProfile = {}
        this._readFine = {}
        this._textInk = null
        this._grownTicks = 0
        this._shift = { x: 0, y: 0 }
        this._hasReadMask = false
        this._emptySince = 0
        this._activeUntil = 0
        this._dropJobs()
        this._failedReads = 0
        this._sameCount = 0
        this._retryAt = 0
        this._pending = []
        this._unstableTicks = 0
        this._unstableSince = 0
        this._lastUnstableAt = 0
        this._lastMovingAt = 0
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
            this._schedule(this._nextDelay())
        }
    }

    /** How long to wait before the next look at the picture: short while something happens, longer while nothing does. */
    _nextDelay(): number {
        if(!this._enabled){
            return 1000
        }

        // A steady interface is looked at calmly; text that comes and goes is watched closely while it is going on
        const busy = this._working || this._jobs.length > 0 || this._queue.length > 0 || Date.now() < this._activeUntil
        if(busy && !this._taskMode){
            return this._heavy ? 220 : FAST_TICK_MS
        }

        const emptyFor = this._emptySince === 0 ? 0 : Date.now() - this._emptySince
        if(emptyFor >= 12000){
            return this._heavy ? 800 : 600
        }
        if(emptyFor >= 2400){
            return this._heavy ? 500 : 400
        }
        if(this._sameCount >= 4){
            return this._heavy ? 450 : 350
        }
        return TICK_MS
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

    /**
     * The "photographer": looks at the window often and cheaply. It only compares the text pixels; when a new line has
     * appeared and settled it takes a snapshot of the window and puts it into a short line for the reader (see _pump),
     * and goes on watching. So a line that is on screen for a fraction of a second is not lost while the previous one is read.
     */
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

        this._enabled = config.enabled !== false
        if(config.enabled === false){
            if(this._shown.length > 0 || this._held.length > 0 || this._queue.length > 0 || this._jobs.length > 0){
                this._clearShown(true)
                this._dropJobs()
            }
            // Start over when it is turned on again
            this._regionKey = ''
            this._identity = ''
            this._hasReadMask = false
            return
        }
        const taskMode = config.mode === 'task'
        const fullScreen = config.fullScreen === true
        this._taskMode = taskMode

        // The window was moved: start over
        const identity = [config.fit, config.color, config.epoch ?? 0].join('|')
        const regionKey = [region.x, region.y, region.w, region.h].map(v => v.toFixed(4)).join('|')
        if(identity !== this._identity || (regionKey !== this._regionKey && config.soft !== true)){
            this._identity = identity
            this._regionKey = regionKey
            this._region = region
            this.reset()
        } else if(regionKey !== this._regionKey){
            const before = this._region
            this._regionKey = regionKey
            this._region = region

            if(before !== null && Math.abs(before.w - region.w) < 1e-4 && Math.abs(before.h - region.h) < 1e-4){
                // The window moved with its text (a floating text): the pictures are still comparable, and what is
                // shown moves along, so nothing has to be read again
                this._shiftBy(region.x - before.x, region.y - before.y)
            } else {
                // The window only grew: what is shown stays, but the pictures of the old size cannot be compared
                this._prevMask = {}
                this._readMask = {}
                this._readProfile = {}
                this._readFine = {}
                this._textInk = null
                this._hasReadMask = false
                this._sameCount = 0
            }
        }

        const box = this._options.getBox()
        const source = regionToSource(video.videoWidth, video.videoHeight, box.width, box.height, config.fit, region)
        if(source === null){
            return
        }
        this._heavy = source.sw * source.sh > HEAVY_PIXELS

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
                return {
                    polarity,
                    fine: fine.mask,
                    mask: poolMask(fine.mask, width, height),
                    profile: columnProfile(fine.mask, width, height),
                    coverage: fine.count / (width * height),
                }
            })
        const present = candidates.filter(candidate => candidate.coverage >= MIN_COVERAGE && candidate.coverage <= MAX_COVERAGE)

        if(present.length === 0){
            this._prevMask = {}

            // Too much "ink" means a busy picture, not an empty one: neither hide nor read
            if(candidates.some(candidate => candidate.coverage > MAX_COVERAGE)){
                return
            }

            // Nothing that looks like text: hide the translation, but only after a longer gap
            const gone = Date.now()
            if(this._emptySince === 0){
                this._emptySince = gone
            }
            if(gone - this._emptySince >= EMPTY_MS_BEFORE_HIDE){
                this._readMask = {}
                this._readProfile = {}
                this._hasReadMask = false
                this._sameCount = 0
                this._clearShown(false)
            }
            return
        }
        this._emptySince = 0

        // 2. Has the text changed, and has it settled?
        // "settled": the picture is the same as in the last look (a line that is still fading in or being typed is not read yet)
        let settled = true
        // Unlike "settled", this is only true when the picture has really moved (not when there is nothing to compare with yet)
        let moving = false
        let appearing = false
        let changed = !this._hasReadMask
        let profileChanged = false

        for(const candidate of present){
            const previous = this._prevMask[candidate.polarity]
            if(previous === undefined || previous.length !== candidate.mask.length){
                settled = false
                appearing = true
            } else {
                const difference = maskDifference(previous, candidate.mask)
                if(difference > MOTION_DIFFERENCE){
                    moving = true
                }
                if(difference > SETTLE_DIFFERENCE){
                    settled = false
                }
            }

            const read = this._readMask[candidate.polarity]
            if(read === undefined || read.length !== candidate.mask.length || maskDifference(read, candidate.mask) >= CHANGE_THRESHOLD){
                changed = true
            } else {
                // The coarse mask forgives small shifts; the column profile sees other words in the same place
                const readProfile = this._readProfile[candidate.polarity]
                if(readProfile !== undefined && profileDifference(readProfile, candidate.profile) >= PROFILE_THRESHOLD){
                    profileChanged = true
                }
            }
        }

        this._prevMask = {}
        for(const candidate of present){
            this._prevMask[candidate.polarity] = candidate.mask
        }

        const now = Date.now()

        // Is the text of the last reading still where it was? Then the camera may turn and the picture behind it may
        // change as it likes: the text is not moving, it is not hidden and it is not read again for that.
        // Only more ink around the text (a line that is typed, another sentence) is a reason to read it again.
        let held = false
        const ink = this._textInk
        if(ink !== null && this._hasReadMask && this._shown.length > 0 && !taskMode && ink.width === width && ink.height === height){
            const candidate = present.find(item => item.polarity === ink.polarity)
            const before = this._prevFine
            this._prevFine = candidate === undefined ? null : candidate.fine
            if(candidate !== undefined){
                const hold = fineHold(ink, candidate.fine, before)
                if(hold.kept >= HELD_RETENTION){
                    held = true
                    // More ink has to be there in two looks in a row (a living background is different every time)
                    this._grownTicks = hold.extra >= GROWTH_SHARE ? this._grownTicks + 1 : 0
                    moving = false
                    settled = true
                    profileChanged = false
                    changed = this._grownTicks >= 2
                    this._unstableTicks = 0
                    this._unstableSince = 0
                    if(changed){
                        this._activeUntil = now + ACTIVE_MS
                    }
                }
            }
        }
        if(!held){
            this._grownTicks = 0
        }
        if(ink === null){
            this._prevFine = null
        }

        // A steady text that is on screen and whose pixels are almost the same as at the last reading is the same text,
        // whatever the coarse picture says: it is not read (and not translated) again
        if(taskMode && changed && !appearing && this._hasReadMask && this._shown.length > 0 && this._pixelsSame(present, width, height, fullScreen ? SCREEN_FINE_CHANGE : STEADY_FINE_CHANGE)){
            changed = false
        }

        // The whole screen: a small change in the pixels is new text (the coarse picture does not see it)
        if(fullScreen && !changed && this._hasReadMask && !this._pixelsSame(present, width, height, SCREEN_FINE_CHANGE)){
            changed = true
        }

        // A steady interface that sways with the camera is not "moving text": it keeps its translation, and the
        // readings (which differ a little every time) are voted on instead (see _confirm)
        if(taskMode){
            moving = false
            // A whole screen that is still fading in is not read yet (a busy picture behind it may never settle: see FORCE_OCR_MS)
            settled = fullScreen ? settled : true
        } else if(!held && (changed || appearing || profileChanged)){
            // Something is going on: look more often for a while
            this._activeUntil = now + ACTIVE_MS
        }

        // Words that changed in the same place may look almost the same on the coarse mask. Not for a window that
        // covers a big part of the screen: a living picture changes the profile all the time.
        if(!changed && profileChanged && !taskMode && !this._heavy && now - this._lastReadAt >= PROFILE_GAP_MS){
            changed = true
        }

        // The picture is moving: the camera turns and the interface that belongs to the game world swings with it.
        // A translation that stays where the text was would hang in the air, and the blurred text is read differently
        // every time, so the translation is hidden and nothing is read until the picture calms down.
        // (the picture is looked at several times between two changes, so the movement is only over after a calm moment)
        if(moving){
            this._unstableTicks++
            this._lastMovingAt = now
            if(this._unstableSince === 0){
                this._unstableSince = now
            }
        } else if(now - this._lastMovingAt >= MOTION_CALM_MS){
            this._unstableTicks = 0
            this._unstableSince = 0
        }

        // One changed picture is a new line of text; only a picture that keeps changing is a moving camera
        const keepsMoving = this._unstableTicks >= MOTION_MIN_TICKS && now - this._unstableSince >= MOTION_MS_BEFORE_HIDE
        if(keepsMoving){
            this._lastUnstableAt = now
        }

        // Still within the movement (no calm moment yet), also when this very picture happens to be like the last one
        const inMotion = moving || (this._unstableTicks >= MOTION_MIN_TICKS && now - this._lastMovingAt < MOTION_CALM_MS)
        if(inMotion && (this._shown.length > 0 || this._held.length > 0)){
            if(keepsMoving && this._shown.length > 0){
                // A subtitle does not hang in the air when the camera turns (a cut after the line is spoken):
                // it stays until it has been read. Text of the game world is hidden.
                const stay = this._shown.filter(segment => segment.centered && now - segment.shownAt < readingTime(segment, this._queue.length))
                const leaving = this._shown.filter(segment => stay.indexOf(segment) < 0)
                if(leaving.length > 0){
                    this._held = leaving
                    this._shown = stay
                    if(stay.length > 0){
                        this._emit(stay)
                    } else {
                        this._options.onResult(null)
                    }
                }
                // Read as soon as the picture is steady again
                this._sameCount = 0
                this._hasReadMask = false
            }

            if(now - this._unstableSince < MOTION_PATIENCE_MS){
                return
            }
        }

        // The reader is busy (or lines wait for it): a line that has not changed is not read again just in case
        const idle = !this._working && this._jobs.length === 0

        // The longer the text stays the same, the less often it is read again; changed text is photographed without that delay
        const waiting = this._pending.length > 0
        const minGap = fullScreen ? (waiting ? SCREEN_PENDING_GAP_MS : Math.min(SCREEN_GAP_MAX_MS, SCREEN_GAP_MS + this._sameCount * 2000)) : taskMode ? 1200 : (held ? GROWTH_GAP_MS : (changed ? SNAPSHOT_GAP_MS : Math.min(3000, 400 + this._sameCount * 400)))

        // Read again now and then even when the picture looks the same: it may be a different line in the same place.
        // Reading the same text again costs nothing visible (see _process), and it happens less often the longer the text stays.
        let recheck = idle && now - this._lastReadAt >= Math.min(6000, 1000 + this._sameCount * 700)

        // The same pixels as at the last reading: the text is the same and is translated already, so it is not read
        // again (only now and then, in case the picture has changed in a way the pixels do not show)
        if(recheck && !changed && this._shown.length > 0 && !(fullScreen && waiting) && now - this._lastReadAt < EXACT_RECHECK_MS && (held || this._pixelsSame(present, width, height))){
            recheck = false
        }

        if((!changed && !recheck) || now < this._retryAt || now - this._lastReadAt < minGap){
            return
        }

        // A steady interface is read one picture at a time
        if(taskMode && !idle){
            return
        }

        // Wait until the new text has settled; a busy background may never settle: take the picture anyway once in a while
        if(!settled && now - this._lastReadAt < FORCE_OCR_MS){
            return
        }

        // 3. Take the snapshot. How much the text pixels differ from the last one: a small difference is a living
        // background, not new text
        let changeAmount = 1
        let profileAmount = 1
        if(this._hasReadMask){
            changeAmount = 0
            profileAmount = 0
            for(const candidate of present){
                const read = this._readMask[candidate.polarity]
                const readProfile = this._readProfile[candidate.polarity]
                changeAmount = (read === undefined || read.length !== candidate.mask.length) ? 1 : Math.max(changeAmount, maskDifference(read, candidate.mask))
                profileAmount = readProfile === undefined ? 1 : Math.max(profileAmount, profileDifference(readProfile, candidate.profile))
            }
        }

        const snapshot = this._capture(video, source, box, config, present, changeAmount, profileAmount, now, { width, height })
        if(snapshot === null){
            return
        }

        this._lastReadAt = now
        this._readMask = {}
        this._readProfile = {}
        this._readFine = {}
        for(const candidate of present){
            this._readMask[candidate.polarity] = candidate.mask
            this._readProfile[candidate.polarity] = candidate.profile
            this._readFine[candidate.polarity] = { mask: candidate.fine, width, height }
        }
        this._hasReadMask = true

        this._enqueue(snapshot)
    }

    /** The window moves with its text: the translation that is shown (and the ones that wait) move along. */
    _shiftBy(dx: number, dy: number) {
        this._shift.x += dx
        this._shift.y += dy

        const move = (list: ShownSegment[]): ShownSegment[] => list.map(segment => ({ ...segment, rect: { ...segment.rect, x: segment.rect.x + dx, y: segment.rect.y + dy } }))
        this._held = move(this._held)
        this._queue = move(this._queue)
        if(this._shown.length > 0){
            this._shown = move(this._shown)
            this._emit(this._shown)
        }
    }

    /** Are the text pixels of the window the same as at the last reading? */
    _pixelsSame(present: Array<{ polarity: Polarity; fine: Uint8Array }>, width: number, height: number, limit = FINE_SAME): boolean {
        for(const candidate of present){
            const read = this._readFine[candidate.polarity]
            if(read === undefined || read.width !== width || read.height !== height || fineDifference(read.mask, candidate.fine, width, height) > limit){
                return false
            }
        }
        return true
    }

    /** A copy of the window as it is right now (the reader may get to it a second later). */
    _capture(video: HTMLVideoElement, source: SourceRect, box: { width: number; height: number }, config: TranslatorConfig, present: Array<{ polarity: Polarity; mask: Uint8Array; profile: Float32Array; fine: Uint8Array }>, changeAmount: number, profileAmount: number, now: number, sig: { width: number; height: number }): Snapshot | null {
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(source.sw))
        canvas.height = Math.max(1, Math.round(source.sh))

        const context = canvas.getContext('2d')
        if(context === null){
            return null
        }
        context.drawImage(video, source.sx, source.sy, source.sw, source.sh, 0, 0, canvas.width, canvas.height)

        const masks: Partial<Record<Polarity, Uint8Array>> = {}
        const profiles: Partial<Record<Polarity, Float32Array>> = {}
        const fines: Partial<Record<Polarity, Uint8Array>> = {}
        for(const candidate of present){
            masks[candidate.polarity] = candidate.mask
            profiles[candidate.polarity] = candidate.profile
            fines[candidate.polarity] = candidate.fine
        }

        return {
            canvas,
            source,
            box,
            config: { ...config },
            at: now,
            generation: this._generation,
            polarities: present.map(candidate => candidate.polarity),
            masks,
            profiles,
            fines,
            sig,
            changeAmount,
            profileAmount,
            shift: { x: this._shift.x, y: this._shift.y },
        }
    }

    /**
     * Puts a snapshot into the short line for the reader. The line is short on purpose (memory): a snapshot that is
     * almost the same picture as the last one that waits replaces it, and when the line is full the oldest one goes.
     */
    _enqueue(snapshot: Snapshot) {
        const big = snapshot.canvas.width * snapshot.canvas.height > BIG_SNAPSHOT_PIXELS
        const limit = this._taskMode ? 1 : (big ? 2 : MAX_JOBS)

        const last = this._jobs[this._jobs.length - 1]
        if(last !== undefined && snapshot.at - last.at < NEAR_COPY_MS && sameSnapshot(last, snapshot)){
            this._release(last)
            this._jobs[this._jobs.length - 1] = snapshot
        } else {
            this._jobs.push(snapshot)
            while(this._jobs.length > limit){
                const old = this._jobs.shift()
                if(old !== undefined){
                    this._release(old)
                }
            }
        }

        this._pump().catch((error) => {
            console.warn('Translator: the reader failed:', error)
        })
    }

    /** Frees the memory of a snapshot. */
    _release(snapshot: Snapshot) {
        snapshot.canvas.width = 0
        snapshot.canvas.height = 0
    }

    _dropJobs() {
        this._jobs.forEach(job => this._release(job))
        this._jobs = []
    }

    /** The "reader": takes the waiting snapshots one by one, reads and translates them. */
    async _pump() {
        if(this._working){
            return
        }

        this._working = true
        try {
            while(this._running && this._jobs.length > 0){
                const job = this._jobs.shift() as Snapshot

                // A snapshot of a window that has been moved since, or one that is very old while newer ones wait, is useless
                const useless = job.generation !== this._generation || (this._jobs.length > 0 && Date.now() - job.at > JOB_STALE_MS)
                try {
                    if(!useless){
                        await this._process(job)
                    }
                } catch(error) {
                    console.warn('Translator: step failed:', error)
                } finally {
                    this._release(job)
                }
            }
        } finally {
            this._working = false
        }
    }

    /** Reads one snapshot, translates what is new in it and puts it on screen (or into the queue, see _flushQueue). */
    async _process(job: Snapshot) {
        const video = this._options.getVideo()
        if(video === null){
            return
        }

        const { config, box, changeAmount, profileAmount } = job
        // The window may have been carried along with its text since the snapshot was taken
        const offset = { x: this._shift.x - job.shift.x, y: this._shift.y - job.shift.y }
        const now = job.at
        const generation = job.generation
        let best: ReadResult = { segments: [], text: '', score: 0, confidence: 0 }
        let bestPolarity: Polarity = job.polarities[0]

        const tiles = job.config.fullScreen === true ? (job.config.tiles ?? []) : []
        for(const polarity of job.polarities){
            const result = tiles.length > 0 ? await this._readTiles(job, polarity, tiles, video, box) : await this._read(job, polarity)
            if(result !== null && result.score > best.score){
                best = result
                bestPolarity = polarity
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
            if(previous === null && changeAmount < IN_PLACE_CHANGE && profileAmount < IN_PLACE_PROFILE && known.length > 0){
                // Different text where a line is already shown, although the picture hardly changed: probably a misread
                const screen = videoRectToScreen(video.videoWidth, video.videoHeight, box.width, box.height, config.fit, raw.rect)
                screen.x += offset.x
                screen.y += offset.y
                inPlace = known.some(old => overlapShare(screen, old.rect) > 0.5)
            }

            if(previous !== null || this._confirm(raw, now, inPlace || config.mode === 'task')){
                accepted.push({ raw, previous })
            }
        })

        if(accepted.length === 0){
            // Nothing believable yet: look again soon
            this._sameCount = 0
            this._hasReadMask = false
            return
        }

        // The pixels of the text that was read: as long as they stay, the text is still there (see _step)
        const fine = job.fines[bestPolarity]
        if(fine !== undefined && job.config.mode !== 'task'){
            const toSignature = (x: number, y: number) => ({ x: (x - job.source.sx) / job.source.sw * job.sig.width, y: (y - job.source.sy) / job.source.sh * job.sig.height })
            const boxes = best.segments.map((raw) => {
                const from = toSignature(raw.rect.x, raw.rect.y)
                const to = toSignature(raw.rect.x + raw.rect.w, raw.rect.y + raw.rect.h)
                return { x0: from.x, y0: from.y, x1: to.x, y1: to.y }
            })
            this._textInk = textInkOf(bestPolarity, fine, job.sig.width, job.sig.height, boxes)
            this._grownTicks = 0
        }

        // 5. Translate what is new
        let segments: ShownSegment[]
        try {
            segments = await Promise.all(accepted.map(item => this._translateSegment(item.raw, item.previous, config, video, box, offset)))
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
            // The same line with more text (it was caught while it was still being typed): it replaces the part at once
            this._queue = this._queue.filter(other => !(overlapShare(segment.rect, other.rect) > 0.5 && extendsText(other.template, segment.template)))

            const old = accepted[index].previous === null
                ? shown.find(other => overlapShare(segment.rect, other.rect) > 0.5 && stamp - other.shownAt < readingTime(other, this._queue.length) && !extendsText(other.template, segment.template))
                : undefined

            // Lines are shown in the order they were read: a line also waits behind the ones that are already waiting
            const waiting = accepted[index].previous === null && this._queue.some(other => overlapShare(segment.rect, other.rect) > 0.5)

            if(old === undefined && !waiting){
                ready.push(segment)
            } else {
                if(old !== undefined && held.indexOf(old) < 0){
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
            // A line that was not found stays for a couple of reads, and always until it has been read
            const unread = Date.now() - old.shownAt < readingTime(old, this._queue.length)
            if(!used.has(old) && (old.missed < (config.fullScreen === true ? SCREEN_MAX_MISSED_READS : MAX_MISSED_READS) || unread) && !segments.some(segment => rectsOverlap(segment.rect, old.rect))){
                segments.push({ ...old, missed: old.missed + 1 })
            }
        })
        segments = dropCovered(segments)
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

    async _translateSegment(raw: RawSegment, previous: ShownSegment | null, config: TranslatorConfig, video: HTMLVideoElement, box: { width: number; height: number }, offset = { x: 0, y: 0 }): Promise<ShownSegment> {
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
            const answer = await this._options.translate(toTranslatable(raw.text), target, config.source)
            translated = typeof answer === 'string' ? answer : answer.text

            if(translated === ''){
                translated = raw.text
            }

            // A draft that gets better: when the better text comes, it takes the place of the draft
            if(typeof answer !== 'string' && answer.better !== undefined){
                this._improve(answer.better, fullKey, target + '|' + template, raw.text, template, translated)
            }

            this._remember(fullKey, translated)
            if(this._templates.size > 300){
                this._templates.delete(this._templates.keys().next().value as string)
            }
            this._templates.set(target + '|' + template, { original: raw.text, translated })
        }

        // Keep the old box when the picture only shook a little (the translation would twitch otherwise)
        const screen = videoRectToScreen(video.videoWidth, video.videoHeight, box.width, box.height, config.fit, raw.rect)
        screen.x += offset.x
        screen.y += offset.y
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

    /** The better translation of a text has come: it replaces the draft in the memory and wherever the draft is shown. */
    _improve(better: Promise<string | null>, fullKey: string, templateId: string, original: string, template: string, draft: string) {
        const generation = this._generation

        better.then((text) => {
            if(text === null || text === '' || text === draft || !this._running){
                return
            }

            this._remember(fullKey, text)
            this._templates.set(templateId, { original, translated: text })

            const replace = (list: ShownSegment[], onlyFresh: boolean): ShownSegment[] => list.map(segment => (segment.translated === draft && (segment.original === original || segment.template === template) && (!onlyFresh || Date.now() - segment.shownAt < REFINE_WINDOW_MS)) ? { ...segment, translated: text } : segment)
            this._queue = replace(this._queue, false)
            this._held = replace(this._held, false)

            // A line that is being read is not changed under the eyes of the player: only a line that has just appeared
            // gets the better text, and none while other lines wait their turn (a fast conversation). The better text
            // is in the memory anyway, so the line has it when it comes again.
            if(generation === this._generation && this._queue.length === 0 && this._shown.some(segment => segment.translated === draft && (segment.original === original || segment.template === template) && Date.now() - segment.shownAt < REFINE_WINDOW_MS)){
                this._shown = replace(this._shown, true)
                this._emit(this._shown)
            }
        }).catch(() => { /* the draft stays */ })
    }

    _remember(key: string, translated: string) {
        if(this._cache.size > 300){
            this._cache.delete(this._cache.keys().next().value as string)
        }
        this._cache.set(key, translated)
    }

    /**
     * Reads the whole screen piece by piece: every tile is cut out of the snapshot and read like a window of its own (so it is
     * enlarged as much as a window is), and the pieces of text of all tiles are put together.
     */
    async _readTiles(job: Snapshot, polarity: Polarity, tiles: Region[], video: HTMLVideoElement, box: { width: number; height: number }): Promise<ReadResult | null> {
        const segments: RawSegment[] = []
        let score = 0

        for(const tile of tiles){
            // The window was closed meanwhile: the rest is not read
            if(job.generation !== this._generation || !this._running){
                return null
            }

            const sub = regionToSource(video.videoWidth, video.videoHeight, box.width, box.height, job.config.fit, tile)
            if(sub === null){
                continue
            }

            const canvasWidth = job.canvas.width
            const canvasHeight = job.canvas.height
            const x = Math.max(0, Math.round((sub.sx - job.source.sx) / job.source.sw * canvasWidth))
            const y = Math.max(0, Math.round((sub.sy - job.source.sy) / job.source.sh * canvasHeight))
            const width = Math.min(canvasWidth - x, Math.round(sub.sw / job.source.sw * canvasWidth))
            const height = Math.min(canvasHeight - y, Math.round(sub.sh / job.source.sh * canvasHeight))
            if(width < 16 || height < 8){
                continue
            }

            const piece = document.createElement('canvas')
            piece.width = width
            piece.height = height
            const context = piece.getContext('2d')
            if(context === null){
                continue
            }
            context.drawImage(job.canvas, x, y, width, height, 0, 0, width, height)

            const result = await this._read({ ...job, canvas: piece, source: { sx: job.source.sx + x / canvasWidth * job.source.sw, sy: job.source.sy + y / canvasHeight * job.source.sh, sw: width / canvasWidth * job.source.sw, sh: height / canvasHeight * job.source.sh } }, polarity)
            piece.width = 0
            piece.height = 0

            if(result !== null){
                segments.push(...result.segments)
                score += result.score
            }
        }

        if(segments.length === 0){
            return null
        }
        return { segments, text: segments.map(segment => segment.text).join(' '), score, confidence: 100 }
    }

    /** Reads the window with one text colour and turns the result into pieces of text with their position and colours. */
    async _read(job: Snapshot, polarity: Polarity): Promise<ReadResult | null> {
        const source = job.source
        const prepared = this._prepareForReading(job.canvas, source, polarity)
        if(prepared === null){
            return null
        }

        const result = await recognizeCanvas(prepared.canvas, job.config.source, this._options.priority ?? 1, job.config.mode === 'task' ? TASK_WORD_GAP : DIALOG_WORD_GAP, job.config.fullScreen === true ? 'page' : 'block')
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
            // The height of a row of letters: from the text pixels, and never more than the words say (two rows that
            // the reader joined into one line, or a decoration, must not make the translation twice as big)
            const heights = group.map((item) => {
                const measured = this._textHeight(prepared, item.line.bbox)
                return item.line.wordHeight === undefined ? measured : Math.min(measured, item.line.wordHeight * WORD_HEIGHT_CAP)
            }).sort((a, b) => a - b)
            // The lower middle one: a joined row is an exception, so the smaller of two is the real one
            const lineHeight = heights[Math.floor((heights.length - 1) / 2)]

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
            confidence: result.confidence,
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

        if(!(gap < lastHeight * 0.7 && overlapsInX)){
            return false
        }

        // A sentence that ends at the end of a line may still be followed by more of the same paragraph: that is
        // only believed when the lines are wrapped (below), not because the next one starts with a small letter
        if(!/[.!?:…»"”]$/.test(last.text) && LOWER_START.test(next.text)){
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

    /**
     * The height of one row of letters in the box of a line. The reader sometimes joins two rows of text (and the
     * decoration between them) into one "line"; the translation would then get twice the size of the original.
     * The rows are found from the text pixels: a row is a run of pixel rows that carry text.
     */
    _textHeight(prepared: PreparedImage, box: { x0: number; y0: number; x1: number; y1: number }): number {
        const full = box.y1 - box.y0
        const left = Math.max(0, Math.floor(box.x0 - prepared.padding))
        const right = Math.min(prepared.width - 1, Math.ceil(box.x1 - prepared.padding))
        const top = Math.max(0, Math.floor(box.y0 - prepared.padding))
        const bottom = Math.min(prepared.height - 1, Math.ceil(box.y1 - prepared.padding))
        if(right <= left || bottom <= top || full <= 0){
            return full
        }

        const needed = Math.max(2, ((right - left) / 2) * 0.04)
        const runs: number[] = []
        let run = 0
        let gap = 0

        for(let y = top; y <= bottom; y++){
            let count = 0
            for(let x = left; x <= right; x += 2){
                if(prepared.ink[y * prepared.width + x] !== 0){
                    count++
                }
            }

            if(count >= needed){
                run += gap + 1
                gap = 0
            } else if(run > 0){
                gap++
                if(gap > 2){
                    runs.push(run)
                    run = 0
                    gap = 0
                }
            }
        }
        if(run > 0){
            runs.push(run)
        }

        if(runs.length === 0){
            return full
        }

        // Never taller than the box, and not unreasonably small (a thin row of stray pixels)
        return Math.max(full * 0.4, Math.min(full, Math.max(...runs) * 1.1))
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
    _prepareForReading(frame: HTMLCanvasElement, source: SourceRect, polarity: Polarity): PreparedImage | null {
        // Small interface text needs to be enlarged a lot to be read reliably
        let scale = Math.min(3, Math.max(2, 1300 / source.sw))
        // A big window (the whole screen) is not enlarged as much: the time of the reader grows with the number of pixels
        if(source.sw * source.sh * scale * scale > MAX_OCR_PIXELS){
            scale = Math.max(1, Math.sqrt(MAX_OCR_PIXELS / (source.sw * source.sh)))
        }
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

        workContext.drawImage(frame, 0, 0, frame.width, frame.height, 0, 0, width, height)
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
