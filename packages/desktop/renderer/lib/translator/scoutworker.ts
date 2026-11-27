// The scout in a worker: the analysis of a picture (the text pixels and the places that look like text) takes tens of
// milliseconds, and on the page it would stop the picture of the game and the pad for that long every time. This file is built
// into renderer/public/scout/worker.js with `npm run build:scoutworker` (the built file is kept in the repository).
import { analyseScreen } from './scout'

const scope: any = self

scope.onmessage = (event: MessageEvent) => {
    const { id, buffer, width, height, polarities, limit } = event.data
    try {
        const result = analyseScreen(new Uint8ClampedArray(buffer), width, height, polarities, limit)
        scope.postMessage({ id, blocks: result.blocks, masks: result.masks }, result.masks.map(item => item.mask.buffer))
    } catch(error) {
        scope.postMessage({ id, error: String(error) })
    }
}
