import React from 'react'
import { useTranslation } from 'react-i18next'

import { useSettings } from '../../context/userContext'
import Ipc from '../../lib/ipc'
import { getUsablePads, mergeFrames, readPad } from '../../lib/gamepad/pads'
import { Region, clampRegion, FitMode } from '../../lib/translator/geometry'
import TranslatorEngine, { EngineStatus, TranslatorResult, TextColor } from '../../lib/translator/engine'
import { terminateOcr } from '../../lib/translator/ocr'
import RegionEditor from './regioneditor'

export const TRANSLATOR_EDIT_EVENT = 'greenlight-translator-edit'

interface TranslatorOverlayProps {
    xPlayer: any;
}

const STICK_SPEED = 0.012

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
    const [draft, setDraft] = React.useState<Region>(clampRegion(settings.translator_region))
    const draftRef = React.useRef(draft)
    draftRef.current = draft

    const enabled = settings.translator_enabled === true
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
                target: settingsRef.current.translator_target_lang || 'uk',
                fit: (settingsRef.current.video_size || 'default') as FitMode,
            }),
            translate: (text, target) => Ipc.send('app', 'translateText', { text, from: 'en', to: target }) as Promise<string>,
            onResult: setResult,
            onStatus: setStatus,
        })

        engine.start()

        return () => {
            engine.stop()
        }
    }, [enabled])

    // Free the memory of the text reader when the stream is closed
    React.useEffect(() => {
        return () => {
            void terminateOcr()
        }
    }, [])

    // Show the window for a moment after the translator is turned on
    React.useEffect(() => {
        if(!enabled){
            return
        }

        setFlash(true)
        const timer = setTimeout(() => setFlash(false), 3500)

        return () => clearTimeout(timer)
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

    // Edit mode with the gamepad: left stick / d-pad moves, right stick resizes, A / B / Menu finishes
    React.useEffect(() => {
        if(!editing){
            return
        }

        let frameId = 0
        let previousDone = true

        const loop = () => {
            const frame = mergeFrames(getUsablePads().map(pad => readPad(pad)))
            const current = draftRef.current

            const moveX = frame.LeftThumbXAxis + frame.DPadRight - frame.DPadLeft
            const moveY = frame.LeftThumbYAxis + frame.DPadDown - frame.DPadUp
            const sizeX = frame.RightThumbXAxis
            const sizeY = frame.RightThumbYAxis

            if(moveX !== 0 || moveY !== 0 || sizeX !== 0 || sizeY !== 0){
                const width = Math.min(1, Math.max(0.05, current.w + sizeX * STICK_SPEED))
                const height = Math.min(1, Math.max(0.05, current.h + sizeY * STICK_SPEED))

                setDraft(clampRegion({
                    x: current.x + moveX * STICK_SPEED,
                    y: current.y + moveY * STICK_SPEED,
                    w: width,
                    h: height,
                }))
            }

            const done = frame.A > 0.5 || frame.B > 0.5 || frame.Menu > 0.5
            if(done && !previousDone){
                finishEditing()
                return
            }
            previousDone = done

            frameId = requestAnimationFrame(loop)
        }

        frameId = requestAnimationFrame(loop)

        return () => {
            cancelAnimationFrame(frameId)
        }
    }, [editing])

    // Make sure the game gets its input back when the stream is closed while editing
    React.useEffect(() => {
        return () => {
            xPlayer?._inputDriver?.setSuspended?.(false)
        }
    }, [])

    if(!enabled && !editing){
        return null
    }

    const anchorBottom = region.y + region.h / 2 > 0.5
    const opacity = typeof settings.translator_opacity === 'number' ? settings.translator_opacity : 0.85

    return (
        <div id="translator_layer" className={editing ? 'editing' : ''} data-gp-ignore>
            { (enabled && !editing && result !== null) ? <div className="translator-box" style={{
                left: (region.x * 100) + '%',
                width: (region.w * 100) + '%',
                ...(anchorBottom ? { bottom: ((1 - region.y - region.h) * 100) + '%' } : { top: (region.y * 100) + '%' }),
                fontSize: (settings.translator_font_size || 26) + 'px',
                background: 'rgba(10, 12, 15, ' + opacity + ')',
            }}>{result.translated}</div> : '' }

            { (enabled && !editing && (flash || status !== 'ready')) ? <div className="translator-hint-frame" style={{
                left: (region.x * 100) + '%',
                top: (region.y * 100) + '%',
                width: (region.w * 100) + '%',
                height: (region.h * 100) + '%',
            }}>
                { status === 'loading' ? <span className="translator-status">{t('translator.statusLoading')}</span> : '' }
                { status === 'error' ? <span className="translator-status translator-status-error">{t('translator.statusError')}</span> : '' }
            </div> : '' }

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
