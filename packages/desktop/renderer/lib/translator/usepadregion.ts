import React from 'react'
import { getUsablePads, mergeFrames, readPad } from '../gamepad/pads'
import { gamepadState } from '../gamepad/state'
import { Region, clampRegion } from './geometry'

const BASE_SPEED = 0.012

// A resting stick is never exactly in the middle: everything inside this circle counts as "not touched",
// and the rest of the travel is stretched over 0..1 (with a soft start for fine placement)
const STICK_DEADZONE = 0.22

function stick(x: number, y: number): [number, number] {
    const length = Math.hypot(x, y)
    if(length <= STICK_DEADZONE){
        return [0, 0]
    }

    const strength = Math.min(1, (length - STICK_DEADZONE) / (1 - STICK_DEADZONE))
    const scale = (strength * strength) / length
    return [x * scale, y * scale]
}

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
    options: {
        // Keeps the window out of the way of other windows
        constrain?: (next: Region, previous: Region) => Region;
        // X / Y / View pressed (one call per press)
        onButton?: (button: 'X' | 'Y' | 'View') => void;
    } = {},
) {
    // Always call the newest callbacks without restarting the loop
    const latest = React.useRef({ getRegion, onChange, onDone, options })
    latest.current = { getRegion, onChange, onDone, options }

    React.useEffect(() => {
        if(!active){
            return
        }

        gamepadState.captured = true

        // A is probably still down from the press that started the mode: wait until it is released
        let previousDone = true
        const previousButtons = { X: true, Y: true, View: true }

        // The region is tracked here, because the screen updates more slowly than the timer ticks
        let working = clampRegion(latest.current.getRegion())

        const tick = () => {
            const frame = mergeFrames(getUsablePads().map(pad => readPad(pad)))
            const current = working

            const speed = BASE_SPEED * (frame.LeftTrigger > 0.3 ? 0.3 : frame.RightTrigger > 0.3 ? 2.5 : 1)
            const [leftX, leftY] = stick(frame.LeftThumbXAxis, frame.LeftThumbYAxis)
            const [rightX, rightY] = stick(frame.RightThumbXAxis, frame.RightThumbYAxis)
            const moveX = leftX + frame.DPadRight - frame.DPadLeft
            const moveY = leftY + frame.DPadDown - frame.DPadUp

            if(moveX !== 0 || moveY !== 0 || rightX !== 0 || rightY !== 0){
                const moved = clampRegion({
                    ...current,
                    x: current.x + moveX * speed,
                    y: current.y + moveY * speed,
                    w: current.w + rightX * speed,
                    h: current.h + rightY * speed,
                })
                const constrain = latest.current.options.constrain
                working = constrain ? constrain(moved, current) : moved
                latest.current.onChange(working)
            }

            for(const button of ['X', 'Y', 'View'] as const){
                const pressed = frame[button] > 0.5
                if(pressed && !previousButtons[button]){
                    const onButton = latest.current.options.onButton
                    if(onButton){
                        onButton(button)
                        // The window may have changed: continue from the new one
                        working = clampRegion(latest.current.getRegion())
                    }
                }
                previousButtons[button] = pressed
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
