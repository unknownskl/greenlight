import axios from 'axios'

export interface TranslateArgs {
    text: string;
    from?: string;
    to: string;
}

// Free, key-less translation. Google's public endpoint is used first, MyMemory is the fallback.
// Results are cached so the same line is never requested twice.
export default class Translator {

    _cache: Map<string, string> = new Map()

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
        try {
            result = await this.google(text, from, to)
        } catch(error) {
            result = await this.myMemory(text, from, to)
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
        if(typeof translated !== 'string' || translated === ''){
            throw new Error('Translation failed')
        }

        return translated
    }
}
