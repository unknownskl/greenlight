import KeyboardDriver from 'xbox-xcloud-player/dist/Driver/Keyboard'
import { STICK_KEYS } from './stickkeys'

// The keyboard driver of the player maps a key to a button, or to an axis with the value 1 (a key cannot give -1).
// A stick is mapped with four keys instead: each axis takes the difference of its two directions.
// The value for "down" is positive and "up" negative, like the axes of the Gamepad API that the player sends for a controller.
const AXES = {
    LeftThumbXAxis: { positive: 'LeftStickRight', negative: 'LeftStickLeft' },
    LeftThumbYAxis: { positive: 'LeftStickDown', negative: 'LeftStickUp' },
    RightThumbXAxis: { positive: 'RightStickRight', negative: 'RightStickLeft' },
    RightThumbYAxis: { positive: 'RightStickDown', negative: 'RightStickUp' },
}

let installed = false

export function applyKeyboardSticks() {
    if (installed) {
        return
    }
    installed = true

    const proto = KeyboardDriver.prototype as any
    const original = proto.onKeyChange

    proto.onKeyChange = function (e: KeyboardEvent, down: boolean) {
        const mapped = this._mouseKeyboardConfig._keymapping[e.key]

        if (!STICK_KEYS.includes(mapped)) {
            return original.call(this, e, down)
        }

        this._stickKeys = this._stickKeys ?? {}
        this._stickKeys[mapped] = down ? 1 : 0

        for (const [axis, keys] of Object.entries(AXES)) {
            if (keys.positive === mapped || keys.negative === mapped) {
                this._keyboardState[axis] = (this._stickKeys[keys.positive] ?? 0) - (this._stickKeys[keys.negative] ?? 0)
            }
        }
    }
}
