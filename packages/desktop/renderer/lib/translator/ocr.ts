import type { Worker } from 'tesseract.js'

// The OCR engine (Tesseract compiled to WebAssembly) and the English language data are bundled with the app
// (renderer/public/tesseract), so reading English works offline. The language data of any other language
// (a few MB) is downloaded once from the public Tesseract data server and kept in the browser cache.

let workerPromise: Promise<Worker> | null = null
let workerLanguage = 'en'

// Languages the text can be read in: the code used in the settings -> the name of the Tesseract language data
export const SOURCE_LANGUAGES: Record<string, string> = {
    en: 'eng',
    de: 'deu',
    fr: 'fra',
    es: 'spa',
    it: 'ita',
    pt: 'por',
    pl: 'pol',
    cs: 'ces',
    nl: 'nld',
    sv: 'swe',
    tr: 'tur',
    uk: 'ukr',
    ru: 'rus',
}

const REMOTE_LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0_fast'

function assetUrl(path: string): string {
    return new URL('/tesseract/' + path, window.location.href).href
}

// The reader has been shut down (the stream was closed): nothing reads any more and no new reader is made, until
// somebody asks for one on purpose (getOcrWorker, when a translator starts)
let closed = false
const NOTHING: OcrResult = { text: '', confidence: 0, lines: [] }

// The calls into the library that are under way. The library's reader must not be shut down while there is one: recognize()
// prepares the picture first (that takes a while) and only then writes to its worker, and when the worker is gone by then the
// library drops an error that nobody can catch ("Cannot read properties of null (reading 'postMessage')") and never settles
// the call. So the shutdown waits for them (see shutDownReader), at most this long.
const running = new Set<Promise<unknown>>()
const SHUTDOWN_WAIT = 20000

function track<T>(call: Promise<T>): Promise<T> {
    running.add(call)
    const done = () => { running.delete(call) }
    call.then(done, done)
    return call
}

// Settles when the reader is shut down: a reading that is waiting for the reader gives up at once (its answer is not wanted
// any more), and the reader is not left in use.
type Abort = Promise<'aborted'>
let abortReading: () => void = () => { /* replaced below */ }
let aborted: Abort = new Promise((resolve) => { abortReading = () => resolve('aborted') })
function renewAbort() {
    aborted = new Promise((resolve) => { abortReading = () => resolve('aborted') })
}

export function getOcrWorker(language = 'en'): Promise<Worker> {
    closed = false
    return makeOcrWorker(language)
}

function makeOcrWorker(language: string): Promise<Worker> {
    const code = SOURCE_LANGUAGES[language] ? language : 'en'

    if(workerPromise !== null && workerLanguage !== code){
        // The reading language was changed: the old reader is not needed any more (the reading goes on with a new one)
        void shutDownReader()
    }

    if(workerPromise === null){
        workerLanguage = code
        currentLayout = null
        const bundled = code === 'en'

        workerPromise = (async () => {
            const { createWorker } = await import('tesseract.js')

            const worker = await createWorker(SOURCE_LANGUAGES[code], 1, {
                workerPath: assetUrl('worker.min.js'),
                corePath: assetUrl('core'),
                langPath: bundled ? assetUrl('lang') : REMOTE_LANG_PATH,
                workerBlobURL: false,
                gzip: !bundled,
                cacheMethod: bundled ? 'none' : 'write',
            })

            // One uniform block of text (a subtitle or a few lines of a task)
            await worker.setParameters({
                tessedit_pageseg_mode: '6' as any,
                preserve_interword_spaces: '0',
            })

            return worker
        })()

        // Allow a new attempt after a failure
        workerPromise.catch(() => {
            workerPromise = null
        })
    }

    return workerPromise
}

export interface OcrBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

export interface OcrLine {
    text: string;
    confidence: number;
    // Position in the picture that was read (pixels)
    bbox: OcrBox;
    // Height of the words of the line (pixels). Unlike the box of the line it does not grow when the reader joins
    // two rows of text into one line.
    wordHeight?: number;
}

export interface OcrResult {
    text: string;
    confidence: number;
    lines: OcrLine[];
}

// Words the reader is not sure about are left out (noise in the picture shows up as low-confidence "words")
const MIN_WORD_CONFIDENCE = 50

// Two words further apart than this (in line heights) are separate pieces of text (two interface elements on one row)
const MAX_WORD_GAP = 2

// The reader does one picture at a time. When several windows wait for it, the one with the higher priority goes first
// (the windows the player placed come before the ones the adaptive mode found); equal priorities take turns.
let readerBusy = false
const readerQueue: Array<{ priority: number; resume: () => void }> = []

function acquireReader(priority: number): Promise<void> {
    if(!readerBusy){
        readerBusy = true
        return Promise.resolve()
    }
    return new Promise((resume) => {
        readerQueue.push({ priority, resume })
    })
}

function releaseReader() {
    if(readerQueue.length === 0){
        readerBusy = false
        return
    }

    let best = 0
    for(let i = 1; i < readerQueue.length; i++){
        if(readerQueue[i].priority > readerQueue[best].priority){
            best = i
        }
    }
    readerQueue.splice(best, 1)[0].resume()
}

// How the reader looks at a picture: as one uniform block of text (a window with a subtitle or a few lines), or as a page
// with text of different sizes in different places (the whole screen). Set again only when it changes.
let currentLayout: 'block' | 'page' | null = null

export async function recognizeCanvas(canvas: HTMLCanvasElement, language = 'en', priority = 1, maxGap = MAX_WORD_GAP, layout: 'block' | 'page' = 'block'): Promise<OcrResult> {
    await acquireReader(priority)
    // The reader that is shut down while this reading goes on is not used any more (see aborted)
    const mine = aborted
    try {
        if(closed){
            return NOTHING
        }

        const worker = await makeOcrWorker(language)
        if(closed || mine !== aborted){
            return NOTHING
        }

        if(currentLayout !== layout){
            const outcome = await Promise.race([track(worker.setParameters({ tessedit_pageseg_mode: (layout === 'page' ? '3' : '6') as any })), mine])
            if(outcome === 'aborted' || mine !== aborted){
                return NOTHING
            }
            currentLayout = layout
        }

        const read = await Promise.race([readCanvas(worker, canvas, maxGap), mine])
        if(read === 'aborted'){
            return NOTHING
        }
        return read
    } catch(error) {
        // The reader was shut down while this picture was being read: that is not a failure
        if(closed || /postMessage/.test(String(error))){
            return NOTHING
        }
        throw error
    } finally {
        releaseReader()
    }
}

async function readCanvas(worker: Worker, canvas: HTMLCanvasElement, maxGap: number): Promise<OcrResult> {
    const result = await track(worker.recognize(canvas, {}, { text: true, blocks: true }))

    const lines: OcrLine[] = []

    for(const block of result.data.blocks || []){
        for(const paragraph of block.paragraphs || []){
            for(const line of paragraph.lines || []){
                const words = (line.words || []).filter(word => word.confidence >= MIN_WORD_CONFIDENCE && word.text.trim() !== '')
                if(words.length === 0){
                    continue
                }

                // Split the line where there is a wide gap between two words. The gap is measured in heights of a word,
                // not of the line: a tall icon on the row (a button symbol between two choices) makes the line tall
                // and would hide the gap
                const wordHeights = words.map(word => word.bbox.y1 - word.bbox.y0).sort((a, b) => a - b)
                const height = Math.max(1, wordHeights[Math.floor((wordHeights.length - 1) / 2)])
                let chunk: typeof words = []

                const flush = () => {
                    if(chunk.length === 0){
                        return
                    }

                    // A tall word (with letters that go up or down) shows the real height of a row; short words
                    // ("was", "on") are only as tall as the small letters, so the upper quarter is taken
                    const heights = chunk.map(word => word.bbox.y1 - word.bbox.y0).sort((a, b) => a - b)

                    lines.push({
                        wordHeight: heights[Math.floor((heights.length - 1) * 0.75)],
                        text: chunk.map(word => word.text.trim()).join(' '),
                        confidence: chunk.reduce((sum, word) => sum + word.confidence, 0) / chunk.length,
                        bbox: {
                            x0: Math.min(...chunk.map(word => word.bbox.x0)),
                            y0: Math.min(...chunk.map(word => word.bbox.y0)),
                            x1: Math.max(...chunk.map(word => word.bbox.x1)),
                            y1: Math.max(...chunk.map(word => word.bbox.y1)),
                        },
                    })
                    chunk = []
                }

                for(const word of words){
                    const previous = chunk[chunk.length - 1]
                    if(previous !== undefined && word.bbox.x0 - previous.bbox.x1 > height * maxGap){
                        flush()
                    }
                    chunk.push(word)
                }
                flush()
            }
        }
    }

    if(lines.length === 0){
        return { text: '', confidence: 0, lines: [] }
    }

    const confidence = lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length

    return { text: lines.map(line => line.text).join('\n'), confidence, lines }
}

/** The stream is closed: nothing reads any more. */
export function terminateOcr(): Promise<void> {
    closed = true
    return shutDownReader()
}

async function shutDownReader(): Promise<void> {
    // The readings that wait for the reader give up (and the next reader starts with a clean slate)
    abortReading()
    renewAbort()
    if(workerPromise === null){
        return
    }

    const pending = workerPromise
    workerPromise = null
    // Taken now: what is under way on this reader (nothing new is started on it from here on)
    const busy = Array.from(running).map(call => call.catch(() => undefined))

    try {
        const worker = await pending
        let timer: ReturnType<typeof setTimeout> | undefined
        await Promise.race([Promise.all(busy), new Promise((resolve) => { timer = setTimeout(resolve, SHUTDOWN_WAIT) })])
        clearTimeout(timer)
        await worker.terminate()
    } catch(error) {
        // Nothing to clean up
    }
}
