import React from 'react'
import { Region, clampRegion, MIN_REGION_SIZE } from '../../lib/translator/geometry'

interface RegionEditorProps {
    region: Region;
    onChange: (region: Region) => void;
    children?: React.ReactNode;
    className?: string;
}

interface DragState {
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    start: Region;
    width: number;
    height: number;
}

/**
 * A frame that can be dragged around (and resized with the corner handle) inside its positioned parent.
 * The region is stored as fractions of the parent, so it works for the real stream and for the small preview.
 */
function RegionEditor({
    region,
    onChange,
    children,
    className,
}: RegionEditorProps) {
    const frameRef = React.useRef<HTMLDivElement>(null)
    const dragRef = React.useRef<DragState | null>(null)

    function begin(mode: DragState['mode'], event: React.PointerEvent) {
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

        if(drag.mode === 'move'){
            onChange(clampRegion({ ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy }))
        } else {
            onChange(clampRegion({
                ...drag.start,
                w: Math.min(1 - drag.start.x, Math.max(MIN_REGION_SIZE, drag.start.w + dx)),
                h: Math.min(1 - drag.start.y, Math.max(MIN_REGION_SIZE, drag.start.h + dy)),
            }))
        }
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
            <div className="region-handle" onPointerDown={(event) => begin('resize', event)}></div>
        </div>
    )
}

export default RegionEditor
