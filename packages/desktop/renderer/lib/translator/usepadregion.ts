import React from 'react'
import { getUsablePads, mergeFrames, readPad } from '../gamepad/pads'
import { gamepadState } from '../gamepad/state'
import { Region, clampRegion } from './geometry'

const BASE_SPEED = 0.012

/**
 * Lets the user place the translation window with a gamepad while `active` is true:
 *  - left stick / d-pad moves it,
 *  - right stick changes the width (left / right) and the height (up / down), so it can get any shape,
 *  - LT slows the movement down for fine tuning, RT speeds it up,
 *  - A, B or Menu finishes.
 * The rest of the interface ignores the pad meanwhile.
 */
export default function usePadRegion(
    active: boolean,
    getRegion: () => Region,
    onChange: (region: Region) => void,
    onDone: () => void,
) {
    // Always call the newest callbacks without restarting the loop
    const latest = React.useRef({ getRegion, onChange, onDone })
    latest.current = { getRegion, onChange, onDone }

    React.useEffect(() => {
        if(!active){
            return
        }

        gamepadState.captured = true

        // A is probably still down from the press that started the mode: wait until it is released
        let previousDone = true

        // The region is tracked here, because the screen updates more slowly than the timer ticks
        let working = clampRegion(latest.current.getRegion())

        const tick = () => {
            const frame = mergeFrames(getUsablePads().map(pad => readPad(pad)))
            const current = working

            const speed = BASE_SPEED * (frame.LeftTrigger > 0.3 ? 0.3 : frame.RightTrigger > 0.3 ? 2.5 : 1)
            const moveX = frame.LeftThumbXAxis + frame.DPadRight - frame.DPadLeft
            const moveY = frame.LeftThumbYAxis + frame.DPadDown - frame.DPadUp

            if(moveX !== 0 || moveY !== 0 || frame.RightThumbXAxis !== 0 || frame.RightThumbYAxis !== 0){
                working = clampRegion({
                    x: current.x + moveX * speed,
                    y: current.y + moveY * speed,
                    w: current.w + frame.RightThumbXAxis * speed,
                    h: current.h + frame.RightThumbYAxis * speed,
                })
                latest.current.onChange(working)
            }

            const done = frame.A > 0.5 || frame.B > 0.5 || frame.Menu > 0.5
            if(done && !previousDone){
                previousDone = true
                latest.current.onDone()
                return
            }
            previousDone = done
        }

        // A timer (like the menu navigation) instead of animation frames, which pause when the window is in the background
        const interval = setInterval(tick, 16)

        return () => {
            clearInterval(interval)

            // The menu navigation must not see the button press that ended the mode (it would press A / go back),
            // so it stays blocked for a moment longer
            setTimeout(() => {
                gamepadState.captured = false
            }, 300)
        }
    }, [active])
}
