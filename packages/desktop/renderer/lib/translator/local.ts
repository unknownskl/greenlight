/**
 * The local translator: small translation models (Bergamot / Marian, the same as in the Firefox translator) that run
 * on the device in a worker. A translation takes some milliseconds, works without internet and the text never leaves
 * the device. A model is about 35 MB for one language pair; it is downloaded when the player asks for it
 * (Settings -> Translator) and kept in the browser cache. The engine and the worker are bundled with the app
 * (renderer/public/bergamot).
 */

import firefoxRegistry from './registries/firefox.json'
import bergamotRegistry from './registries/bergamot.json'

export type LocalState = 'idle' | 'downloading' | 'loading' | 'ready' | 'error'

// Two lists of models for the same engine: the newer models of the Firefox translator (more language pairs), and the
// models published by the Bergamot project itself. The player can pick one, or leave it to the app ("auto": the one
// whose models are on the device, else the Firefox one).
export type Catalog = 'firefox' | 'bergamot'
export type CatalogChoice = Catalog | 'auto'
export const CATALOGS: Catalog[] = ['firefox', 'bergamot']

export interface LocalStatus {
    state: LocalState;
    // 0..1 while a model is downloaded
    progress: number;
    // The models that are on the device ('firefox:enuk' = English -> Ukrainian from the Firefox list)
    installed: string[];
    message: string;
}

const REGISTRIES: Record<Catalog, Record<string, Record<string, RegistryFile>>> = {
    firefox: firefoxRegistry as any,
    bergamot: bergamotRegistry as any,
}

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

/** The models (pairs) that are needed to translate from one language to the other with one list; [] when it is not possible. */
export function modelsFor(from: string, to: string, catalog: Catalog = 'firefox'): string[] {
    const registry = REGISTRIES[catalog]
    if(from === to || from === '' || to === ''){
        return []
    }
    if(registry[from + to] !== undefined){
        return [from + to]
    }
    if(registry[from + PIVOT] !== undefined && registry[PIVOT + to] !== undefined){
        return [from + PIVOT, PIVOT + to]
    }
    return []
}

export function isLocalSupported(from: string, to: string): boolean {
    return CATALOGS.some(catalog => modelsFor(from, to, catalog).length > 0)
}

/**
 * The list of models to use for a language pair: the one the player chose, or (auto) the one whose models are on the
 * device, else the first one that can do the pair. null when no list can.
 */
export function pickCatalog(from: string, to: string, choice: CatalogChoice = 'auto'): Catalog | null {
    if(choice !== 'auto'){
        return modelsFor(from, to, choice).length > 0 ? choice : null
    }

    const possible = CATALOGS.filter(catalog => modelsFor(from, to, catalog).length > 0)
    return possible.find(catalog => isInstalledIn(catalog, from, to)) ?? possible[0] ?? null
}

function isInstalledIn(catalog: Catalog, from: string, to: string): boolean {
    const needed = modelsFor(from, to, catalog)
    return needed.length > 0 && needed.every(pair => installed.indexOf(catalog + ':' + pair) >= 0)
}

let installed: string[] = readInstalled()
let status: LocalStatus = { state: 'idle', progress: 0, installed, message: '' }
const listeners = new Set<() => void>()

function readInstalled(): string[] {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORE_KEY) || '[]')
        if(!Array.isArray(parsed)){
            return []
        }
        // Models stored before there were two lists belong to the Bergamot list
        return parsed.filter((item: any) => typeof item === 'string').map((item: string) => item.indexOf(':') < 0 ? 'bergamot:' + item : item)
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

/** Are all models that this pair needs on the device (in the list that is used)? */
export function isLocalInstalled(from: string, to: string, choice: CatalogChoice = 'auto'): boolean {
    const catalog = pickCatalog(from, to, choice)
    return catalog !== null && isInstalledIn(catalog, from, to)
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

// One engine (and worker) per list: the models of the lists have the same names
const engines: Record<Catalog, Promise<Engine> | null> = { firefox: null, bergamot: null }

async function getEngine(catalog: Catalog): Promise<Engine> {
    if(engines[catalog] === null){
        engines[catalog] = (async () => {
            // The engine is a plain script of the app (not part of the bundle)
            const module: any = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ assetUrl('translator.js'))
            const registry = REGISTRIES[catalog]

            class Backing extends module.TranslatorBacking {
                constructor(options: any) {
                    super(options)
                }

                // The list of models comes with the app: it works without internet
                async loadModelRegistery() {
                    return Object.entries(registry).map(([key, files]) => ({ from: key.substring(0, 2), to: key.substring(2, 4), files }))
                }

                async fetch(url: string, checksum: string | undefined, extra?: { signal?: AbortSignal }) {
                    return download(url, checksum, extra?.signal)
                }
            }

            const backing = new Backing({ downloadTimeout: 0, pivotLanguage: PIVOT })
            const translator = new module.BatchTranslator({ workers: 1, batchSize: 4, cacheSize: 0, downloadTimeout: 0, pivotLanguage: PIVOT }, backing)
            return { translator, backing }
        })()

        ;(engines[catalog] as Promise<Engine>).catch(() => {
            engines[catalog] = null
        })
    }
    return engines[catalog] as Promise<Engine>
}

/** Downloads the models that translating from one language to the other needs. */
export async function installLocal(from: string, to: string, choice: CatalogChoice = 'auto'): Promise<void> {
    const catalog = pickCatalog(from, to, choice)
    if(catalog === null){
        throw new Error('no model for ' + from + ' -> ' + to)
    }
    const needed = modelsFor(from, to, catalog)
    if(status.state === 'downloading'){
        return
    }

    received.clear()
    expected = 0
    setStatus({ state: 'downloading', progress: 0, message: '' })

    try {
        const { backing } = await getEngine(catalog)

        for(const pair of needed){
            Object.values(REGISTRIES[catalog][pair]).forEach((file) => {
                if(file !== undefined && typeof file.size === 'number'){ expected += file.size }
            })
        }

        for(const pair of needed){
            await backing.getTranslationModel({ from: pair.substring(0, 2), to: pair.substring(2, 4) })
            const key = catalog + ':' + pair
            if(installed.indexOf(key) < 0){
                writeInstalled(installed.concat(key))
            }
        }
        setStatus({ state: 'ready', progress: 1, message: '' })
    } catch(error: any) {
        setStatus({ state: 'error', progress: 0, message: error?.message ?? String(error) })
        throw error
    }
}

/** Removes models from the device (all of them when none are named). */
export async function removeLocal(keys?: string[]): Promise<void> {
    const list = keys ?? installed.slice()
    const cache = await openCache()

    for(const key of list){
        const [catalog, pair] = key.split(':') as [Catalog, string]
        const files = REGISTRIES[catalog]?.[pair]
        if(cache !== null && files !== undefined){
            for(const file of Object.values(files)){
                if(file !== undefined && typeof file.name === 'string'){
                    await cache.delete(file.name)
                }
            }
        }
    }

    writeInstalled(installed.filter(key => list.indexOf(key) < 0))

    // The memory of the workers is given back too
    for(const catalog of CATALOGS){
        const pending = engines[catalog]
        if(pending !== null){
            engines[catalog] = null
            try {
                const { translator } = await pending
                await translator.delete()
            } catch(error) {
                // Nothing to clean up
            }
        }
    }
    setStatus({ state: 'idle', progress: 0, message: '' })
}

/** Translates a text on the device. Throws when the models are not there (the caller uses the online service then). */
export async function translateLocal(text: string, from: string, to: string, choice: CatalogChoice = 'auto'): Promise<string> {
    const catalog = pickCatalog(from, to, choice)
    if(catalog === null || !isInstalledIn(catalog, from, to)){
        throw new Error('the local translator has no model for ' + from + ' -> ' + to)
    }

    const first = status.state !== 'ready'
    if(first){
        setStatus({ state: 'loading', message: '' })
    }

    try {
        const { translator } = await getEngine(catalog)
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
