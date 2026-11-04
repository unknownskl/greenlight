import InputChannel from 'xbox-xcloud-player/dist/Channel/Input'
import { mouseSpeedFactor } from './mousesensitivity'

// The player multiplies every mouse movement by 10 and does not allow to change it, which makes the pointer
// of the console very fast. The two handlers that queue mouse frames are wrapped to scale the frames they add.
const proto = InputChannel.prototype as any
let factor = 1
let installed = false

// The console only gets movements, never the position of its pointer. It is estimated by adding the movements sent,
// in pixels of a 1920x1080 picture, and keeping the result inside the picture like the console does. The estimate is only
// good enough to suggest the user how to free the mouse: it drifts when the pointer was moved before the stream started.
// While the mouse is free nothing is sent, so the pointer of the console (and the estimate) stay where they are.
const PICTURE_WIDTH = 1920
const PICTURE_HEIGHT = 1080
const pointer = { x: PICTURE_WIDTH / 2, y: PICTURE_HEIGHT / 2 }

function trackPointer(x: number, y: number) {
    pointer.x = Math.min(PICTURE_WIDTH, Math.max(0, pointer.x + x))
    pointer.y = Math.min(PICTURE_HEIGHT, Math.max(0, pointer.y + y))
}

// Estimated position of the pointer of the console: 0 is the left/top edge and 1 the right/bottom edge.
export function getEstimatedPointer() {
    return { x: pointer.x / PICTURE_WIDTH, y: pointer.y / PICTURE_HEIGHT }
}

// Scaled values are rounded to integers, away from zero in both directions (Math.round() rounds -1.5 to -1 but 1.5 to 2).
// The part lost by the rounding is added to the next movement of the same axis, so the total distance stays exact.
function scale(channel: any, axis: 'X' | 'Y', value: number): number {
    const exact = value * factor + (channel['_sensitivityRemainder' + axis] ?? 0)
    const rounded = Math.sign(exact) * Math.round(Math.abs(exact))

    channel['_sensitivityRemainder' + axis] = exact - rounded

    return rounded
}

function scaleNewFrames(name: 'onPointerMove' | 'onPointerClick') {
    const original = proto[name]

    proto[name] = function (...args: unknown[]) {
        const frames = this._mouseFrames
        const queued = frames.length
        const result = original.apply(this, args)

        for (let i = queued; i < frames.length; i++) {
            frames[i].X = scale(this, 'X', frames[i].X)
            frames[i].Y = scale(this, 'Y', frames[i].Y)
            trackPointer(frames[i].X, frames[i].Y)
        }

        return result
    }
}

// percent: sensitivity of the settings (see mousesensitivity.ts).
export function setMouseSensitivity(percent?: number) {
    factor = mouseSpeedFactor(percent)

    if (!installed) {
        installed = true
        scaleNewFrames('onPointerMove')
        scaleNewFrames('onPointerClick')
    }
}
