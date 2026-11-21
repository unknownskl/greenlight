import type { Worker } from 'tesseract.js'

// The OCR engine (Tesseract compiled to WebAssembly) and the English language data are bundled with the app
// (renderer/public/tesseract), so the text reader works offline and never downloads anything.

let workerPromise: Promise<Worker> | null = null

function assetUrl(path: string): string {
    return new URL('/tesseract/' + path, window.location.href).href
}

export function getOcrWorker(): Promise<Worker> {
    if(workerPromise === null){
        workerPromise = (async () => {
            const { createWorker } = await import('tesseract.js')

            const worker = await createWorker('eng', 1, {
                workerPath: assetUrl('worker.min.js'),
                corePath: assetUrl('core'),
                langPath: assetUrl('lang'),
                workerBlobURL: false,
                gzip: false,
                cacheMethod: 'none',
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
}

export interface OcrResult {
    text: string;
    confidence: number;
    lines: OcrLine[];
}

// Words the reader is not sure about are left out (noise in the picture shows up as low-confidence "words")
const MIN_WORD_CONFIDENCE = 50

// Two words further apart than this (in line heights) are separate pieces of text (two interface elements on one row)
const MAX_WORD_GAP = 2.5

export async function recognizeCanvas(canvas: HTMLCanvasElement): Promise<OcrResult> {
    const worker = await getOcrWorker()
    const result = await worker.recognize(canvas, {}, { text: true, blocks: true })

    const lines: OcrLine[] = []

    for(const block of result.data.blocks || []){
        for(const paragraph of block.paragraphs || []){
            for(const line of paragraph.lines || []){
                const words = (line.words || []).filter(word => word.confidence >= MIN_WORD_CONFIDENCE && word.text.trim() !== '')
                if(words.length === 0){
                    continue
                }

                // Split the line where there is a wide gap between two words
                const height = Math.max(1, line.bbox.y1 - line.bbox.y0)
                let chunk: typeof words = []

                const flush = () => {
                    if(chunk.length === 0){
                        return
                    }

                    lines.push({
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
                    if(previous !== undefined && word.bbox.x0 - previous.bbox.x1 > height * MAX_WORD_GAP){
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

export async function terminateOcr(): Promise<void> {
    if(workerPromise === null){
        return
    }

    const pending = workerPromise
    workerPromise = null

    try {
        const worker = await pending
        await worker.terminate()
    } catch(error) {
        // Nothing to clean up
    }
}
