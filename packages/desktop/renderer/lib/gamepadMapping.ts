// Gamepad button remapping helpers.
//
// A mapping is an object of `{ [XboxButton]: physicalButtonIndex }` where the
// physical index refers to the browser "standard" gamepad layout
// (https://w3c.github.io/gamepad/#remapping). Missing entries fall back to the
// default layout below.

export const XBOX_BUTTONS = [
    'A', 'B', 'X', 'Y',
    'LeftShoulder', 'RightShoulder', 'LeftTrigger', 'RightTrigger',
    'View', 'Menu', 'LeftThumb', 'RightThumb',
    'DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight',
    'Nexus',
] as const

export type XboxButton = typeof XBOX_BUTTONS[number]
export type GamepadMapping = Partial<Record<XboxButton, number>>

// Matches the indices xbox-xcloud-player reads in Driver/Gamepad.ts
export const DEFAULT_GAMEPAD_MAPPING: Record<XboxButton, number> = {
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    LeftShoulder: 4,
    RightShoulder: 5,
    LeftTrigger: 6,
    RightTrigger: 7,
    View: 8,
    Menu: 9,
    LeftThumb: 10,
    RightThumb: 11,
    DPadUp: 12,
    DPadDown: 13,
    DPadLeft: 14,
    DPadRight: 15,
    Nexus: 16,
}

export function resolveMapping(userMapping?: GamepadMapping): Record<XboxButton, number> {
    const result = { ...DEFAULT_GAMEPAD_MAPPING }
    if (userMapping) {
        for (const btn of XBOX_BUTTONS) {
            const idx = userMapping[btn]
            if (typeof idx === 'number' && idx >= 0) result[btn] = idx
        }
    }
    return result
}

export function isDefaultMapping(userMapping?: GamepadMapping): boolean {
    const resolved = resolveMapping(userMapping)
    return XBOX_BUTTONS.every((btn) => resolved[btn] === DEFAULT_GAMEPAD_MAPPING[btn])
}

const EMPTY_BUTTON = { pressed: false, touched: false, value: 0 }

// Returns a gamepad-like object whose buttons are re-ordered so that
// `buttons[DEFAULT_GAMEPAD_MAPPING[btn]]` holds the state of the physical button
// assigned to `btn`. Everything else (axes, vibrationActuator, ...) is preserved.
export function remapGamepad(pad: Gamepad, mapping: Record<XboxButton, number>): Gamepad {
    const buttons: GamepadButton[] = Array.from(pad.buttons)
    for (const btn of XBOX_BUTTONS) {
        buttons[DEFAULT_GAMEPAD_MAPPING[btn]] = pad.buttons[mapping[btn]] ?? EMPTY_BUTTON
    }

    return {
        id: pad.id,
        index: pad.index,
        connected: pad.connected,
        timestamp: pad.timestamp,
        mapping: pad.mapping,
        axes: pad.axes,
        buttons,
        vibrationActuator: (pad as any).vibrationActuator,
        hapticActuators: (pad as any).hapticActuators,
    } as unknown as Gamepad
}

// Patches navigator.getGamepads for the stream so that every consumer (including
// xbox-xcloud-player) sees:
//  1. Connected controllers packed into slots 0..n. The player only announces
//     gamepad index 0 to the console, and Chromium often gives a reconnected
//     controller index 1+, so without this the console ignores its input.
//  2. Remapped buttons, when the user configured a custom mapping.
// Returns a function that restores the original.
export function installGamepadRemap(userMapping?: GamepadMapping): () => void {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
        return () => undefined
    }

    const remap = !isDefaultMapping(userMapping)
    const mapping = resolveMapping(userMapping)
    const original = navigator.getGamepads.bind(navigator)
    let lastLog = ''

    const patched = () => {
        const pads = original()
        const out: (Gamepad | null)[] = [null, null, null, null]
        let slot = 0
        for (let i = 0; i < pads.length && slot < out.length; i++) {
            const pad = pads[i]
            if (!pad || !pad.connected) continue
            const source = remap ? remapGamepad(pad, mapping) : pad
            out[slot] = withIndex(source, slot)
            slot++
        }

        const summary = out.map((p, i) => p ? i + ':' + p.id : '').filter(Boolean).join(' | ')
        if (summary !== lastLog) {
            lastLog = summary
            console.log('[gamepad] Stream controller slots:', summary || 'none', '(physical indices:', Array.from(pads).map((p: Gamepad | null) => p ? p.index : '-').join(','), ')')
        }
        return out
    }

    navigator.getGamepads = patched as any

    return () => {
        if (navigator.getGamepads === (patched as any)) {
            navigator.getGamepads = original
        }
    }
}

// Copy of a gamepad reporting a different index. Keeps live button/axis state
// and the vibration actuator so rumble keeps working.
function withIndex(pad: Gamepad, index: number): Gamepad {
    if (pad.index === index) return pad
    return {
        id: pad.id,
        index,
        connected: pad.connected,
        timestamp: pad.timestamp,
        mapping: pad.mapping,
        axes: pad.axes,
        buttons: pad.buttons,
        vibrationActuator: (pad as any).vibrationActuator,
        hapticActuators: (pad as any).hapticActuators,
    } as unknown as Gamepad
}
