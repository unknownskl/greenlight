import React from 'react'
import { useTranslation } from 'react-i18next'

import { useSettings } from '../../context/userContext'
import Ipc from '../../lib/ipc'
import { Region, FitMode, DEFAULT_REGION, MAX_REGIONS, getRegions, regionsToSettings, constrainRegion, findFreeRegion, windowMode } from '../../lib/translator/geometry'
import TranslatorEngine, { EngineStatus, TranslatorResult, TranslatedSegment, TextColor } from '../../lib/translator/engine'
import { terminateOcr } from '../../lib/translator/ocr'
import usePadRegion from '../../lib/translator/usepadregion'
import RegionEditor from './regioneditor'

export const TRANSLATOR_EDIT_EVENT = 'greenlight-translator-edit'

interface TranslatorOverlayProps {
    xPlayer: any;
}

let measureContext: CanvasRenderingContext2D | null | undefined

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
export function segmentStyle(segment: TranslatedSegment, viewport: { width: number; height: number }, autoFont: boolean, fixedSize: number, opacity: number): React.CSSProperties {
    const originalWidth = segment.rect.w * viewport.width
    const left = segment.rect.x * viewport.width
    const centerX = left + originalWidth / 2

    // One line of the original stays one line: the translation may grow sideways (as far as the picture goes),
    // so it does not wrap onto the line below, which is another piece of text
    const lines = Math.max(1, Math.round(segment.rect.h / Math.max(0.001, segment.lineHeight)))
    const room = segment.centered
        ? 2 * Math.min(centerX, viewport.width - centerX) - 16
        : viewport.width - left - 8
    const maxWidth = Math.max(140, Math.min(room, originalWidth * (lines === 1 ? 2.1 : 1.35)))

    // The size of the original text; shrunk when the translation is much longer than the original
    let size = autoFont ? Math.min(56, Math.max(12, segment.lineHeight * viewport.height * 1.02)) : fixedSize
    let singleLine = false
    if(autoFont){
        const wanted = textWidth(segment.translated, size)
        if(wanted > maxWidth * lines){
            size = Math.max(size * 0.62, size * maxWidth * lines / wanted)
        }
        singleLine = lines === 1 && textWidth(segment.translated, size) <= maxWidth - 16
    }

    const [r, g, b] = segment.background
    // The box covers the original text completely (with a small margin around it)
    const style: React.CSSProperties = {
        top: 'calc(' + (segment.rect.y * 100) + '% - 4px)',
        whiteSpace: singleLine ? 'nowrap' : 'normal',
        maxWidth: maxWidth + 'px',
        minWidth: (Math.min(originalWidth, maxWidth) + 16) + 'px',
        minHeight: (segment.rect.h * viewport.height + 8) + 'px',
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

    const [results, setResults] = React.useState<(TranslatorResult | null)[]>([])
    const [statuses, setStatuses] = React.useState<EngineStatus[]>([])
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
                    enabled: region.enabled !== false,
                    mode: windowMode(region, index),
                    color: (settingsRef.current.translator_text_color || 'light') as TextColor,
                    source: settingsRef.current.translator_source_lang || 'en',
                    target: settingsRef.current.translator_target_lang || 'uk',
                    fit: (settingsRef.current.video_size || 'default') as FitMode,
                    }
                },
                translate: (text, target, source) => Ipc.send('app', 'translateText', { text, from: source, to: target }) as Promise<string>,
                onResult: (result) => setResults(previous => {
                    const next = previous.slice()
                    next[index] = result
                    return next
                }),
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

    return (
        <div id="translator_layer" className={editing ? 'editing' : ''} data-gp-ignore>
            { (enabled && !editing) ? results.slice(0, count).map((result, windowIndex) => (result === null || result === undefined) ? null : result.segments.map((segment, index) => (
                <div key={windowIndex + '-' + index} className="translator-segment" style={segmentStyle(segment, viewport, autoFont, fixedSize, opacity)}>{segment.translated}</div>
            ))) : '' }

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
