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

export interface OcrResult {
    text: string;
    confidence: number;
}

export async function recognizeCanvas(canvas: HTMLCanvasElement): Promise<OcrResult> {
    const worker = await getOcrWorker()
    const result = await worker.recognize(canvas)

    return {
        text: result.data.text || '',
        confidence: result.data.confidence || 0,
    }
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
