// The text pixels of a picture. It has no dependencies: the scout runs in a worker, and the engine on the page.

export type Polarity = 'light' | 'dark'

// A pixel counts as "text" when it stands out from its surroundings: brighter (light text) or darker (dark text)
// than the average of the area around it by at least this much. This works on bright, dark and shaded
// backgrounds alike, which a fixed brightness limit does not.
const CONTRAST_MIN = 38
const LIGHT_FLOOR = 105
const DARK_CEIL = 150

function luminance(data: Uint8ClampedArray, offset: number): number {
    return (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) / 1000
}

/** Marks the pixels that stand out from their surroundings (see CONTRAST_MIN), for one or both kinds of text at once. */
export function inkMasks(data: Uint8ClampedArray, width: number, height: number, polarities: Polarity[]): Array<{ mask: Uint8Array; count: number }> {
    const pixels = width * height
    const luma = new Uint8Array(pixels)
    for(let i = 0; i < pixels; i++){
        luma[i] = luminance(data, i * 4)
    }

    // Integral image: the average of any window is then four lookups
    const stride = width + 1
    const integral = new Uint32Array(stride * (height + 1))
    for(let y = 0; y < height; y++){
        let row = 0
        for(let x = 0; x < width; x++){
            row += luma[y * width + x]
            integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row
        }
    }

    const radius = Math.max(4, Math.round(width * 0.014))
    const results = polarities.map(() => ({ mask: new Uint8Array(pixels), count: 0 }))

    for(let y = 0; y < height; y++){
        const y0 = Math.max(0, y - radius)
        const y1 = Math.min(height - 1, y + radius)

        for(let x = 0; x < width; x++){
            const x0 = Math.max(0, x - radius)
            const x1 = Math.min(width - 1, x + radius)
            const area = (x1 - x0 + 1) * (y1 - y0 + 1)
            const sum = integral[(y1 + 1) * stride + x1 + 1] - integral[y0 * stride + x1 + 1] - integral[(y1 + 1) * stride + x0] + integral[y0 * stride + x0]
            const mean = sum / area
            const value = luma[y * width + x]

            for(let k = 0; k < polarities.length; k++){
                const ink = polarities[k] === 'light'
                    ? (value - mean >= CONTRAST_MIN && value >= LIGHT_FLOOR)
                    : (mean - value >= CONTRAST_MIN && value <= DARK_CEIL)

                if(ink){
                    results[k].mask[y * width + x] = 1
                    results[k].count++
                }
            }
        }
    }

    return results
}


/**
 * The same as inkMasks, in slices: after every few milliseconds of work `breathe` is awaited, so the page can draw the game and
 * read the pad in between (a big picture takes 20 ms or more in one piece, and the camera stutters).
 */
export async function inkMasksInSlices(data: Uint8ClampedArray, width: number, height: number, polarities: Polarity[], breathe: () => Promise<void>, sliceMs = 5): Promise<Array<{ mask: Uint8Array; count: number }>> {
    const pixels = width * height
    const luma = new Uint8Array(pixels)
    let slice = Date.now()
    for(let i = 0; i < pixels; i++){
        luma[i] = luminance(data, i * 4)
        if((i & 0x3fff) === 0 && Date.now() - slice > sliceMs){
            await breathe()
            slice = Date.now()
        }
    }

    const stride = width + 1
    const integral = new Uint32Array(stride * (height + 1))
    for(let y = 0; y < height; y++){
        let row = 0
        for(let x = 0; x < width; x++){
            row += luma[y * width + x]
            integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row
        }
        if(Date.now() - slice > sliceMs){
            await breathe()
            slice = Date.now()
        }
    }

    const radius = Math.max(4, Math.round(width * 0.014))
    const results = polarities.map(() => ({ mask: new Uint8Array(pixels), count: 0 }))

    for(let y = 0; y < height; y++){
        const y0 = Math.max(0, y - radius)
        const y1 = Math.min(height - 1, y + radius)

        for(let x = 0; x < width; x++){
            const x0 = Math.max(0, x - radius)
            const x1 = Math.min(width - 1, x + radius)
            const area = (x1 - x0 + 1) * (y1 - y0 + 1)
            const sum = integral[(y1 + 1) * stride + x1 + 1] - integral[y0 * stride + x1 + 1] - integral[(y1 + 1) * stride + x0] + integral[y0 * stride + x0]
            const mean = sum / area
            const value = luma[y * width + x]

            for(let k = 0; k < polarities.length; k++){
                const ink = polarities[k] === 'light'
                    ? (value - mean >= CONTRAST_MIN && value >= LIGHT_FLOOR)
                    : (mean - value >= CONTRAST_MIN && value <= DARK_CEIL)

                if(ink){
                    results[k].mask[y * width + x] = 1
                    results[k].count++
                }
            }
        }

        if(Date.now() - slice > sliceMs){
            await breathe()
            slice = Date.now()
        }
    }

    return results
}
