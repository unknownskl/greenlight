import { Polarity, inkMasks } from './engine'

/**
 * The "scout" of the adaptive translator: looks at the whole picture and finds the places that look like text
 * (rows of letters), so the translator does not have to be told where the subtitles are.
 * It only looks at the shape of the text-coloured ink; whether it is really text is decided later by the text reader.
 */

// What a block is, judged by where it is: a subtitle (centred, in the lower part), a message in a corner or at the
// side of the screen (a notification, an achievement), or any other text (a menu, a sign, a label)
export type BlockRole = 'subtitle' | 'notice' | 'other'

export interface TextBlock {
    // Fractions of the picture that was looked at
    x: number;
    y: number;
    w: number;
    h: number;
    polarity: Polarity;
    role: BlockRole;
    // How sure it is that this is text (bigger is better)
    score: number;
    // The text sits on a "plate": a panel of the interface with a flat background that has edges (a message box, a task list)
    plate: boolean;
    // The panel of the interface the text sits on (fractions of the picture), when its edges were found
    panel?: { x: number; y: number; w: number; h: number };
    stats?: { fill: number; ratio: number; onShare: number };
}

// The picture is looked at in cells of CELL x CELL pixels: a cell is "on" when it holds some text-coloured ink
const CELL = 4
const MIN_CELL_INK = 3
// Letters of a word, and words of a line, are joined when they are at most this many cells apart (sideways / up and down)
const GAP_CELLS = 3
const VERTICAL_GAP_CELLS = 1
// More ink than this is a busy picture (a bright sky, a snowstorm), not text
const MAX_INK_SHARE = 0.2

// What a row of letters looks like: not too thin, not too tall, much wider than tall, with gaps between the letters
const MIN_HEIGHT_CELLS = 3
const MIN_WIDTH_CELLS = 10
const MIN_ASPECT = 2.2
const MAX_BLOCK_HEIGHT = 0.3
const MIN_FILL = 0.06
const MAX_FILL = 0.55
// Text stands out from what is around it: there is this many times more ink inside the block than in the ring around it
// (leaves, snow, sparkles are everywhere in the picture, text is not)
const RING_RATIO = 3.5
// ... and short words must stand out even more, and a row of text is mostly made of letters (a share of the cells is ink)
const SMALL_WIDTH_CELLS = 16
const SMALL_RING_RATIO = 6
const MIN_ON_SHARE_ROW = 0.3
const MIN_ON_SHARE_BLOCK = 0.2
// How strongly the ink inside must be more than around for a line to need fewer 'on' cells
const STRONG_RATIO = 15
// A plate: the background around the text is this flat (the spread of the brightness) and differs from what lies beyond it
const PLATE_FLAT = 20
const PLATE_EDGE = 12
// The panel of a plate grows outwards in steps while the strip beyond it is as flat as the plate; it ends at an edge
const PANEL_STEP = 4
const PANEL_MAX_GROW = 0.25
const PANEL_SAME = 16
const PANEL_FLAT = 30
// A block as wide as the picture is a horizon or a bar, not text
const MAX_BLOCK_WIDTH = 0.88
// Rows of text one under another (lines of one subtitle, one message) are one block when they are this close
const LINE_GAP = 1.1
const MAX_BLOCKS = 10
// A block that scores less than this (per pixel of the width of the picture) is noise: 90 on a picture 1280 wide
const MIN_SCORE_PER_PIXEL = 0.07

interface Part {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    ink: number;
    on: number;
    polarity: Polarity;
}

interface RingStats {
    mean: number;
    spread: number;
    count: number;
}

// The brightness of the background (the pixels that are not text) in the frame between two rectangles
function ringStats(data: Uint8ClampedArray, mask: Uint8Array, width: number, height: number, inner: number[], outer: number[]): RingStats {
    let sum = 0
    let sumSquares = 0
    let count = 0

    const y0 = Math.max(0, outer[1])
    const y1 = Math.min(height, outer[3])
    const x0 = Math.max(0, outer[0])
    const x1 = Math.min(width, outer[2])

    for(let y = y0; y < y1; y += 2){
        for(let x = x0; x < x1; x += 2){
            if(x >= inner[0] && x < inner[2] && y >= inner[1] && y < inner[3]){
                continue
            }
            const index = y * width + x
            if(mask[index] === 1){
                continue
            }
            const luma = (data[index * 4] * 299 + data[index * 4 + 1] * 587 + data[index * 4 + 2] * 114) / 1000
            sum += luma
            sumSquares += luma * luma
            count++
        }
    }

    if(count === 0){
        return { mean: 0, spread: 255, count: 0 }
    }
    const mean = sum / count
    return { mean, spread: Math.sqrt(Math.max(0, sumSquares / count - mean * mean)), count }
}

/** Is the text on a plate? The background right around it is flat, and a little further away it is different. */
function hasPlate(data: Uint8ClampedArray, mask: Uint8Array, width: number, height: number, box: { x0: number; y0: number; x1: number; y1: number }): boolean {
    const pad = Math.min(14, Math.max(4, Math.round((box.y1 - box.y0) * 0.35)))
    const text = [box.x0, box.y0, box.x1, box.y1]
    const near = [box.x0 - pad, box.y0 - pad, box.x1 + pad, box.y1 + pad]
    const far = [box.x0 - 2 * pad, box.y0 - 2 * pad, box.x1 + 2 * pad, box.y1 + 2 * pad]

    const inside = ringStats(data, mask, width, height, text, near)
    const outside = ringStats(data, mask, width, height, near, far)
    if(inside.count < 30 || outside.count < 30){
        return false
    }

    return inside.spread <= PLATE_FLAT && (Math.abs(inside.mean - outside.mean) >= PLATE_EDGE || outside.spread >= inside.spread * 1.8 + 6)
}

/**
 * The panel a text sits on: the rectangle around the text whose background is as flat as the plate, up to the edge where
 * the background changes. null when the edges are not clear (the background goes on and on, or the plate is cut off).
 */
function findPanel(data: Uint8ClampedArray, mask: Uint8Array, width: number, height: number, box: { x0: number; y0: number; x1: number; y1: number }): { x0: number; y0: number; x1: number; y1: number } | null {
    const pad = Math.min(14, Math.max(4, Math.round((box.y1 - box.y0) * 0.35)))
    const base = ringStats(data, mask, width, height, [box.x0, box.y0, box.x1, box.y1], [box.x0 - pad, box.y0 - pad, box.x1 + pad, box.y1 + pad])
    if(base.count < 30){
        return null
    }

    const rect = { x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1 }
    const none = [0, 0, 0, 0]
    const growX = Math.round(width * PANEL_MAX_GROW)
    const growY = Math.round(height * PANEL_MAX_GROW)
    const same = (strip: number[]) => {
        const stats = ringStats(data, mask, width, height, none, strip)
        return stats.count >= 8 && Math.abs(stats.mean - base.mean) <= PANEL_SAME && stats.spread <= PANEL_FLAT
    }

    // Per side: still growing / stopped at an edge / stopped at the limit
    const state = { left: 'grow', right: 'grow', top: 'grow', bottom: 'grow' } as Record<string, string>
    for(let round = 0; round < 80 && Object.values(state).includes('grow'); round++){
        if(state.left === 'grow'){
            if(box.x0 - rect.x0 >= growX || rect.x0 - PANEL_STEP < 0){ state.left = rect.x0 - PANEL_STEP < 0 ? 'edge' : 'limit' }
            else if(same([rect.x0 - PANEL_STEP, rect.y0, rect.x0, rect.y1])){ rect.x0 -= PANEL_STEP } else { state.left = 'edge' }
        }
        if(state.right === 'grow'){
            if(rect.x1 - box.x1 >= growX || rect.x1 + PANEL_STEP > width){ state.right = rect.x1 + PANEL_STEP > width ? 'edge' : 'limit' }
            else if(same([rect.x1, rect.y0, rect.x1 + PANEL_STEP, rect.y1])){ rect.x1 += PANEL_STEP } else { state.right = 'edge' }
        }
        if(state.top === 'grow'){
            if(box.y0 - rect.y0 >= growY || rect.y0 - PANEL_STEP < 0){ state.top = rect.y0 - PANEL_STEP < 0 ? 'edge' : 'limit' }
            else if(same([rect.x0, rect.y0 - PANEL_STEP, rect.x1, rect.y0])){ rect.y0 -= PANEL_STEP } else { state.top = 'edge' }
        }
        if(state.bottom === 'grow'){
            if(rect.y1 - box.y1 >= growY || rect.y1 + PANEL_STEP > height){ state.bottom = rect.y1 + PANEL_STEP > height ? 'edge' : 'limit' }
            else if(same([rect.x0, rect.y1, rect.x1, rect.y1 + PANEL_STEP])){ rect.y1 += PANEL_STEP } else { state.bottom = 'edge' }
        }
    }

    // A clear panel: it ended at an edge on every side (not because it was cut short), and it is bigger than the text
    if(Object.values(state).some(value => value !== 'edge')){
        return null
    }
    const textArea = (box.x1 - box.x0) * (box.y1 - box.y0)
    const panelArea = (rect.x1 - rect.x0) * (rect.y1 - rect.y0)
    return panelArea >= textArea * 1.15 ? rect : null
}

function overlapShare(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
    const width = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const height = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    if(width <= 0 || height <= 0){
        return 0
    }
    return (width * height) / Math.max(1e-9, Math.min(a.w * a.h, b.w * b.h))
}

/** Where on the screen a block is tells what it is for. */
export function classify(block: { x: number; y: number; w: number; h: number }): BlockRole {
    const centerX = block.x + block.w / 2
    const centerY = block.y + block.h / 2

    if(Math.abs(centerX - 0.5) <= 0.14 && (centerY >= 0.55 || centerY <= 0.14) && block.h <= 0.22 && block.w >= 0.12){
        return 'subtitle'
    }

    if((centerX < 0.4 || centerX > 0.6) && (centerY < 0.32 || centerY > 0.68)){
        return 'notice'
    }

    return 'other'
}

function partsOfMask(mask: Uint8Array, width: number, height: number, polarity: Polarity): { parts: Part[]; ink: Uint16Array; columns: number; rows: number } {
    const columns = Math.floor(width / CELL)
    const rows = Math.floor(height / CELL)
    if(columns < 8 || rows < 4){
        return { parts: [], ink: new Uint16Array(0), columns, rows }
    }

    const ink = new Uint16Array(columns * rows)
    for(let y = 0; y < rows * CELL; y++){
        const base = Math.floor(y / CELL) * columns
        for(let x = 0; x < columns * CELL; x++){
            if(mask[y * width + x] === 1){
                ink[base + Math.floor(x / CELL)]++
            }
        }
    }

    const on = new Uint8Array(columns * rows)
    for(let i = 0; i < on.length; i++){
        on[i] = ink[i] >= MIN_CELL_INK ? 1 : 0
    }

    // Join the letters of a row: close the gaps sideways, then a little up and down
    const wide = new Uint8Array(on)
    for(let y = 0; y < rows; y++){
        let last = -1
        for(let x = 0; x < columns; x++){
            if(on[y * columns + x] === 0){
                continue
            }
            if(last >= 0 && x - last > 1 && x - last - 1 <= GAP_CELLS){
                for(let fill = last + 1; fill < x; fill++){
                    wide[y * columns + fill] = 1
                }
            }
            last = x
        }
    }

    const joined = new Uint8Array(wide)
    for(let x = 0; x < columns; x++){
        let last = -1
        for(let y = 0; y < rows; y++){
            if(wide[y * columns + x] === 0){
                continue
            }
            if(last >= 0 && y - last > 1 && y - last - 1 <= VERTICAL_GAP_CELLS){
                for(let fill = last + 1; fill < y; fill++){
                    joined[fill * columns + x] = 1
                }
            }
            last = y
        }
    }

    // Connected pieces of joined cells
    const parts: Part[] = []
    const seen = new Uint8Array(columns * rows)
    const stack = new Int32Array(columns * rows)

    for(let start = 0; start < joined.length; start++){
        if(joined[start] === 0 || seen[start] === 1){
            continue
        }

        let top = 0
        stack[top++] = start
        seen[start] = 1

        let x0 = columns, y0 = rows, x1 = 0, y1 = 0, total = 0, onCells = 0
        while(top > 0){
            const cell = stack[--top]
            const cx = cell % columns
            const cy = (cell - cx) / columns
            total += ink[cell]
            onCells += on[cell]
            if(cx < x0){ x0 = cx }
            if(cx > x1){ x1 = cx }
            if(cy < y0){ y0 = cy }
            if(cy > y1){ y1 = cy }

            if(cx > 0 && joined[cell - 1] === 1 && seen[cell - 1] === 0){ seen[cell - 1] = 1; stack[top++] = cell - 1 }
            if(cx < columns - 1 && joined[cell + 1] === 1 && seen[cell + 1] === 0){ seen[cell + 1] = 1; stack[top++] = cell + 1 }
            if(cy > 0 && joined[cell - columns] === 1 && seen[cell - columns] === 0){ seen[cell - columns] = 1; stack[top++] = cell - columns }
            if(cy < rows - 1 && joined[cell + columns] === 1 && seen[cell + columns] === 0){ seen[cell + columns] = 1; stack[top++] = cell + columns }
        }

        parts.push({ x0, y0, x1: x1 + 1, y1: y1 + 1, ink: total, on: onCells, polarity })
    }

    return { parts, ink, columns, rows }
}

// Lines of text that stand one under another and line up are one block
function mergeLines(parts: Part[], rows: number): Part[] {
    const list = parts.slice()
    let merged = true

    while(merged){
        merged = false

        for(let a = 0; a < list.length && !merged; a++){
            for(let b = a + 1; b < list.length && !merged; b++){
                const first = list[a]
                const second = list[b]
                if(first.polarity !== second.polarity){
                    continue
                }

                const upper = first.y0 <= second.y0 ? first : second
                const lower = upper === first ? second : first
                const gap = lower.y0 - upper.y1
                const smaller = Math.min(upper.y1 - upper.y0, lower.y1 - lower.y0)
                const larger = Math.max(upper.y1 - upper.y0, lower.y1 - lower.y0)

                // Similar size, close together, one under the other
                if(gap > smaller * LINE_GAP || larger > smaller * 2.2 || (lower.y1 - upper.y0) * CELL > MAX_BLOCK_HEIGHT * rows * CELL){
                    continue
                }

                const overlap = Math.min(upper.x1, lower.x1) - Math.max(upper.x0, lower.x0)
                const narrower = Math.min(upper.x1 - upper.x0, lower.x1 - lower.x0)
                const lined = Math.abs(upper.x0 - lower.x0) <= 3 || Math.abs((upper.x0 + upper.x1) - (lower.x0 + lower.x1)) <= 6
                if(overlap < narrower * 0.4 || !lined){
                    continue
                }

                list[a] = {
                    x0: Math.min(first.x0, second.x0),
                    y0: Math.min(first.y0, second.y0),
                    x1: Math.max(first.x1, second.x1),
                    y1: Math.max(first.y1, second.y1),
                    ink: first.ink + second.ink,
                    on: first.on + second.on,
                    polarity: first.polarity,
                }
                list.splice(b, 1)
                merged = true
            }
        }
    }

    return list
}

/**
 * Finds the places in a picture that look like text. `data` is the picture (RGBA), `polarities` says which kinds
 * of text to look for (light on dark, dark on light).
 */
export function findTextBlocks(data: Uint8ClampedArray, width: number, height: number, polarities: Polarity[], limit = MAX_BLOCKS): TextBlock[] {
    return analyseScreen(data, width, height, polarities, limit).blocks
}

/** The same, and the text pixels (one mask per polarity) that the blocks were found in: they tell later whether a block has changed. */
export function analyseScreen(data: Uint8ClampedArray, width: number, height: number, polarities: Polarity[], limit = MAX_BLOCKS): { blocks: TextBlock[]; masks: Array<{ mask: Uint8Array; count: number }> } {
    const masks = inkMasks(data, width, height, polarities)
    const rows = Math.floor(height / CELL)
    const blocks: TextBlock[] = []

    masks.forEach((fine, index) => {
        if(fine.count === 0 || fine.count / (width * height) > MAX_INK_SHARE){
            return
        }

        const found = partsOfMask(fine.mask, width, height, polarities[index])
        if(found.parts.length === 0){
            return
        }

        // Rows of letters (not yet the blocks they make up)
        const lines = found.parts.filter((part) => {
            const w = part.x1 - part.x0
            const h = part.y1 - part.y0
            return h >= MIN_HEIGHT_CELLS && w >= MIN_WIDTH_CELLS && w >= h && h * CELL <= MAX_BLOCK_HEIGHT * height
        })

        // Summed ink of the cells: the ink of any rectangle is four lookups
        const { ink, columns } = found
        const stride = columns + 1
        const sums = new Uint32Array(stride * (rows + 1))
        for(let y = 0; y < rows; y++){
            let row = 0
            for(let x = 0; x < columns; x++){
                row += ink[y * columns + x]
                sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + row
            }
        }
        const inkOf = (x0: number, y0: number, x1: number, y1: number) => sums[y1 * stride + x1] - sums[y0 * stride + x1] - sums[y1 * stride + x0] + sums[y0 * stride + x0]

        for(const part of mergeLines(lines, rows)){
            const w = part.x1 - part.x0
            const h = part.y1 - part.y0
            const fill = part.ink / (w * h * CELL * CELL)

            if(h < MIN_HEIGHT_CELLS || w < MIN_WIDTH_CELLS || fill < MIN_FILL || fill > MAX_FILL || h * CELL > MAX_BLOCK_HEIGHT * height || w * CELL > MAX_BLOCK_WIDTH * width){
                continue
            }

            // A single row is much wider than tall (a column of single words is a block of rows)
            const single = h * CELL <= 0.09 * height
            if(single && w < h * MIN_ASPECT){
                continue
            }

            // More ink inside than around it
            const pad = Math.min(6, Math.max(2, h))
            const ex0 = Math.max(0, part.x0 - pad), ey0 = Math.max(0, part.y0 - pad)
            const ex1 = Math.min(columns, part.x1 + pad), ey1 = Math.min(rows, part.y1 + pad)
            const insideArea = w * h
            const ringArea = (ex1 - ex0) * (ey1 - ey0) - insideArea
            const insideInk = inkOf(part.x0, part.y0, part.x1, part.y1)
            const ringInk = inkOf(ex0, ey0, ex1, ey1) - insideInk
            const ratio = ringArea > 0 && ringInk > 0 ? (insideInk / insideArea) / (ringInk / ringArea) : 20
            const onShare = part.on / (w * h)
            // A text that stands out a lot from its surroundings may be thin (a line with wide spaces between the words)
            const minOn = (single ? MIN_ON_SHARE_ROW : MIN_ON_SHARE_BLOCK) * (ratio >= STRONG_RATIO ? 0.6 : 1)
            if(ratio < (w < SMALL_WIDTH_CELLS ? SMALL_RING_RATIO : RING_RATIO) || onShare < minOn){
                continue
            }

            const block = {
                x: part.x0 * CELL / width,
                y: part.y0 * CELL / height,
                w: w * CELL / width,
                h: h * CELL / height,
            }
            const textBox = { x0: part.x0 * CELL, y0: part.y0 * CELL, x1: part.x1 * CELL, y1: part.y1 * CELL }
            const plate = hasPlate(data, fine.mask, width, height, textBox)
            const found = plate ? findPanel(data, fine.mask, width, height, textBox) : null
            const panel = found === null ? undefined : { x: found.x0 / width, y: found.y0 / height, w: (found.x1 - found.x0) / width, h: (found.y1 - found.y0) / height }
            blocks.push({ ...block, ...(panel === undefined ? {} : { panel }), polarity: part.polarity, role: classify(block), plate, score: Math.min(ratio, 12) * Math.sqrt(part.ink) * (plate ? 1.5 : 1), stats: { fill, ratio, onShare } })
        }
    })

    // The same place found as light and as dark text (an outline): keep the bigger one
    const kept: TextBlock[] = []
    for(const block of blocks.sort((a, b) => b.w * b.h - a.w * a.h)){
        if(!kept.some(other => overlapShare(block, other) > 0.6)){
            kept.push(block)
        }
    }

    // The ones that look most like text first; the faintest are noise (more of it shows up in a sharper picture)
    const floor = MIN_SCORE_PER_PIXEL * width
    return { blocks: kept.filter(block => block.score >= floor).sort((a, b) => b.score - a.score).slice(0, limit), masks }
}
