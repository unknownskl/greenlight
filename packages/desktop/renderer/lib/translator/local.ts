/**
 * The local translator: small translation models (Bergamot / Marian, the same as in the Firefox translator) that run
 * on the device in a worker. A translation takes some milliseconds, works without internet and the text never leaves
 * the device. A model is about 35 MB for one language pair; it is downloaded when the player asks for it
 * (Settings -> Translator) and kept in the browser cache. The engine and the worker are bundled with the app
 * (renderer/public/bergamot).
 */

export type LocalState = 'idle' | 'downloading' | 'loading' | 'ready' | 'error'

export interface LocalStatus {
    state: LocalState;
    // 0..1 while a model is downloaded
    progress: number;
    // The models that are on the device ('enuk' = English -> Ukrainian)
    installed: string[];
    message: string;
}

// The models that exist (the registry of the project): from + to
const PAIRS = new Set(['bgen', 'csen', 'deen', 'enbg', 'encs', 'ende', 'enes', 'enet', 'enfr', 'enit', 'enpt', 'enru', 'enuk', 'esen', 'eten', 'fren', 'iten', 'pten', 'ruen', 'uken'])

const PIVOT = 'en'
const CACHE_NAME = 'greenlight-translator-models-v1'
const STORE_KEY = 'greenlight.localTranslator.installed'
// A translation that takes longer than this is given up (the online service takes over)
const TRANSLATE_TIMEOUT_MS = 20000

interface RegistryFile {
    name: string;
    size: number;
    expectedSha256Hash?: string;
}

/** The models (pairs) that are needed to translate from one language to the other; [] when it is not possible. */
export function modelsFor(from: string, to: string): string[] {
    if(from === to || from === '' || to === ''){
        return []
    }
    if(PAIRS.has(from + to)){
        return [from + to]
    }
    if(PAIRS.has(from + PIVOT) && PAIRS.has(PIVOT + to)){
        return [from + PIVOT, PIVOT + to]
    }
    return []
}

export function isLocalSupported(from: string, to: string): boolean {
    return modelsFor(from, to).length > 0
}

let installed: string[] = readInstalled()
let status: LocalStatus = { state: 'idle', progress: 0, installed, message: '' }
const listeners = new Set<() => void>()

function readInstalled(): string[] {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORE_KEY) || '[]')
        return Array.isArray(parsed) ? parsed.filter((item: any) => typeof item === 'string' && PAIRS.has(item)) : []
    } catch(error) {
        return []
    }
}

function writeInstalled(list: string[]) {
    installed = list
    try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(list))
    } catch(error) {
        // The list is only kept for this run then
    }
}

function setStatus(change: Partial<LocalStatus>) {
    status = { ...status, installed, ...change }
    listeners.forEach(listener => listener())
}

export function getLocalStatus(): LocalStatus {
    return status
}

export function subscribeLocal(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

/** Are all models that this pair needs on the device? */
export function isLocalInstalled(from: string, to: string): boolean {
    const needed = modelsFor(from, to)
    return needed.length > 0 && needed.every(pair => installed.indexOf(pair) >= 0)
}

function assetUrl(path: string): string {
    return new URL('/bergamot/' + path, window.location.href).href
}

async function openCache(): Promise<Cache | null> {
    try {
        return typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME)
    } catch(error) {
        return null
    }
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

// Bytes received per file while models are downloaded (progress), and how many are expected
const received = new Map<string, number>()
let expected = 0

function reportProgress() {
    if(status.state === 'downloading' && expected > 0){
        let sum = 0
        received.forEach(value => { sum += value })
        setStatus({ progress: Math.min(1, sum / expected) })
    }
}

/** Downloads a file (once: later it comes from the cache of the app) and checks that it is the one that was published. */
async function download(url: string, checksum: string | undefined, signal?: AbortSignal): Promise<ArrayBuffer> {
    const cache = await openCache()
    const cached = cache === null ? undefined : await cache.match(url)
    if(cached !== undefined){
        const buffer = await cached.arrayBuffer()
        received.set(url, buffer.byteLength)
        reportProgress()
        return buffer
    }

    const response = await fetch(url, { credentials: 'omit', signal })
    if(!response.ok || response.body === null){
        throw new Error('download failed (' + response.status + ')')
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0
    for(;;){
        const { done, value } = await reader.read()
        if(done || value === undefined){
            break
        }
        chunks.push(value)
        loaded += value.length
        received.set(url, loaded)
        reportProgress()
    }

    const bytes = new Uint8Array(loaded)
    let offset = 0
    for(const chunk of chunks){
        bytes.set(chunk, offset)
        offset += chunk.length
    }
    const buffer = bytes.buffer

    if(checksum !== undefined && (await sha256Hex(buffer)) !== checksum.toLowerCase()){
        throw new Error('the downloaded file is damaged')
    }

    if(cache !== null){
        try {
            await cache.put(url, new Response(buffer.slice(0), { headers: { 'content-type': 'application/octet-stream' } }))
        } catch(error) {
            // Not kept: it is downloaded again next time
        }
    }
    return buffer
}

interface Engine {
    translator: any;
    backing: any;
}

let enginePromise: Promise<Engine> | null = null
let registry: Record<string, Record<string, RegistryFile>> | null = null

async function getEngine(): Promise<Engine> {
    if(enginePromise === null){
        enginePromise = (async () => {
            // The engine is a plain script of the app (not part of the bundle)
            const module: any = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ assetUrl('translator.js'))

            registry = await (await fetch(assetUrl('registry.json'))).json()

            class Backing extends module.TranslatorBacking {
                constructor(options: any) {
                    super(options)
                }

                // The list of models comes with the app: it works without internet
                async loadModelRegistery() {
                    return Object.entries(registry as Record<string, any>).map(([key, files]) => ({ from: key.substring(0, 2), to: key.substring(2, 4), files }))
                }

                async fetch(url: string, checksum: string | undefined, extra?: { signal?: AbortSignal }) {
                    return download(url, checksum, extra?.signal)
                }
            }

            const backing = new Backing({ downloadTimeout: 0, pivotLanguage: PIVOT })
            const translator = new module.BatchTranslator({ workers: 1, batchSize: 4, cacheSize: 0, downloadTimeout: 0, pivotLanguage: PIVOT }, backing)
            return { translator, backing }
        })()

        enginePromise.catch(() => {
            enginePromise = null
        })
    }
    return enginePromise
}

/** Downloads the models that translating from one language to the other needs. */
export async function installLocal(from: string, to: string): Promise<void> {
    const needed = modelsFor(from, to)
    if(needed.length === 0){
        throw new Error('no model for ' + from + ' -> ' + to)
    }
    if(status.state === 'downloading'){
        return
    }

    received.clear()
    expected = 0
    setStatus({ state: 'downloading', progress: 0, message: '' })

    try {
        const { backing } = await getEngine()

        for(const pair of needed){
            const files = (registry as any)[pair] as Record<string, RegistryFile>
            Object.values(files).forEach((file) => {
                if(file !== undefined && typeof file.size === 'number'){ expected += file.size }
            })
        }

        for(const pair of needed){
            await backing.getTranslationModel({ from: pair.substring(0, 2), to: pair.substring(2, 4) })
            if(installed.indexOf(pair) < 0){
                writeInstalled(installed.concat(pair))
            }
        }
        setStatus({ state: 'ready', progress: 1, message: '' })
    } catch(error: any) {
        setStatus({ state: 'error', progress: 0, message: error?.message ?? String(error) })
        throw error
    }
}

/** Removes the models of a language pair from the device. */
export async function removeLocal(pairs?: string[]): Promise<void> {
    const list = pairs ?? installed.slice()
    const cache = await openCache()

    if(cache !== null && registry === null){
        try {
            registry = await (await fetch(assetUrl('registry.json'))).json()
        } catch(error) {
            // The files stay in the cache then
        }
    }

    for(const pair of list){
        const files = registry === null ? undefined : (registry as any)[pair]
        if(cache !== null && files !== undefined){
            for(const file of Object.values(files) as RegistryFile[]){
                if(file !== undefined && typeof file.name === 'string'){
                    await cache.delete(file.name)
                }
            }
        }
    }

    writeInstalled(installed.filter(pair => list.indexOf(pair) < 0))

    // The memory of the worker is given back too
    if(enginePromise !== null){
        const pending = enginePromise
        enginePromise = null
        try {
            const { translator } = await pending
            await translator.delete()
        } catch(error) {
            // Nothing to clean up
        }
    }
    setStatus({ state: 'idle', progress: 0, message: '' })
}

/** Translates a text on the device. Throws when the models are not there (the caller uses the online service then). */
export async function translateLocal(text: string, from: string, to: string): Promise<string> {
    if(!isLocalInstalled(from, to)){
        throw new Error('the local translator has no model for ' + from + ' -> ' + to)
    }

    const first = status.state !== 'ready'
    if(first){
        setStatus({ state: 'loading', message: '' })
    }

    try {
        const { translator } = await getEngine()
        const answer: any = await Promise.race([
            translator.translate({ from, to, text, html: false }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('the local translator is too slow')), TRANSLATE_TIMEOUT_MS)),
        ])

        if(status.state === 'loading'){
            setStatus({ state: 'ready' })
        }
        return String(answer?.target?.text ?? '')
    } catch(error: any) {
        if(status.state === 'loading'){
            setStatus({ state: 'error', message: error?.message ?? String(error) })
        }
        throw error
    }
}
