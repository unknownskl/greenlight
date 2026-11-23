import axios from 'axios'

export interface TranslateArgs {
    text: string;
    from?: string;
    to: string;
}

// Why a service did not answer:
//  quota: the allowance is used up (try again later)
//  rate: too many requests in a short time (try again soon)
//  temporary: the service is down or the network is (try again soon)
export type FailReason = 'quota' | 'rate' | 'temporary'

export class ProviderError extends Error {
    reason: FailReason
    status: number

    constructor(reason: FailReason, message: string, status = 0) {
        super(message)
        this.reason = reason
        this.status = status
    }
}

interface Health {
    // Failures in a row, and how many times the service had to be put aside in a row (the pause grows with it)
    failures: number;
    strikes: number;
    until: number;
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// How long a service is put aside after it failed
export function pauseFor(reason: FailReason, failures: number, strikes: number): number {
    switch(reason){
        case 'quota':
            return Math.min(24 * HOUR, HOUR * Math.pow(2, Math.max(0, strikes - 1)))
        case 'rate':
            return Math.min(10 * MINUTE, 30 * 1000 * Math.pow(2, Math.max(0, strikes - 1)))
        default:
            // One failed request is bad luck; three in a row mean the service is down
            return failures >= 3 ? Math.min(5 * MINUTE, 30 * 1000 * Math.pow(2, Math.max(0, strikes - 1))) : 0
    }
}

/** Turns an error of a request into a reason. */
export function classify(error: any): ProviderError {
    if(error instanceof ProviderError){
        return error
    }

    const message = String(error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Translation failed')
    const status: number = error?.response?.status ?? 0

    // Too many requests (soon again) comes before the allowance (much later)
    if(status === 429 || status === 529 || /rate ?limit|too many/i.test(message)){
        return new ProviderError('rate', message, status)
    }
    if(status === 456 || /quota|daily ?limit|limit exceeded/i.test(message)){
        return new ProviderError('quota', message, status)
    }
    return new ProviderError('temporary', message, status)
}

// Free, key-less translation. Google's public endpoint is used first, MyMemory is the fallback; a service that fails
// is put aside for a while (longer every time) and the other one is used. Results are cached so the same line is never
// requested twice.
export default class Translator {

    _cache: Map<string, string> = new Map()
    _health: Map<string, Health> = new Map()
    _now: () => number

    constructor(now: () => number = () => Date.now()) {
        this._now = now
    }

    _healthOf(id: string): Health {
        let health = this._health.get(id)
        if(health === undefined){
            health = { failures: 0, strikes: 0, until: 0 }
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
    }

    _failed(id: string, error: ProviderError) {
        const health = this._healthOf(id)
        health.failures++

        // A service that was tried again after a pause and failed again is put aside for longer
        const strikes = health.strikes + 1
        const pause = pauseFor(error.reason, health.failures, strikes)
        if(pause > 0){
            health.strikes = strikes
        }
        health.until = pause === 0 ? 0 : this._now() + pause
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

        let result = ''
        let lastError: ProviderError | null = null

        const services: Array<[string, () => Promise<string>]> = [
            ['google', () => this.google(text, from, to)],
            ['mymemory', () => this.myMemory(text, from, to)],
        ]

        for(let pass = 0; pass < 2 && result === ''; pass++){
            for(const [name, run] of services){
                // On the second pass nobody is put aside: better a try that may fail than no translation at all
                if(pass === 0 && !this._usable(name)){
                    continue
                }

                try {
                    result = await run()
                    this._succeeded(name)
                    break
                } catch(error) {
                    lastError = classify(error)
                    this._failed(name, lastError)
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
