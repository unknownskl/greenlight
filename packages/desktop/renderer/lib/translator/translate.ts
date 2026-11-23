import Ipc from '../ipc'
import { Translation, TranslateFunction } from './engine'
import { CatalogChoice, isLocalInstalled, translateLocal } from './local'

export type LocalMode = 'off' | 'smart' | 'local' | 'backup'

// In the "smart" mode the online translation gets this long to answer before the local draft is shown
export const DRAFT_WAIT_MS = 250
// When the online service is usually slower than this, waiting for it is pointless: the draft is shown almost at once
const SLOW_ONLINE_MS = 300
const SLOW_WAIT_MS = 100

// How long the online service takes on average (a moving average)
let onlineAverage = 0

interface TranslatorSettings {
    translator_local_mode?: string;
    translator_local_engine?: string;
}

/** Which list of models is used (auto: the one whose models are on the device). */
export function localEngine(settings: TranslatorSettings): CatalogChoice {
    const choice = settings.translator_local_engine
    return choice === 'firefox' || choice === 'bergamot' ? choice : 'auto'
}

export function localMode(settings: TranslatorSettings): LocalMode {
    const mode = settings.translator_local_mode
    return mode === 'off' || mode === 'local' || mode === 'backup' ? mode : 'smart'
}

/** The free online services, through the main process. */
function translateOnline(text: string, from: string, to: string): Promise<string> {
    return Ipc.send('app', 'translateText', { text, from, to }) as Promise<string>
}

/**
 * The translation of a text, made of the local translator and the online services:
 *  - smart (the default once the models are on the device): both are asked at once. The online one is better but needs
 *    a moment; when it does not answer within DRAFT_WAIT_MS the local translation is shown at once and replaced by the
 *    online one when that comes (if it differs). Without internet the local one stays.
 *  - local: only the local translator (nothing leaves the device); the online services only for what it cannot do.
 *  - backup: the online services; the local translator only when they fail.
 *  - off: only the online services.
 */
export function createTranslate(getSettings: () => TranslatorSettings): TranslateFunction {
    return async (text: string, target: string, source: string): Promise<string | Translation> => {
        const settings = getSettings()
        const mode = localMode(settings)
        const engine = localEngine(settings)
        const usable = mode !== 'off' && isLocalInstalled(source, target, engine)

        if(!usable){
            return translateOnline(text, source, target)
        }

        if(mode === 'local'){
            try {
                return await translateLocal(text, source, target, engine)
            } catch(error) {
                return translateOnline(text, source, target)
            }
        }

        if(mode === 'backup'){
            try {
                return await translateOnline(text, source, target)
            } catch(error) {
                return translateLocal(text, source, target, engine)
            }
        }

        // smart
        const asked = Date.now()
        const online = translateOnline(text, source, target)
        online.then(() => {
            const took = Date.now() - asked
            onlineAverage = onlineAverage === 0 ? took : onlineAverage * 0.7 + took * 0.3
        }, () => { /* handled below */ })

        const wait = new Promise<null>((resolve) => setTimeout(() => resolve(null), onlineAverage > SLOW_ONLINE_MS ? SLOW_WAIT_MS : DRAFT_WAIT_MS))
        const quick = await Promise.race([online.then(value => value, () => undefined), wait])
        if(typeof quick === 'string' && quick !== ''){
            return quick
        }

        let draft: string
        try {
            draft = await translateLocal(text, source, target, engine)
        } catch(error) {
            return online
        }

        if(draft === ''){
            return online
        }

        return {
            text: draft,
            better: online.then(value => (value !== '' && value !== draft) ? value : null, () => null),
        }
    }
}
