import { extendsText, isSameReading, normalizeText, templateKey } from './engine'

/** One line of the conversation, as the player has seen it translated. */
export interface LogLine {
    id: number;
    // Which window it came from (a line that is typed grows in the same window)
    source: string;
    original: string;
    translated: string;
    at: number;
}

export const LOG_MAX = 40

const NOT_ALNUM = new RegExp('[^\\p{L}\\p{N}]', 'gu')

// A line that is read again within this time, and looks like the last lines of the same window, replaces them
const REPLACE_MS = 12000
const REPLACE_LOOKBACK = 4
// The same translation among this many last lines is not added again
const DUPLICATE_LOOKBACK = 12

/**
 * Adds what is on screen in one window to the log of the conversation. Returns the new log (or the same one when
 * nothing was added). A line that was caught while it was typed, or read a little differently, replaces the earlier
 * catch of itself instead of being added again, and a line that is in the log already is not added twice.
 */
export function addToLog(list: LogLine[], source: string, segments: Array<{ original: string; translated: string }>, now: number, nextId: () => number): LogLine[] {
    let result = list

    for(const segment of segments){
        const translated = segment.translated.trim()
        const original = segment.original.trim()
        if(translated.replace(NOT_ALNUM, '').length < 6){
            continue
        }

        const key = normalizeText(translated)
        if(result.slice(-DUPLICATE_LOOKBACK).some(line => normalizeText(line.translated) === key)){
            continue
        }

        const originalKey = templateKey(original)
        let position = -1
        for(let i = result.length - 1; i >= 0 && i >= result.length - REPLACE_LOOKBACK; i--){
            const line = result[i]
            if(line.source === source && now - line.at < REPLACE_MS && (extendsText(line.original, original) || isSameReading(originalKey, templateKey(line.original)))){
                position = i
                break
            }
        }

        if(position >= 0){
            result = result.slice()
            result[position] = { ...result[position], original, translated, at: now }
        } else {
            result = result.concat({ id: nextId(), source, original, translated, at: now })
            if(result.length > LOG_MAX){
                result = result.slice(result.length - LOG_MAX)
            }
        }
    }

    return result
}
