import React from 'react'
import { Region, clampRegion, MIN_REGION_SIZE } from '../../lib/translator/geometry'

interface RegionEditorProps {
    region: Region;
    onChange: (region: Region) => void;
    children?: React.ReactNode;
    className?: string;
}

// Which edges a handle drags. 'move' drags the whole frame.
type DragMode = 'move' | 'tl' | 'tr' | 'bl' | 'br'

interface DragState {
    mode: DragMode;
    startX: number;
    startY: number;
    start: Region;
    width: number;
    height: number;
}

const HANDLES: DragMode[] = ['tl', 'tr', 'bl', 'br']

/**
 * A frame that can be dragged around inside its positioned parent and resized from every corner,
 * so it can get any shape. The region is stored as fractions of the parent, so it works for the real
 * stream and for the small preview.
 */
function RegionEditor({
    region,
    onChange,
    children,
    className,
}: RegionEditorProps) {
    const frameRef = React.useRef<HTMLDivElement>(null)
    const dragRef = React.useRef<DragState | null>(null)

    function begin(mode: DragMode, event: React.PointerEvent) {
        const parent = frameRef.current?.parentElement
        if(!parent){
            return
        }

        event.preventDefault()
        event.stopPropagation()

        const rect = parent.getBoundingClientRect()
        dragRef.current = {
            mode,
            startX: event.clientX,
            startY: event.clientY,
            start: region,
            width: Math.max(1, rect.width),
            height: Math.max(1, rect.height),
        }

        try {
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
        } catch(error) {
            // Not critical
        }
    }

    function move(event: React.PointerEvent) {
        const drag = dragRef.current
        if(drag === null){
            return
        }

        const dx = (event.clientX - drag.startX) / drag.width
        const dy = (event.clientY - drag.startY) / drag.height
        const start = drag.start

        if(drag.mode === 'move'){
            onChange(clampRegion({ ...start, x: start.x + dx, y: start.y + dy }))
            return
        }

        // Move the edges that belong to the dragged corner, keep the opposite ones in place
        let left = start.x
        let top = start.y
        let right = start.x + start.w
        let bottom = start.y + start.h

        if(drag.mode === 'tl' || drag.mode === 'bl'){
            left = Math.min(Math.max(0, left + dx), right - MIN_REGION_SIZE)
        } else {
            right = Math.max(Math.min(1, right + dx), left + MIN_REGION_SIZE)
        }

        if(drag.mode === 'tl' || drag.mode === 'tr'){
            top = Math.min(Math.max(0, top + dy), bottom - MIN_REGION_SIZE)
        } else {
            bottom = Math.max(Math.min(1, bottom + dy), top + MIN_REGION_SIZE)
        }

        onChange(clampRegion({ x: left, y: top, w: right - left, h: bottom - top }))
    }

    function end() {
        dragRef.current = null
    }

    return (
        <div ref={frameRef} className={'region-frame' + (className ? ' ' + className : '')}
            style={{
                left: (region.x * 100) + '%',
                top: (region.y * 100) + '%',
                width: (region.w * 100) + '%',
                height: (region.h * 100) + '%',
            }}
            onPointerDown={(event) => begin('move', event)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}>
            {children}
            { HANDLES.map((handle) => (
                <div key={handle} className={'region-handle region-handle-' + handle} onPointerDown={(event) => begin(handle, event)}></div>
            )) }
        </div>
    )
}

export default RegionEditor
