import React from 'react'
import { useTranslation } from 'react-i18next'

import { useSettings } from '../../context/userContext'
import Ipc from '../../lib/ipc'
import { Region, clampRegion, FitMode } from '../../lib/translator/geometry'
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
 * Shown on top of the stream: reads the text in the translation window and shows its translation.
 * The window can be moved with the mouse / touch, or with the gamepad sticks while "edit" mode is on.
 */
function TranslatorOverlay({
    xPlayer,
}: TranslatorOverlayProps) {
    const { settings, setSettings } = useSettings()
    const { t } = useTranslation()

    const settingsRef = React.useRef(settings)
    settingsRef.current = settings

    const [result, setResult] = React.useState<TranslatorResult | null>(null)
    const [status, setStatus] = React.useState<EngineStatus>('ready')
    const [flash, setFlash] = React.useState(false)
    const [editing, setEditing] = React.useState(false)
    const [toast, setToast] = React.useState('')
    const [draft, setDraft] = React.useState<Region>(clampRegion(settings.translator_region))
    const draftRef = React.useRef(draft)
    draftRef.current = draft

    const enabled = settings.translator_enabled === true
    // The reader is restarted when the language of the game text is changed
    const sourceLang = settings.translator_source_lang || 'en'
    const saved = clampRegion(settings.translator_region)
    const region = editing ? draft : saved

    // The text reader runs while the translator is on
    React.useEffect(() => {
        if(!enabled){
            setResult(null)
            setStatus('ready')
            return
        }

        const engine = new TranslatorEngine({
            getVideo: () => (xPlayer?._videoComponent?._videoRender ?? document.querySelector('#streamComponent video')) as HTMLVideoElement | null,
            getBox: () => {
                const rect = document.getElementById('streamComponent')?.getBoundingClientRect()
                return { width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight }
            },
            getConfig: () => ({
                region: settingsRef.current.translator_region,
                color: (settingsRef.current.translator_text_color || 'light') as TextColor,
                source: settingsRef.current.translator_source_lang || 'en',
                target: settingsRef.current.translator_target_lang || 'uk',
                fit: (settingsRef.current.video_size || 'default') as FitMode,
            }),
            translate: (text, target, source) => Ipc.send('app', 'translateText', { text, from: source, to: target }) as Promise<string>,
            onResult: setResult,
            onStatus: setStatus,
        })

        engine.start()

        return () => {
            engine.stop()
        }
    }, [enabled, sourceLang])

    // Free the memory of the text reader when the stream is closed
    React.useEffect(() => {
        return () => {
            void terminateOcr()
        }
    }, [])

    // Show the window for a moment after the translator is turned on, and say whether it is on or off
    const firstRun = React.useRef(true)
    React.useEffect(() => {
        const wasFirst = firstRun.current
        firstRun.current = false

        let hideToast: ReturnType<typeof setTimeout> | undefined
        if(!wasFirst){
            setToast(enabled ? t('translator.btnOn') : t('translator.btnOff'))
            hideToast = setTimeout(() => setToast(''), 1800)
        }

        let timer: ReturnType<typeof setTimeout> | undefined
        if(enabled){
            setFlash(true)
            timer = setTimeout(() => setFlash(false), 3500)
        }

        return () => {
            if(timer !== undefined){ clearTimeout(timer) }
            if(hideToast !== undefined){ clearTimeout(hideToast) }
        }
    }, [enabled])

    // Edit mode: started from the game bar
    React.useEffect(() => {
        const start = () => {
            setDraft(clampRegion(settingsRef.current.translator_region))
            setEditing(true)
            xPlayer?._inputDriver?.setSuspended?.(true)
        }

        window.addEventListener(TRANSLATOR_EDIT_EVENT, start)
        return () => {
            window.removeEventListener(TRANSLATOR_EDIT_EVENT, start)
        }
    }, [])

    const finishEditing = React.useCallback(() => {
        setSettings({ ...settingsRef.current, translator_region: draftRef.current })
        setEditing(false)
        xPlayer?._inputDriver?.setSuspended?.(false)
    }, [])

    // Edit mode with the gamepad: sticks move / resize, A / B / Menu finishes
    usePadRegion(editing, () => draftRef.current, setDraft, finishEditing)

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

    return (
        <div id="translator_layer" className={editing ? 'editing' : ''} data-gp-ignore>
            { (enabled && !editing && result !== null) ? result.segments.map((segment, index) => (
                <div key={index} className="translator-segment" style={segmentStyle(segment, { width: window.innerWidth, height: window.innerHeight }, settings.translator_font_auto !== false, settings.translator_font_size || 26, opacity)}>{segment.translated}</div>
            )) : '' }

            { (enabled && !editing && (flash || status !== 'ready')) ? <div className="translator-hint-frame" style={{
                left: (region.x * 100) + '%',
                top: (region.y * 100) + '%',
                width: (region.w * 100) + '%',
                height: (region.h * 100) + '%',
            }}>
                { status === 'loading' ? <span className="translator-status">{t('translator.statusLoading')}</span> : '' }
                { status === 'error' ? <span className="translator-status translator-status-error">{t('translator.statusError')}</span> : '' }
            </div> : '' }

            { toast !== '' ? <div className="translator-toast"><i className="fa-solid fa-language"></i> {toast}</div> : '' }

            { editing ? <React.Fragment>
                <div className="translator-edit-hint">
                    <p>{t('translator.editHint')}</p>
                    <p className="translator-edit-hint-pad">{t('translator.editHintPad')}</p>
                    <button className="btn btn-primary" onClick={finishEditing}>{t('translator.editDone')}</button>
                </div>
                <RegionEditor region={draft} onChange={setDraft} className="region-frame-live" />
            </React.Fragment> : '' }
        </div>
    )
}

export default TranslatorOverlay
