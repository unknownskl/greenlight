// Shared helpers for reading gamepads (used by the streaming driver and the UI navigation).

// Index in `gamepad.buttons` for the 'standard' gamepad mapping.
export const BUTTON_NAMES = [
    'A', 'B', 'X', 'Y',
    'LeftShoulder', 'RightShoulder',
    'LeftTrigger', 'RightTrigger',
    'View', 'Menu',
    'LeftThumb', 'RightThumb',
    'DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight',
    'Nexus',
] as const

export type ButtonName = typeof BUTTON_NAMES[number]

export interface PadFrame {
    GamepadIndex: number;
    A: number; B: number; X: number; Y: number;
    LeftShoulder: number; RightShoulder: number;
    LeftTrigger: number; RightTrigger: number;
    View: number; Menu: number;
    LeftThumb: number; RightThumb: number;
    DPadUp: number; DPadDown: number; DPadLeft: number; DPadRight: number;
    Nexus: number;
    LeftThumbXAxis: number; LeftThumbYAxis: number;
    RightThumbXAxis: number; RightThumbYAxis: number;
}

const AXIS_NOISE = 0.04

export function emptyFrame(): PadFrame {
    return {
        GamepadIndex: 0,
        A: 0, B: 0, X: 0, Y: 0,
        LeftShoulder: 0, RightShoulder: 0,
        LeftTrigger: 0, RightTrigger: 0,
        View: 0, Menu: 0,
        LeftThumb: 0, RightThumb: 0,
        DPadUp: 0, DPadDown: 0, DPadLeft: 0, DPadRight: 0,
        Nexus: 0,
        LeftThumbXAxis: 0, LeftThumbYAxis: 0,
        RightThumbXAxis: 0, RightThumbYAxis: 0,
    }
}

/**
 * Returns the pads that should be treated as real controllers.
 *
 * On a Steam Deck (and Linux in general) the browser can expose extra "gamepads" that are not controllers
 * (virtual keyboard/mouse devices, raw HID devices). With the 'standard' mapping we know the button layout,
 * so when at least one such pad exists we only use those. Otherwise we fall back to every pad that looks
 * like a controller (at least 4 buttons and 2 axes).
 */
export function getUsablePads(): Gamepad[] {
    if(typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function'){
        return []
    }

    let pads: Gamepad[] = []
    try {
        pads = Array.from(navigator.getGamepads()).filter((pad): pad is Gamepad => {
            return pad !== null && pad !== undefined && pad.connected && pad.buttons.length >= 4 && pad.axes.length >= 2
        })
    } catch(error) {
        return []
    }

    const standard = pads.filter(pad => pad.mapping === 'standard')

    return standard.length > 0 ? standard : pads
}

function axis(value: number | undefined): number {
    if(value === undefined || Number.isNaN(value) || Math.abs(value) < AXIS_NOISE){
        return 0
    }
    return Math.max(-1, Math.min(1, value))
}

/** Map one pad to a frame using the standard layout. */
export function readPad(pad: Gamepad): PadFrame {
    const frame = emptyFrame()

    BUTTON_NAMES.forEach((name, index) => {
        frame[name] = pad.buttons[index]?.value ?? 0
    })

    frame.LeftThumbXAxis = axis(pad.axes[0])
    frame.LeftThumbYAxis = axis(pad.axes[1])
    frame.RightThumbXAxis = axis(pad.axes[2])
    frame.RightThumbYAxis = axis(pad.axes[3])
    frame.GamepadIndex = pad.index

    return frame
}

/** Combine all pads into one frame: buttons take the highest value, axes the largest magnitude. */
export function mergeFrames(frames: PadFrame[]): PadFrame {
    const merged = emptyFrame()

    for(const frame of frames){
        for(const name of BUTTON_NAMES){
            merged[name] = Math.max(merged[name], frame[name])
        }

        for(const name of ['LeftThumbXAxis', 'LeftThumbYAxis', 'RightThumbXAxis', 'RightThumbYAxis'] as const){
            if(Math.abs(frame[name]) > Math.abs(merged[name])){
                merged[name] = frame[name]
            }
        }
    }

    return merged
}
