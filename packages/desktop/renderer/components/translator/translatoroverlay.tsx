import React from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/router'

import { useSettings } from '../../context/userContext'
import Ipc from '../../lib/ipc'
import { createTranslate } from '../../lib/translator/translate'
import { Region, FitMode, DEFAULT_REGION, MAX_REGIONS, getRegions, regionsToSettings, constrainRegion, findFreeRegion, windowMode } from '../../lib/translator/geometry'
import TranslatorEngine, { EngineStatus, TranslatorResult, TranslatedSegment, TextColor, dropCovered } from '../../lib/translator/engine'
import { LogLine, addToLog as appendToLog } from '../../lib/translator/dialoglog'
import { terminateOcr } from '../../lib/translator/ocr'
import AutoWindows, { AutoFrame, MAX_AUTO_WINDOWS, Zone } from '../../lib/translator/autowindows'
import ElementsEngine, { ElementResult } from '../../lib/translator/elements'
import usePadRegion from '../../lib/translator/usepadregion'
import RegionEditor from './regioneditor'

export const TRANSLATOR_EDIT_EVENT = 'greenlight-translator-edit'

interface TranslatorOverlayProps {
    xPlayer: any;
}

let measureContext: CanvasRenderingContext2D | null | undefined

// The dialogue log shows this many of the last lines
const LOG_SHOWN = 6

// How many rows a text takes when it is wrapped at `width` (a word is never cut)
function wrapRows(text: string, size: number, width: number): number {
    let rows = 1
    let line = 0
    const space = textWidth(' ', size)

    for(const word of text.split(/\s+/)){
        const length = textWidth(word, size)
        if(line > 0 && line + space + length > width){
            rows++
            line = length
        } else {
            line = line === 0 ? length : line + space + length
        }
    }
    return rows
}

function textWidth(text: string, size: number): number {
    if(measureContext === undefined){
        measureContext = document.createElement('canvas').getContext('2d')
    }

    if(measureContext === null){
        return text.length * size * 0.55
    }

    measureContext.font = '600 ' + size + 'px "Segoe UI", Helvetica, Arial, sans-serif'
    return measureContext.measureText(text).width
}

/** Position, size and colours of the translation of one piece of text, so it looks like the interface it replaces. */
/** Where the next piece of text below this one starts (fraction of the height), so the translation does not run over it. */
export function nextBelow(segments: TranslatedSegment[], index: number): number | undefined {
    const segment = segments[index]
    let best: number | undefined
    segments.forEach((other, i) => {
        const overlapsInX = other.rect.x < segment.rect.x + segment.rect.w + 0.1 && other.rect.x + other.rect.w > segment.rect.x - 0.1
        if(i !== index && overlapsInX && other.rect.y > segment.rect.y + segment.rect.h * 0.4 && (best === undefined || other.rect.y < best)){
            best = other.rect.y
        }
    })
    return best
}

/** How much of the first box lies inside the second one (0..1). */
function coveredBy(inner: Region, outer: Region): number {
    const width = Math.min(inner.x + inner.w, outer.x + outer.w) - Math.max(inner.x, outer.x)
    const height = Math.min(inner.y + inner.h, outer.y + outer.h) - Math.max(inner.y, outer.y)
    if(width <= 0 || height <= 0){
        return 0
    }
    return (width * height) / Math.max(1e-9, inner.w * inner.h)
}

/** The nearest piece of text on the same row to the left and to the right (fractions of the width): the translation stays between them. */
export function sideLimits(segments: TranslatedSegment[], index: number): { left?: number; right?: number } {
    const segment = segments[index]
    const limits: { left?: number; right?: number } = {}
    segments.forEach((other, i) => {
        if(i === index){ return }
        const top = Math.max(segment.rect.y, other.rect.y)
        const bottom = Math.min(segment.rect.y + segment.rect.h, other.rect.y + other.rect.h)
        if(bottom - top < Math.min(segment.rect.h, other.rect.h) * 0.4){ return }

        if(other.rect.x >= segment.rect.x + segment.rect.w * 0.5 && other.rect.x + other.rect.w > segment.rect.x + segment.rect.w){
            limits.right = limits.right === undefined ? other.rect.x : Math.min(limits.right, other.rect.x)
        } else if(other.rect.x + other.rect.w <= segment.rect.x + segment.rect.w * 0.5 && other.rect.x < segment.rect.x){
            limits.left = limits.left === undefined ? other.rect.x + other.rect.w : Math.max(limits.left, other.rect.x + other.rect.w)
        }
    })
    return limits
}

export function segmentStyle(segment: TranslatedSegment, viewport: { width: number; height: number }, autoFont: boolean, fixedSize: number, opacity: number, below?: number, sides?: { left?: number; right?: number }, bounds?: Region): React.CSSProperties {
    const originalWidth = segment.rect.w * viewport.width
    const left = segment.rect.x * viewport.width
    const centerX = left + originalWidth / 2

    // One line of the original stays one line: the translation may grow sideways (as far as the picture goes),
    // so it does not wrap onto the line below, which is another piece of text
    const lines = Math.max(1, Math.round(segment.rect.h / Math.max(0.001, segment.lineHeight)))
    let room = segment.centered
        ? 2 * Math.min(centerX, viewport.width - centerX) - 16
        : viewport.width - left - 8
    // ... and not over the piece of text next to it on the same row
    if(sides !== undefined){
        const leftEdge = sides.left === undefined ? 0 : sides.left * viewport.width + 4
        const rightEdge = sides.right === undefined ? viewport.width : sides.right * viewport.width - 4
        room = segment.centered
            ? Math.min(room, 2 * Math.min(centerX - leftEdge, rightEdge - centerX))
            : Math.min(room, rightEdge - left)
    }
    // A text in a panel of the interface may use the whole panel (the width to its right edge, the height to its bottom)
    const panelWidth = bounds === undefined ? 0 : (bounds.x + bounds.w) * viewport.width - left - 10
    const panelHeight = bounds === undefined ? 0 : (bounds.y + bounds.h) * viewport.height - segment.rect.y * viewport.height - 6
    if(bounds !== undefined && !segment.centered){
        room = Math.min(room, Math.max(originalWidth, panelWidth))
    }

    // A paragraph keeps the width of the original (the translation is made to fit into it); one line may grow sideways
    const wide = Math.max(originalWidth * (lines === 1 ? 2.1 : 1.1), lines > 1 ? panelWidth : 0)
    const maxWidth = Math.max(Math.min(140, Math.max(60, room)), Math.min(room, wide))
    const originalHeight = segment.rect.h * viewport.height + 8
    // How tall the box may get: a paragraph stays inside the box of the original, a single line may take one more row
    const roomHeight = lines === 1 ? originalHeight * 2 : originalHeight * 1.12
    let allowed = Math.max(originalHeight, below === undefined ? roomHeight : Math.min(roomHeight * 1.5, (below - segment.rect.y) * viewport.height - 6))
    // ... in a panel a paragraph may go down to the bottom of the panel (but not over the text under it)
    if(bounds !== undefined && lines > 1){
        allowed = Math.max(allowed, below === undefined ? panelHeight : Math.min(panelHeight, (below - segment.rect.y) * viewport.height - 6))
    }

    // The size of the original text; shrunk when the translation is longer than the original and would not fit
    let size = autoFont ? Math.min(56, Math.max(12, segment.lineHeight * viewport.height * 1.02)) : fixedSize
    let singleLine = false
    if(autoFont){
        const base = size
        if(lines === 1){
            const wanted = textWidth(segment.translated, size)
            if(wanted > maxWidth){
                size = Math.max(size * 0.62, size * maxWidth / wanted)
            }
            singleLine = textWidth(segment.translated, size) <= maxWidth - 16
        }

        // The biggest size at which the translation fits into the box of the original
        if(!singleLine){
            const floor = Math.max(11, base * 0.5)
            while(size > floor && wrapRows(segment.translated, size, maxWidth - 20) * size * 1.22 + 12 > allowed){
                size = Math.max(floor, size * 0.94)
            }
        }
    }

    const [r, g, b] = segment.background
    // The box covers the original text completely (with a small margin around it)
    const style: React.CSSProperties = {
        top: 'calc(' + (segment.rect.y * 100) + '% - 4px)',
        whiteSpace: singleLine ? 'nowrap' : 'normal',
        maxWidth: maxWidth + 'px',
        minWidth: (Math.min(originalWidth, maxWidth) + 16) + 'px',
        minHeight: originalHeight + 'px',
        maxHeight: autoFont ? allowed + 'px' : undefined,
        overflow: 'hidden',
        fontSize: size + 'px',
        color: segment.foreground,
        background: 'rgba(' + r + ', ' + g + ', ' + b + ', ' + opacity + ')',
    }

    if(segment.centered){
        style.left = ((segment.rect.x + segment.rect.w / 2) * 100) + '%'
        style.transform = 'translateX(-50%)'
        style.textAlign = 'center'
        style.justifyContent = 'center'
    } else {
        style.left = 'calc(' + (segment.rect.x * 100) + '% - 8px)'
        style.textAlign = 'left'
        style.justifyContent = 'flex-start'
    }

    return style
}

/**
 * Shown on top of the stream: reads the text in the translation windows (up to MAX_REGIONS, they never overlap)
 * and shows the translation. The windows can be moved with the mouse / touch, or with the gamepad sticks while
 * "edit" mode is on.
 */
function TranslatorOverlay({
    xPlayer,
}: TranslatorOverlayProps) {
    const { settings, setSettings } = useSettings()
    const { t } = useTranslation()

    const settingsRef = React.useRef(settings)
    settingsRef.current = settings

    // Translation: the local translator and the online services (see createTranslate)
    const translateWithLocal = React.useMemo(() => createTranslate(() => settingsRef.current), [])

    const [results, setResults] = React.useState<(TranslatorResult | null)[]>([])
    const [statuses, setStatuses] = React.useState<EngineStatus[]>([])
    // The adaptive translator: translations in the windows it found, and (for the debug view) what it sees
    const [autoResults, setAutoResults] = React.useState<(TranslatorResult | null)[]>([])
    const [autoFrames, setAutoFrames] = React.useState<AutoFrame[]>([])
    // The translations of the elements of the interface (the engine with elements)
    const [elementResults, setElementResults] = React.useState<ElementResult[]>([])
    // The whole screen read as one (a menu, or when the player asks for it)
    const [menuAuto, setMenuAuto] = React.useState(false)
    // ... and the menu is confirmed: the whole-screen reading found text, so the windows rest and its translation is shown
    const [menuConfirmed, setMenuConfirmed] = React.useState(false)
    const [screenResult, setScreenResult] = React.useState<TranslatorResult | null>(null)
    const [flash, setFlash] = React.useState(false)
    const [editing, setEditing] = React.useState(false)
    const [toast, setToast] = React.useState('')
    const [active, setActive] = React.useState(0)
    const [draft, setDraft] = React.useState<Region>(getRegions(settings)[0])
    const draftRef = React.useRef(draft)
    draftRef.current = draft
    const activeRef = React.useRef(active)
    activeRef.current = active

    const enabled = settings.translator_enabled === true
    // The adaptive translator works in one of two ways: with windows and modes (classic) or with elements of the interface
    const autoWanted = enabled && settings.translator_auto === true
    const elementsOn = autoWanted && settings.translator_engine === 'elements'
    const autoOn = autoWanted && !elementsOn
    const screenOn = enabled && (settings.translator_fullscreen === true || (autoOn && menuAuto && settings.translator_menu_auto !== false))
    const screenOnRef = React.useRef(screenOn)
    screenOnRef.current = screenOn
    // A menu was recognised (not the whole-screen reading that the player asked for): the windows for subtitles rest then,
    // and what lies under them is read with the rest of the screen
    const menuActive = autoOn && menuAuto && menuConfirmed && settings.translator_menu_auto !== false
    // The player asked for the whole screen to be read: no windows of the adaptive mode then
    const forcedScreen = enabled && settings.translator_fullscreen === true
    const forcedScreenRef = React.useRef(forcedScreen)
    forcedScreenRef.current = forcedScreen
    const menuActiveRef = React.useRef(menuActive)
    menuActiveRef.current = menuActive
    // What is learned about a game (where its text is) is kept per console / game of the stream
    const router = useRouter()
    const profileKey = String(router.query.serverid ?? 'default')
    const profileKeyRef = React.useRef(profileKey)
    profileKeyRef.current = profileKey
    const autoRef = React.useRef<AutoWindows | null>(null)
    // The reader is restarted when the language of the game text is changed
    const sourceLang = settings.translator_source_lang || 'en'
    const regions = getRegions(settings)
    const count = regions.length
    const current = Math.min(active, count - 1)

    const toastTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const showToast = React.useCallback((text: string) => {
        setToast(text)
        if(toastTimer.current !== undefined){ clearTimeout(toastTimer.current) }
        toastTimer.current = setTimeout(() => setToast(''), 1800)
    }, [])

    // The dialogue log (it is kept while the stream is open, whether it is shown or not)
    const [log, setLog] = React.useState<LogLine[]>([])
    const logRef = React.useRef<LogLine[]>([])
    const logCounter = React.useRef(0)
    const addToLog = React.useCallback((source: string, result: TranslatorResult | null) => {
        if(result === null){
            return
        }

        const next = appendToLog(logRef.current, source, result.segments, Date.now(), () => ++logCounter.current)
        if(next !== logRef.current){
            logRef.current = next
            setLog(next)
        }
    }, [])

    // The text reader runs while the translator is on (one reader per window)
    React.useEffect(() => {
        setResults([])
        setStatuses([])

        if(!enabled){
            return
        }

        const engines: TranslatorEngine[] = []
        const timers: ReturnType<typeof setTimeout>[] = []

        for(let index = 0; index < count; index++){
            const engine = new TranslatorEngine({
                getVideo: () => (xPlayer?._videoComponent?._videoRender ?? document.querySelector('#streamComponent video')) as HTMLVideoElement | null,
                getBox: () => {
                    const rect = document.getElementById('streamComponent')?.getBoundingClientRect()
                    return { width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight }
                },
                getConfig: () => {
                    const region = getRegions(settingsRef.current)[index] ?? DEFAULT_REGION
                    return {
                    region,
                    enabled: region.enabled !== false && !(menuActiveRef.current && windowMode(region, index) === 'dialog'),
                    mode: windowMode(region, index),
                    color: (settingsRef.current.translator_text_color || 'light') as TextColor,
                    source: settingsRef.current.translator_source_lang || 'en',
                    target: settingsRef.current.translator_target_lang || 'uk',
                    fit: (settingsRef.current.video_size || 'default') as FitMode,
                    }
                },
                translate: translateWithLocal,
                onResult: (result) => {
                    setResults(previous => {
                        const next = previous.slice()
                        next[index] = result
                        return next
                    })
                    const region = getRegions(settingsRef.current)[index]
                    if(region !== undefined && windowMode(region, index) === 'dialog'){
                        addToLog('w' + index, result)
                    }
                },
                onStatus: (status) => setStatuses(previous => {
                    const next = previous.slice()
                    next[index] = status
                    return next
                }),
            })

            engines.push(engine)
            // Not all at once: the windows take turns on the processor
            timers.push(setTimeout(() => engine.start(), index * 250))
        }

        return () => {
            timers.forEach(timer => clearTimeout(timer))
            engines.forEach(engine => engine.stop())
        }
    }, [enabled, sourceLang, count])

    // The adaptive translator: finds the text on the whole screen by itself
    React.useEffect(() => {
        setAutoResults([])
        setAutoFrames([])
        setMenuAuto(false)
        setMenuConfirmed(false)

        if(!autoOn){
            return
        }

        let lastFrames = ''
        const auto = new AutoWindows({
            getVideo: () => (xPlayer?._videoComponent?._videoRender ?? document.querySelector('#streamComponent video')) as HTMLVideoElement | null,
            getBox: () => {
                const rect = document.getElementById('streamComponent')?.getBoundingClientRect()
                return { width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight }
            },
            getSettings: () => ({
                fit: (settingsRef.current.video_size || 'default') as FitMode,
                source: settingsRef.current.translator_source_lang || 'en',
                target: settingsRef.current.translator_target_lang || 'uk',
                color: (settingsRef.current.translator_text_color || 'light') as TextColor,
                panels: settingsRef.current.translator_panels !== false,
            }),
            getProfile: () => (settingsRef.current.translator_profile_on === false ? [] : ((settingsRef.current.translator_profiles ?? {})[profileKeyRef.current] ?? [])) as Zone[],
            onProfile: (zones) => {
                if(settingsRef.current.translator_profile_on === false){
                    return
                }
                setSettings({ ...settingsRef.current, translator_profiles: { ...(settingsRef.current.translator_profiles ?? {}), [profileKeyRef.current]: zones } })
            },
            getManualRegions: () => getRegions(settingsRef.current),
            translate: translateWithLocal,
            onResult: (slot, result, mode) => {
                setAutoResults(previous => {
                    const next = previous.slice()
                    next[slot] = result
                    return next
                })
                if(mode !== 'task'){
                    addToLog('a' + slot, result)
                }
            },
            onMenu: (menu, confirmed) => {
                setMenuAuto(menu)
                setMenuConfirmed(confirmed)
            },
            onFrames: (frames) => {
                const wanted = settingsRef.current.translator_auto_debug === true ? frames : []
                const key = JSON.stringify(wanted.map(frame => [frame.state, frame.slot, frame.plate, frame.steady, frame.floating, Math.round(frame.rect.x * 500), Math.round(frame.rect.y * 500), Math.round(frame.rect.w * 500), Math.round(frame.rect.h * 500)]))
                if(key !== lastFrames){
                    lastFrames = key
                    setAutoFrames(wanted)
                }
            },
        })

        autoRef.current = auto
        auto.setPaused(forcedScreenRef.current)
        auto.start()
        return () => {
            autoRef.current = null
            auto.stop()
        }
    }, [autoOn, sourceLang])

    // The engine with elements of the interface: it takes the place of the adaptive windows and of the menu mode
    React.useEffect(() => {
        setElementResults([])
        if(!elementsOn){
            return
        }
        setAutoFrames([])

        let lastFrames = ''
        const engine = new ElementsEngine({
            getVideo: () => (xPlayer?._videoComponent?._videoRender ?? document.querySelector('#streamComponent video')) as HTMLVideoElement | null,
            getBox: () => {
                const rect = document.getElementById('streamComponent')?.getBoundingClientRect()
                return { width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight }
            },
            getSettings: () => ({
                fit: (settingsRef.current.video_size || 'default') as FitMode,
                source: settingsRef.current.translator_source_lang || 'en',
                target: settingsRef.current.translator_target_lang || 'uk',
                color: (settingsRef.current.translator_text_color || 'light') as TextColor,
                panels: settingsRef.current.translator_panels !== false,
            }),
            getManualRegions: () => getRegions(settingsRef.current),
            translate: translateWithLocal,
            onResults: (results) => {
                setElementResults(results)
                results.forEach((item) => {
                    if(item.role === 'subtitle'){
                        addToLog('e' + item.id, item.result)
                    }
                })
            },
            onFrames: (frames) => {
                const wanted = settingsRef.current.translator_auto_debug === true ? frames : []
                const key = JSON.stringify(wanted.map(frame => [frame.state, frame.slot, frame.plate, Math.round(frame.rect.x * 500), Math.round(frame.rect.y * 500), Math.round(frame.rect.w * 500), Math.round(frame.rect.h * 500)]))
                if(key !== lastFrames){
                    lastFrames = key
                    setAutoFrames(wanted)
                }
            },
        })

        engine.start()
        return () => {
            engine.stop()
        }
    }, [elementsOn, sourceLang])

    // While the player has the whole screen read as one, the adaptive windows rest (in a menu they rest by themselves, when
    // the menu is confirmed)
    React.useEffect(() => {
        autoRef.current?.setPaused(forcedScreen)
    }, [forcedScreen])

    // The words of the interface in what the whole-screen reading found keep the menu mode on, and so does any text it has
    // (a menu that has no text is a false alarm: see AutoWindows). It is told every moment, not only when the text changes.
    const screenResultRef = React.useRef(screenResult)
    screenResultRef.current = screenResult
    React.useEffect(() => {
        if(!screenOn){
            return
        }

        const tell = () => {
            const current = screenResultRef.current
            if(current !== null){
                autoRef.current?.noteTexts(current.segments.map(segment => segment.original))
            }
        }
        tell()
        const timer = setInterval(tell, 2000)
        return () => clearInterval(timer)
    }, [screenOn, screenResult])

    // The whole screen as one window (a menu): lines are translated one by one, a steady picture is read calmly
    React.useEffect(() => {
        setScreenResult(null)

        if(!screenOn){
            return
        }

        const engine = new TranslatorEngine({
            getVideo: () => (xPlayer?._videoComponent?._videoRender ?? document.querySelector('#streamComponent video')) as HTMLVideoElement | null,
            getBox: () => {
                const rect = document.getElementById('streamComponent')?.getBoundingClientRect()
                return { width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight }
            },
            getConfig: () => ({
                region: { x: 0, y: 0, w: 1, h: 1 },
                enabled: true,
                mode: 'task',
                fullScreen: true,
                tiles: autoRef.current?.getTiles() ?? [],
                color: 'auto' as TextColor,
                source: settingsRef.current.translator_source_lang || 'en',
                target: settingsRef.current.translator_target_lang || 'uk',
                fit: (settingsRef.current.video_size || 'default') as FitMode,
            }),
            translate: translateWithLocal,
            onResult: setScreenResult,
            onStatus: () => { /* the windows show the status */ },
        })

        engine.start()
        return () => {
            engine.stop()
        }
    }, [screenOn, sourceLang])

    // Free the memory of the text reader when the stream is closed
    React.useEffect(() => {
        return () => {
            void terminateOcr()
        }
    }, [])

    // Show the windows for a moment after the translator is turned on, and say whether it is on or off
    const firstRun = React.useRef(true)
    React.useEffect(() => {
        const wasFirst = firstRun.current
        firstRun.current = false

        if(!wasFirst){
            showToast(enabled ? t('translator.btnOn') : t('translator.btnOff'))
        }

        let timer: ReturnType<typeof setTimeout> | undefined
        if(enabled){
            setFlash(true)
            timer = setTimeout(() => setFlash(false), 3500)
        }

        return () => {
            if(timer !== undefined){ clearTimeout(timer) }
        }
    }, [enabled])

    React.useEffect(() => {
        return () => {
            if(toastTimer.current !== undefined){ clearTimeout(toastTimer.current) }
        }
    }, [])

    const save = (list: Region[]) => {
        setSettings({ ...settingsRef.current, ...regionsToSettings(list) })
    }

    // The saved windows with the one that is being edited replaced by its draft
    const withDraft = () => {
        const list = getRegions(settingsRef.current)
        list[Math.min(activeRef.current, list.length - 1)] = draftRef.current
        return list
    }

    const select = (list: Region[], index: number) => {
        activeRef.current = index
        draftRef.current = list[index]
        setActive(index)
        setDraft(list[index])
    }

    // Edit mode: started from the game bar
    React.useEffect(() => {
        const start = () => {
            select(getRegions(settingsRef.current), 0)
            setEditing(true)
            xPlayer?._inputDriver?.setSuspended?.(true)
        }

        window.addEventListener(TRANSLATOR_EDIT_EVENT, start)
        return () => {
            window.removeEventListener(TRANSLATOR_EDIT_EVENT, start)
        }
    }, [])

    const finishEditing = React.useCallback(() => {
        save(withDraft())
        setEditing(false)
        xPlayer?._inputDriver?.setSuspended?.(false)
    }, [])

    const nextWindow = React.useCallback(() => {
        const list = withDraft()
        if(list.length > 1){
            save(list)
            select(list, (Math.min(activeRef.current, list.length - 1) + 1) % list.length)
        }
    }, [])

    const addWindow = React.useCallback(() => {
        const list = withDraft()
        if(list.length >= MAX_REGIONS){
            return
        }

        const free = findFreeRegion(list)
        if(free === null){
            showToast(t('translator.noRoom'))
            return
        }

        list.push(free)
        save(list)
        select(list, list.length - 1)
    }, [])

    const removeWindow = React.useCallback(() => {
        const list = getRegions(settingsRef.current)
        if(list.length <= 1){
            return
        }

        list.splice(Math.min(activeRef.current, list.length - 1), 1)
        save(list)
        select(list, Math.min(activeRef.current, list.length - 1))
    }, [])

    // A window must not run into the others
    const constrain = React.useCallback((next: Region, previous: Region) => {
        const list = getRegions(settingsRef.current)
        const index = Math.min(activeRef.current, list.length - 1)
        return constrainRegion(next, previous, list.filter((_, i) => i !== index))
    }, [])

    // Edit mode with the gamepad: sticks move / resize, X next window, Y new window, View removes the window, A / B / Menu finishes
    usePadRegion(editing, () => draftRef.current, setDraft, finishEditing, {
        constrain,
        onButton: (button) => {
            if(button === 'X'){ nextWindow() }
            if(button === 'Y'){ addWindow() }
            if(button === 'View'){ removeWindow() }
        },
    })

    // Make sure the game gets its input back when the stream is closed while editing
    React.useEffect(() => {
        return () => {
            xPlayer?._inputDriver?.setSuspended?.(false)
        }
    }, [])

    if(!enabled && !editing && toast === ''){
        return null
    }

    const opacity = typeof settings.translator_opacity === 'number' ? settings.translator_opacity : 0.85
    const status: EngineStatus = statuses.indexOf('error') >= 0 ? 'error' : (statuses.indexOf('loading') >= 0 ? 'loading' : 'ready')
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const autoFont = settings.translator_font_auto !== false
    const fixedSize = settings.translator_font_size || 26

    // Everything that is shown (the windows of the player and the ones the adaptive mode found). Two translations never
    // lie on top of each other (the newer one stays), and each knows its neighbours, so it does not grow over them.
    const items: Array<{ key: string; segment: TranslatedSegment; rect: Region; shownAt?: number; bounds?: Region }> = []
    if(enabled && !editing){
        results.slice(0, count).forEach((result, windowIndex) => {
            (result?.segments ?? []).forEach((segment, index) => items.push({ key: windowIndex + '-' + index, segment, rect: segment.rect, shownAt: segment.shownAt }))
        })
        if(screenOn && screenResult !== null && (forcedScreen || menuConfirmed)){
            // The windows of the player work during the whole-screen reading too: their places are left to them
            const own = regions.filter((region, index) => region.enabled !== false && !(menuActive && windowMode(region, index) === 'dialog'))
            screenResult.segments.forEach((segment, index) => {
                if(!own.some(region => coveredBy(segment.rect, region) > 0.3)){
                    items.push({ key: 'screen-' + index, segment, rect: segment.rect, shownAt: segment.shownAt })
                }
            })
        }
        if(elementsOn){
            elementResults.forEach((item) => {
                item.result.segments.forEach((segment, index) => items.push({ key: 'el-' + item.id + '-' + index, segment, rect: segment.rect, shownAt: segment.shownAt, bounds: item.result.bounds }))
            })
        }
        if(autoOn){
            autoResults.slice(0, MAX_AUTO_WINDOWS).forEach((result, slot) => {
                (result?.segments ?? []).forEach((segment, index) => items.push({ key: 'auto-' + slot + '-' + index, segment, rect: segment.rect, shownAt: segment.shownAt, bounds: result?.bounds }))
            })
        }
    }
    const visible = dropCovered(items)
    const all = visible.map(item => item.segment)

    return (
        <div id="translator_layer" className={editing ? 'editing' : ''} data-gp-ignore>
            { settings.translator_cover !== false ? visible.map(item => (
                <div key={'cover-' + item.key} style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    left: (item.segment.rect.x * viewport.width - Math.max(6, item.segment.rect.h * viewport.height * 0.35)) + 'px',
                    top: (item.segment.rect.y * viewport.height - 5) + 'px',
                    width: (item.segment.rect.w * viewport.width + 2 * Math.max(6, item.segment.rect.h * viewport.height * 0.35) + 8) + 'px',
                    height: (item.segment.rect.h * viewport.height + 10) + 'px',
                    background: 'rgb(' + item.segment.background[0] + ', ' + item.segment.background[1] + ', ' + item.segment.background[2] + ')',
                    borderRadius: '4px',
                }} />
            )) : '' }

            { visible.map((item, index) => (
                <div key={item.key} className="translator-segment" style={segmentStyle(item.segment, viewport, autoFont, fixedSize, opacity, nextBelow(all, index), sideLimits(all, index), item.bounds)}>{item.segment.translated}</div>
            )) }

            { (enabled && !editing && settings.translator_log === true) ? <div className="translator-log">
                { log.length === 0
                    ? <p className="translator-log-empty">{t('translator.logEmpty')}</p>
                    : log.slice(-LOG_SHOWN).map((line, index, lines) => (
                        <p key={line.id} style={{ opacity: 0.5 + 0.5 * (index + 1) / lines.length }}>{line.translated}</p>
                    )) }
            </div> : '' }

            { ((autoOn || elementsOn) && !editing && settings.translator_auto_debug === true) ? autoFrames.map((frame, index) => (
                <div key={'frame-' + index} className={'translator-auto-frame translator-auto-' + frame.state} style={{
                    left: (frame.rect.x * 100) + '%',
                    top: (frame.rect.y * 100) + '%',
                    width: (frame.rect.w * 100) + '%',
                    height: (frame.rect.h * 100) + '%',
                }}>
                    <span>{t('translator.autoState_' + frame.state)} · {t('translator.autoRole_' + frame.role)}{frame.plate ? ' · ' + t('translator.autoPlate') : ''}{frame.floating ? ' · ' + t('translator.autoFloating') : (frame.steady ? ' · ' + t('translator.autoSteady') : '')}</span>
                </div>
            )) : '' }

            { ((autoOn || elementsOn) && !editing && settings.translator_auto_debug === true) ? <div style={{ position: 'absolute', left: '1%', top: '1%', padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.8em', pointerEvents: 'none' }}>
                { elementsOn ? t('translator.debugElements', { count: elementResults.length }) : menuConfirmed ? t('translator.debugMenu', { count: screenResult === null ? 0 : screenResult.segments.length }) : (menuAuto ? t('translator.debugMenuCheck') : t('translator.debugNormal')) }
            </div> : '' }

            { (enabled && !editing && (flash || status !== 'ready')) ? regions.map((frame, index) => frame.enabled === false ? null : (
                <div key={index} className="translator-hint-frame" style={{
                    left: (frame.x * 100) + '%',
                    top: (frame.y * 100) + '%',
                    width: (frame.w * 100) + '%',
                    height: (frame.h * 100) + '%',
                }}>
                    { count > 1 ? <span className="translator-window-number">{index + 1}</span> : '' }
                    { (index === 0 && status === 'loading') ? <span className="translator-status">{t('translator.statusLoading')}</span> : '' }
                    { (index === 0 && status === 'error') ? <span className="translator-status translator-status-error">{t('translator.statusError')}</span> : '' }
                </div>
            )) : '' }

            { toast !== '' ? <div className="translator-toast"><i className="fa-solid fa-language"></i> {toast}</div> : '' }

            { editing ? <React.Fragment>
                <div className="translator-edit-hint">
                    <p>{t('translator.editHint')}</p>
                    <p className="translator-edit-hint-pad">{t('translator.editHintPad')}</p>
                    { count > 1 || count < MAX_REGIONS ? <p className="translator-edit-hint-pad">{t('translator.editHintMulti')}</p> : '' }
                    <p><strong>{t('translator.windowOf', { current: current + 1, total: count })}</strong></p>
                    <div className="translator-edit-buttons">
                        { count > 1 ? <button className="btn" onClick={nextWindow}>{t('translator.nextWindow')}</button> : '' }
                        { count < MAX_REGIONS ? <button className="btn" onClick={addWindow}>{t('translator.addWindow')}</button> : '' }
                        { count > 1 ? <button className="btn" onClick={removeWindow}>{t('translator.removeWindow')}</button> : '' }
                        <button className="btn btn-primary" onClick={finishEditing}>{t('translator.editDone')}</button>
                    </div>
                </div>

                { regions.map((frame, index) => index === current ? null : (
                    <div key={index} className="translator-hint-frame translator-other-window" style={{
                        left: (frame.x * 100) + '%',
                        top: (frame.y * 100) + '%',
                        width: (frame.w * 100) + '%',
                        height: (frame.h * 100) + '%',
                    }}>
                        <span className="translator-window-number">{index + 1}</span>
                    </div>
                )) }

                <RegionEditor region={draft} onChange={setDraft} constrain={constrain} className="region-frame-live">
                    { count > 1 ? <span className="translator-window-number">{current + 1}</span> : null }
                </RegionEditor>
            </React.Fragment> : '' }
        </div>
    )
}

export default TranslatorOverlay
