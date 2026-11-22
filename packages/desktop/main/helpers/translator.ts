import axios from 'axios'
import crypto from 'crypto'

// A translation service with a key of the player (optional): DeepL (the free plan has a key that ends with ":fx") or
// Google Cloud Translation. Without a key, or when the key does not work, the free key-less services are used.
export type KeyProvider = 'none' | 'deepl' | 'google'

export interface TranslateArgs {
    text: string;
    from?: string;
    to: string;
    // The key of the player: which service, the key, and how many characters a month the plan allows (0: do not count)
    provider?: KeyProvider;
    key?: string;
    limit?: number;
}

// Why a service did not answer:
//  invalid: the key is wrong, or the service is not switched on for it (nothing helps until the key is changed)
//  quota: the plan is used up (try again later: the plan may start again, and so may a daily limit)
//  rate: too many requests in a short time (try again soon)
//  temporary: the service is down or the network is (try again soon)
//  unsupported: this language is not offered by the service (only this request goes elsewhere)
//  limit: the number of characters that the player allows for a month is reached (checked at every request, so a
//         higher limit works at once; never put aside)
export type FailReason = 'invalid' | 'quota' | 'rate' | 'temporary' | 'unsupported' | 'limit'

export class ProviderError extends Error {
    reason: FailReason
    status: number

    constructor(reason: FailReason, message: string, status = 0) {
        super(message)
        this.reason = reason
        this.status = status
    }
}

export interface Storage {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
}

interface Health {
    // Failures in a row, and how many times the service had to be put aside in a row (the pause grows with it)
    failures: number;
    strikes: number;
    until: number;
    reason: FailReason | null;
    message: string;
}

export interface KeyStatus {
    provider: KeyProvider;
    state: 'ok' | FailReason;
    retryAt: number;
    usedChars: number;
    limit: number;
    message: string;
}

export interface TranslatorStatus {
    key: KeyStatus | null;
    // Which service made the last translation
    lastProvider: string;
    free: { google: 'ok' | FailReason; myMemory: 'ok' | FailReason };
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// The limit of a plan is not used to the last character: the service would refuse the translation that goes over it
const LIMIT_SHARE = 0.98
const KEY_TIMEOUT_MS = 5000

function monthOf(now: number): string {
    const date = new Date(now)
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0')
}

// How long a service is put aside after it failed
export function pauseFor(reason: FailReason, failures: number, strikes: number, now: number): number {
    switch(reason){
        case 'invalid':
            return Infinity
        case 'quota':
            return Math.min(24 * HOUR, HOUR * Math.pow(2, Math.max(0, strikes - 1)))
        case 'rate':
            return Math.min(10 * MINUTE, 30 * 1000 * Math.pow(2, Math.max(0, strikes - 1)))
        case 'temporary':
            // One failed request is bad luck; three in a row mean the service is down
            return failures >= 3 ? Math.min(5 * MINUTE, 30 * 1000 * Math.pow(2, Math.max(0, strikes - 1))) : 0
        default:
            return 0
    }
}

/** Turns an error of a request into a reason (never keeps the key: the text of an error may repeat what was sent). */
export function classify(error: any, secret = ''): ProviderError {
    if(error instanceof ProviderError){
        return error
    }

    let message = String(error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Translation failed')
    if(secret !== ''){
        message = message.split(secret).join('***')
    }

    const status: number = error?.response?.status ?? 0
    const reasons: string[] = (error?.response?.data?.error?.errors || []).map((item: any) => String(item?.reason || ''))
    const text = (message + ' ' + reasons.join(' ')).toLowerCase()

    if(status === 0){
        return new ProviderError('temporary', message)
    }
    // Too many requests (soon again) comes before the plan (much later): "Rate Limit Exceeded" is not "Quota Exceeded"
    if(status === 429 || status === 529 || /rate ?limit|too many/.test(text)){
        return new ProviderError('rate', message, status)
    }
    if(/billing/.test(text)){
        return new ProviderError('invalid', message, status)
    }
    if(status === 456 || /quota|daily ?limit|limit exceeded/.test(text)){
        return new ProviderError('quota', message, status)
    }
    if(status === 401 || status === 403 || /api key|keyinvalid|accessnotconfigured|service_disabled|not enabled|authorization/.test(text)){
        return new ProviderError('invalid', message, status)
    }
    if(status === 400){
        return new ProviderError('unsupported', message, status)
    }
    return new ProviderError('temporary', message, status)
}

// Free, key-less translation. Google's public endpoint is used first, MyMemory is the fallback.
// Results are cached so the same line is never requested twice.
export default class Translator {

    _cache: Map<string, string> = new Map()
    _health: Map<string, Health> = new Map()
    _storage: Storage | null
    _lastProvider = ''
    _now: () => number

    constructor(storage: Storage | null = null, now: () => number = () => Date.now()) {
        this._storage = storage
        this._now = now
    }

    _id(provider: KeyProvider, key: string): string {
        return 'key:' + provider + ':' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 12)
    }

    _healthOf(id: string): Health {
        let health = this._health.get(id)
        if(health === undefined){
            health = { failures: 0, strikes: 0, until: 0, reason: null, message: '' }
            this._health.set(id, health)
        }
        return health
    }

    _usable(id: string): boolean {
        return this._healthOf(id).until <= this._now()
    }

    _succeeded(id: string) {
        const health = this._healthOf(id)
        health.failures = 0
        health.strikes = 0
        health.until = 0
        health.reason = null
        health.message = ''
    }

    _failed(id: string, error: ProviderError) {
        const health = this._healthOf(id)
        const now = this._now()
        health.failures++
        health.reason = error.reason
        health.message = error.message

        // A request that this service cannot do (a language it does not offer) says nothing about the service
        if(error.reason === 'unsupported'){
            health.failures = 0
            return
        }

        // A service that was tried again after a pause and failed again is put aside for longer
        const strikes = health.strikes + 1
        const pause = pauseFor(error.reason, health.failures, strikes, now)
        if(pause > 0){
            health.strikes = strikes
        }
        health.until = pause === 0 ? 0 : (pause === Infinity ? Infinity : now + pause)
    }

    // The characters sent to the service of the player in this month (kept between runs)
    _usage(id: string): number {
        const stored = this._storage?.get('translator_usage')
        const month = monthOf(this._now())
        return stored && stored.id === id && stored.month === month ? Number(stored.chars) || 0 : 0
    }

    _addUsage(id: string, chars: number) {
        if(this._storage === null){
            return
        }
        this._storage.set('translator_usage', { id, month: monthOf(this._now()), chars: this._usage(id) + chars })
    }

    async translate(args: TranslateArgs): Promise<string> {
        const text = (args.text || '').trim().slice(0, 1500)
        const from = args.from || 'en'
        const to = args.to || 'en'

        if(text === ''){
            return ''
        }

        if(from === to){
            return text
        }

        const key = from + '|' + to + '|' + text
        const cached = this._cache.get(key)
        if(cached !== undefined){
            return cached
        }

        const secret = (args.key || '').trim()
        const provider: KeyProvider = secret !== '' && (args.provider === 'deepl' || args.provider === 'google') ? args.provider : 'none'
        const id = provider === 'none' ? '' : this._id(provider, secret)
        const limit = Math.max(0, Math.floor(args.limit || 0))

        let result = ''
        let lastError: ProviderError | null = null

        // 1. The service of the player, while it works and while the plan lasts
        if(provider !== 'none' && this._usable(id)){
            if(limit > 0 && this._usage(id) + text.length > limit * LIMIT_SHARE){
                // The plan of the player is used up (as he counts it): the free services take over until the month is over
                lastError = new ProviderError('limit', 'The monthly limit of characters is reached')
            } else {
                try {
                    result = provider === 'deepl' ? await this.deepl(text, from, to, secret) : await this.googleCloud(text, from, to, secret)
                    this._succeeded(id)
                    this._addUsage(id, text.length)
                    this._lastProvider = provider
                } catch(error) {
                    lastError = classify(error, secret)
                    this._failed(id, lastError)
                }
            }
        }

        // 2. The free services (the second one when the first has failed or has been put aside)
        if(result === ''){
            const free: Array<[string, () => Promise<string>]> = [
                ['free:google', () => this.google(text, from, to)],
                ['free:mymemory', () => this.myMemory(text, from, to)],
            ]

            for(let pass = 0; pass < 2 && result === ''; pass++){
                for(const [name, run] of free){
                    // On the second pass nobody is put aside: better a try that may fail than no translation at all
                    if(pass === 0 && !this._usable(name)){
                        continue
                    }

                    try {
                        result = await run()
                        this._succeeded(name)
                        this._lastProvider = name
                        break
                    } catch(error) {
                        lastError = classify(error)
                        this._failed(name, lastError)
                    }
                }
            }
        }

        if(result === ''){
            throw lastError ?? new Error('Translation failed')
        }

        if(this._cache.size > 500){
            this._cache.delete(this._cache.keys().next().value as string)
        }
        this._cache.set(key, result)

        return result
    }

    /** How things stand: whether the key works, how much of the plan is used, and which service answered last. */
    status(args: { provider?: KeyProvider; key?: string; limit?: number }): TranslatorStatus {
        const secret = (args.key || '').trim()
        const provider: KeyProvider = secret !== '' && (args.provider === 'deepl' || args.provider === 'google') ? args.provider : 'none'
        const now = this._now()
        const stateOf = (id: string): 'ok' | FailReason => {
            const health = this._healthOf(id)
            return health.until > now && health.reason !== null ? health.reason : 'ok'
        }

        let key: KeyStatus | null = null
        if(provider !== 'none'){
            const id = this._id(provider, secret)
            const health = this._healthOf(id)
            const limit = Math.max(0, Math.floor(args.limit || 0))
            const used = this._usage(id)
            key = {
                provider,
                state: limit > 0 && used >= limit * LIMIT_SHARE ? 'limit' : stateOf(id),
                retryAt: health.until > now ? health.until : 0,
                usedChars: used,
                limit,
                message: health.message,
            }
        }

        return { key, lastProvider: this._lastProvider, free: { google: stateOf('free:google'), myMemory: stateOf('free:mymemory') } }
    }

    /** Tries the key with a short text, whatever it was before (the player has just typed it or pressed the button). */
    async testKey(args: { provider?: KeyProvider; key?: string }): Promise<{ ok: boolean; reason?: FailReason; message?: string; sample?: string }> {
        const secret = (args.key || '').trim()
        if(secret === '' || (args.provider !== 'deepl' && args.provider !== 'google')){
            return { ok: false, reason: 'invalid', message: 'No key' }
        }

        const id = this._id(args.provider, secret)
        try {
            const sample = args.provider === 'deepl' ? await this.deepl('Hello', 'en', 'uk', secret) : await this.googleCloud('Hello', 'en', 'uk', secret)
            this._succeeded(id)
            return { ok: true, sample }
        } catch(error) {
            const failure = classify(error, secret)
            this._failed(id, failure)
            return { ok: false, reason: failure.reason, message: failure.message }
        }
    }

    async deepl(text: string, from: string, to: string, key: string): Promise<string> {
        const base = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
        const target = ({ en: 'EN-US', pt: 'PT-PT', zh: 'ZH-HANS' } as Record<string, string>)[to.toLowerCase()] || to.toUpperCase()

        const response = await axios.post(base + '/v2/translate', {
            text: [text],
            source_lang: from.toUpperCase().split('-')[0],
            target_lang: target,
        }, {
            headers: { 'Authorization': 'DeepL-Auth-Key ' + key, 'Content-Type': 'application/json' },
            timeout: KEY_TIMEOUT_MS,
        })

        const translated = response.data?.translations?.[0]?.text
        if(typeof translated !== 'string' || translated === ''){
            throw new ProviderError('temporary', 'Unexpected translation response')
        }
        return translated
    }

    async googleCloud(text: string, from: string, to: string, key: string): Promise<string> {
        // The key goes in a header, not in the address: an address ends up in error messages
        const response = await axios.post('https://translation.googleapis.com/language/translate/v2', {
            q: text,
            source: from,
            target: to,
            format: 'text',
        }, {
            headers: { 'X-goog-api-key': key, 'Content-Type': 'application/json' },
            timeout: KEY_TIMEOUT_MS,
        })

        const translated = response.data?.data?.translations?.[0]?.translatedText
        if(typeof translated !== 'string' || translated === ''){
            throw new ProviderError('temporary', 'Unexpected translation response')
        }

        // The service answers with HTML entities even for plain text in some cases
        return translated.replace(/&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    }

    async google(text: string, from: string, to: string): Promise<string> {
        const response = await axios.get('https://translate.googleapis.com/translate_a/single', {
            params: { client: 'gtx', sl: from, tl: to, dt: 't', q: text },
            timeout: 8000,
        })

        const parts = response.data?.[0]
        if(!Array.isArray(parts)){
            throw new Error('Unexpected translation response')
        }

        return parts.map((part: any) => part?.[0] ?? '').join('').trim()
    }

    async myMemory(text: string, from: string, to: string): Promise<string> {
        const response = await axios.get('https://api.mymemory.translated.net/get', {
            params: { q: text.slice(0, 480), langpair: from + '|' + to },
            timeout: 8000,
        })

        const translated = response.data?.responseData?.translatedText
        // When the free allowance of the day is used up the service answers with a warning instead of a translation
        if(typeof translated !== 'string' || translated === '' || /^MYMEMORY WARNING/i.test(translated) || (response.data?.responseStatus !== undefined && Number(response.data.responseStatus) >= 400)){
            throw new ProviderError('quota', 'Translation failed')
        }

        return translated
    }
}
