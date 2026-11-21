// The translation window is stored as fractions (0..1) of the stream area, so it keeps its place at any resolution.

export interface Region {
    x: number;
    y: number;
    w: number;
    h: number;
}

export type FitMode = 'default' | 'stretch' | 'zoom'

export const MIN_REGION_SIZE = 0.05
export const DEFAULT_REGION: Region = { x: 0.2, y: 0.78, w: 0.6, h: 0.16 }

function num(value: any, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Always returns a usable region that lies inside the stream area. */
export function clampRegion(region: Partial<Region> | undefined | null): Region {
    const source = region || {}
    const w = Math.min(1, Math.max(MIN_REGION_SIZE, num(source.w, DEFAULT_REGION.w)))
    const h = Math.min(1, Math.max(MIN_REGION_SIZE, num(source.h, DEFAULT_REGION.h)))
    const x = Math.min(1 - w, Math.max(0, num(source.x, DEFAULT_REGION.x)))
    const y = Math.min(1 - h, Math.max(0, num(source.y, DEFAULT_REGION.y)))

    return { x, y, w, h }
}

export interface SourceRect {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
}

/**
 * Converts the region (fractions of the stream area on screen) to pixels of the video frame,
 * taking the way the video is fitted into the area (letterbox / stretch / zoom) into account.
 */
export function regionToSource(videoWidth: number, videoHeight: number, boxWidth: number, boxHeight: number, fit: FitMode, region: Region): SourceRect | null {
    if(videoWidth <= 0 || videoHeight <= 0 || boxWidth <= 0 || boxHeight <= 0){
        return null
    }

    let scaleX = boxWidth / videoWidth
    let scaleY = boxHeight / videoHeight

    if(fit === 'default'){
        scaleX = scaleY = Math.min(scaleX, scaleY)
    } else if(fit === 'zoom'){
        scaleX = scaleY = Math.max(scaleX, scaleY)
    }

    const offsetX = (boxWidth - videoWidth * scaleX) / 2
    const offsetY = (boxHeight - videoHeight * scaleY) / 2

    const left = Math.max(0, (region.x * boxWidth - offsetX) / scaleX)
    const top = Math.max(0, (region.y * boxHeight - offsetY) / scaleY)
    const right = Math.min(videoWidth, ((region.x + region.w) * boxWidth - offsetX) / scaleX)
    const bottom = Math.min(videoHeight, ((region.y + region.h) * boxHeight - offsetY) / scaleY)

    if(right - left < 8 || bottom - top < 8){
        return null
    }

    return { sx: left, sy: top, sw: right - left, sh: bottom - top }
}
