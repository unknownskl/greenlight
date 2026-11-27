// The translation window is stored as fractions (0..1) of the stream area, so it keeps its place at any resolution.

// What a translation window is for: lines that come and go (subtitles, any text) or a steady interface (tasks)
export type WindowMode = 'dialog' | 'task'

export interface Region {
    x: number;
    y: number;
    w: number;
    h: number;
    // Windows are on unless this is false
    enabled?: boolean;
    mode?: WindowMode;
}

/** The kind of a window: the first one is for subtitles, the second one for tasks, unless it was chosen. */
export function windowMode(region: Region | undefined, index: number): WindowMode {
    if(region !== undefined && (region.mode === 'dialog' || region.mode === 'task')){
        return region.mode
    }
    return index === 1 ? 'task' : 'dialog'
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

    const result: Region = { x, y, w, h }
    if(typeof source.enabled === 'boolean'){
        result.enabled = source.enabled
    }
    if(source.mode === 'dialog' || source.mode === 'task'){
        result.mode = source.mode
    }

    return result
}

// Up to this many translation windows can be used at the same time
export const MAX_REGIONS = 3

const EPSILON = 1e-6

/** Do two windows cover a common part of the picture? (Touching edges do not count.) */
export function regionsOverlap(a: Region, b: Region): boolean {
    return a.x < b.x + b.w - EPSILON && b.x < a.x + a.w - EPSILON && a.y < b.y + b.h - EPSILON && b.y < a.y + a.h - EPSILON
}

/** The translation windows from the settings (the first one is also kept in `translator_region` for older versions). */
export function getRegions(settings: { translator_regions?: any; translator_region?: any }): Region[] {
    const list = Array.isArray(settings.translator_regions) ? settings.translator_regions : []
    if(list.length === 0){
        return [clampRegion(settings.translator_region)]
    }

    return list.slice(0, MAX_REGIONS).map((region: Partial<Region>) => clampRegion(region))
}

/** What to store in the settings for a list of windows. */
export function regionsToSettings(regions: Region[]): { translator_regions: Region[]; translator_region: Region } {
    return { translator_regions: regions, translator_region: regions[0] }
}

/**
 * Keeps a window from covering the other windows. A window that is moved slides along the edge of the one it
 * runs into (it stays on the side it came from); a window that is resized simply stops growing.
 */
function constrainStep(next: Region, previous: Region, others: Region[]): Region {
    const wanted = clampRegion(next)
    const hit = others.filter(other => regionsOverlap(wanted, other))
    if(hit.length === 0){
        return wanted
    }

    const before = clampRegion(previous)
    if(Math.abs(wanted.w - before.w) > EPSILON || Math.abs(wanted.h - before.h) > EPSILON){
        return before
    }

    const candidates: Region[] = []
    for(const other of hit){
        const sides = {
            left: before.x + before.w <= other.x + EPSILON,
            right: before.x >= other.x + other.w - EPSILON,
            above: before.y + before.h <= other.y + EPSILON,
            below: before.y >= other.y + other.h - EPSILON,
        }
        const any = sides.left || sides.right || sides.above || sides.below

        if(!any || sides.left){ candidates.push({ ...wanted, x: other.x - wanted.w }) }
        if(!any || sides.right){ candidates.push({ ...wanted, x: other.x + other.w }) }
        if(!any || sides.above){ candidates.push({ ...wanted, y: other.y - wanted.h }) }
        if(!any || sides.below){ candidates.push({ ...wanted, y: other.y + other.h }) }
    }

    let best: Region | null = null
    let bestDistance = Infinity
    for(const candidate of candidates){
        const inside = candidate.x >= -EPSILON && candidate.y >= -EPSILON
            && candidate.x + candidate.w <= 1 + EPSILON && candidate.y + candidate.h <= 1 + EPSILON
        if(!inside || others.some(other => regionsOverlap(candidate, other))){
            continue
        }

        const distance = Math.abs(candidate.x - wanted.x) + Math.abs(candidate.y - wanted.y)
        if(distance < bestDistance){
            best = candidate
            bestDistance = distance
        }
    }

    return best === null ? before : clampRegion(best)
}

export function constrainRegion(next: Region, previous: Region, others: Region[]): Region {
    const wanted = clampRegion(next)
    const before = clampRegion(previous)
    const sameSize = Math.abs(wanted.w - before.w) <= EPSILON && Math.abs(wanted.h - before.h) <= EPSILON
    const distance = Math.abs(wanted.x - before.x) + Math.abs(wanted.y - before.y)

    if(others.length === 0 || !sameSize || distance <= 0.02){
        return constrainStep(wanted, before, others)
    }

    // A big jump (a fast drag) is made in small steps, so the window cannot jump over another window
    const steps = Math.ceil(distance / 0.02)
    const dx = (wanted.x - before.x) / steps
    const dy = (wanted.y - before.y) / steps
    let result = before
    for(let step = 1; step <= steps; step++){
        result = constrainStep({ ...wanted, x: result.x + dx, y: result.y + dy }, result, others)
    }

    return result
}

/** A place for one more window that is free, or null when there is no room. */
export function findFreeRegion(regions: Region[]): Region | null {
    const sizes = [{ w: 0.3, h: 0.14 }, { w: 0.2, h: 0.1 }]

    for(const size of sizes){
        for(let y = 0.04; y + size.h <= 1; y += 0.04){
            for(let x = 0.04; x + size.w <= 1; x += 0.04){
                const candidate = { x, y, w: size.w, h: size.h }
                if(!regions.some(region => regionsOverlap(candidate, region))){
                    return candidate
                }
            }
        }
    }

    return null
}

export interface SourceRect {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
}

interface FitInfo {
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
}

// How the video frame is placed inside the area it is shown in (letterbox / stretch / zoom)
function getFit(videoWidth: number, videoHeight: number, boxWidth: number, boxHeight: number, fit: FitMode): FitInfo {
    let scaleX = boxWidth / videoWidth
    let scaleY = boxHeight / videoHeight

    if(fit === 'default'){
        scaleX = scaleY = Math.min(scaleX, scaleY)
    } else if(fit === 'zoom'){
        scaleX = scaleY = Math.max(scaleX, scaleY)
    }

    return {
        scaleX,
        scaleY,
        offsetX: (boxWidth - videoWidth * scaleX) / 2,
        offsetY: (boxHeight - videoHeight * scaleY) / 2,
    }
}

/**
 * Converts the region (fractions of the stream area on screen) to pixels of the video frame,
 * taking the way the video is fitted into the area (letterbox / stretch / zoom) into account.
 */
export function regionToSource(videoWidth: number, videoHeight: number, boxWidth: number, boxHeight: number, fit: FitMode, region: Region): SourceRect | null {
    if(videoWidth <= 0 || videoHeight <= 0 || boxWidth <= 0 || boxHeight <= 0){
        return null
    }

    const { scaleX, scaleY, offsetX, offsetY } = getFit(videoWidth, videoHeight, boxWidth, boxHeight, fit)

    const left = Math.max(0, (region.x * boxWidth - offsetX) / scaleX)
    const top = Math.max(0, (region.y * boxHeight - offsetY) / scaleY)
    const right = Math.min(videoWidth, ((region.x + region.w) * boxWidth - offsetX) / scaleX)
    const bottom = Math.min(videoHeight, ((region.y + region.h) * boxHeight - offsetY) / scaleY)

    if(right - left < 8 || bottom - top < 8){
        return null
    }

    return { sx: left, sy: top, sw: right - left, sh: bottom - top }
}

/** The other way round: a rectangle in video pixels becomes a rectangle in fractions of the stream area. */
export function videoRectToScreen(videoWidth: number, videoHeight: number, boxWidth: number, boxHeight: number, fit: FitMode, rect: { x: number; y: number; w: number; h: number }): Region {
    const { scaleX, scaleY, offsetX, offsetY } = getFit(videoWidth, videoHeight, boxWidth, boxHeight, fit)

    return {
        x: (rect.x * scaleX + offsetX) / boxWidth,
        y: (rect.y * scaleY + offsetY) / boxHeight,
        w: (rect.w * scaleX) / boxWidth,
        h: (rect.h * scaleY) / boxHeight,
    }
}
