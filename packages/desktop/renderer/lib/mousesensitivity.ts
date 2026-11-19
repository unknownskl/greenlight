export const MOUSE_SENSITIVITY_MIN = 1
export const MOUSE_SENSITIVITY_MAX = 100
export const MOUSE_SENSITIVITY_DEFAULT = 50

// The player sends every mouse movement multiplied by 10, which is too fast even at its lowest useful value:
// the slider goes from 1% to 100% and 100% is 65% of the speed of the player.
const SPEED_AT_MAX = 0.65

export function normalizeMouseSensitivity(percent?: number): number {
    if (typeof percent !== 'number' || Number.isNaN(percent)) {
        return MOUSE_SENSITIVITY_DEFAULT
    }

    return Math.min(MOUSE_SENSITIVITY_MAX, Math.max(MOUSE_SENSITIVITY_MIN, percent))
}

// Part of the speed of the player to use for a sensitivity in percent (1 = the speed of the player).
export function mouseSpeedFactor(percent?: number): number {
    return normalizeMouseSensitivity(percent) / MOUSE_SENSITIVITY_MAX * SPEED_AT_MAX
}
