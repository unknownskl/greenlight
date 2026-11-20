import { BUTTON_NAMES, PadFrame, emptyFrame, getUsablePads, mergeFrames, readPad } from './pads'

/**
 * Gamepad driver for xbox-xcloud-player (passed in as `input_driver`).
 *
 * The built-in driver of the player has a few problems when more than one gamepad is visible to the browser
 * (for example the Steam Deck controls plus an external controller):
 *  - the loop that registers extra gamepads stops at the first iteration (`return` instead of `continue`),
 *  - only the first connected gamepad is read and it is sent with its own index, while the console is only
 *    told about gamepad 0. As soon as the active pad is not at index 0 the console ignores all input,
 *  - non-controller devices exposed as gamepads (raw HID / virtual devices) can inject phantom button presses.
 *
 * This driver merges every real controller into one virtual gamepad that is always sent as index 0, so
 * the console sees a single stable pad no matter how many controllers are connected or in which order they
 * come and go. Rumble is routed to the controller that was used last.
 *
 * Extra features:
 *  - setSuspended(true) sends neutral input (used while the Greenlight menu is open),
 *  - holding LB + RB + View + Menu for `chordHoldMs` calls `onChord` (opens the Greenlight menu).
 */
export default class GreenlightGamepadDriver {

    _application: any = null

    onChord?: () => void
    chordHoldMs = 1000

    _suspended = false
    _running = false
    _nexusOverrideN = false

    _chordSince = 0
    _chordFired = false
    _chordHeld = false

    // Buttons pressed by the UI (pressButton) for a short time
    _shadow: Partial<Record<typeof BUTTON_NAMES[number], number>> = {}

    // Last controller the user touched (used for rumble)
    _activeIndex = -1
    _lastSnapshot: Record<number, { buttons: number[]; axes: number[] }> = {}

    setApplication(application: any) {
        this._application = application
    }

    start() {
        this._running = true
        window.removeEventListener('keydown', this._downFunc)
        window.removeEventListener('keyup', this._upFunc)
        window.addEventListener('keydown', this._downFunc)
        window.addEventListener('keyup', this._upFunc)
    }

    stop() {
        this._running = false
        window.removeEventListener('keydown', this._downFunc)
        window.removeEventListener('keyup', this._upFunc)
    }

    setSuspended(suspended: boolean) {
        this._suspended = suspended
        this._chordSince = 0
        // If the chord is still held, wait until it is released before it can fire again
        this._chordFired = this._chordHeld
    }

    isSuspended() {
        return this._suspended
    }

    _downFunc = (e: KeyboardEvent) => { this.onKeyChange(e, true) }
    _upFunc = (e: KeyboardEvent) => { this.onKeyChange(e, false) }

    onKeyChange(e: KeyboardEvent, down: boolean) {
        if(e.key === 'n'){
            this._nexusOverrideN = down
        }
    }

    pressButton(index: number, button: string) {
        this._shadow[button] = 1

        setTimeout(() => {
            this._shadow[button] = 0
        }, 60)
    }

    // Only used when the new gamepad driver is selected (input_legacykeyboard === false)
    run() {
        if(this._running === false){
            return
        }

        const input = this._application?.getChannelProcessor('input')
        if(input !== undefined){
            input._inputFps?.count()
            input.queueGamepadStates(this.requestStates())
        }

        setTimeout(() => { this.run() }, 1000 / 60)
    }

    // Interface compatibility with the original driver
    mapStateLabels(buttons: any[], axes: number[]) {
        const frame = emptyFrame()
        BUTTON_NAMES.forEach((name, index) => {
            frame[name] = buttons[index]?.value ?? 0
        })
        frame.LeftThumbXAxis = axes[0] ?? 0
        frame.LeftThumbYAxis = axes[1] ?? 0
        frame.RightThumbXAxis = axes[2] ?? 0
        frame.RightThumbYAxis = axes[3] ?? 0
        return frame
    }

    /** Always returns exactly one frame: the merged state of all controllers, as gamepad index 0. */
    requestStates(): Array<PadFrame> {
        this._patchRumble()

        const pads = getUsablePads()
        this._trackActivity(pads)

        const merged = mergeFrames(pads.map(pad => readPad(pad)))
        merged.GamepadIndex = 0

        // Buttons pressed from the UI
        for(const name of BUTTON_NAMES){
            merged[name] = Math.max(merged[name], this._shadow[name] ?? 0)
        }

        // The Greenlight menu chord. While it is held (or the menu is open) the console gets neutral input.
        const chordDown = merged.LeftShoulder > 0.5 && merged.RightShoulder > 0.5 && merged.View > 0.5 && merged.Menu > 0.5
        const now = Date.now()
        this._chordHeld = chordDown

        if(chordDown){
            if(this._chordSince === 0){
                this._chordSince = now
            } else if(this._chordFired === false && now - this._chordSince >= this.chordHoldMs){
                this._chordFired = true
                this.onChord?.()
            }
        } else {
            this._chordSince = 0
            this._chordFired = false
        }

        if(chordDown || this._suspended){
            return [emptyFrame()]
        }

        // View + Menu together (or the N key) opens the Xbox guide, like the original driver
        if(this._nexusOverrideN || (merged.View > 0.5 && merged.Menu > 0.5)){
            merged.Nexus = 1
        }

        return [merged]
    }

    _trackActivity(pads: Gamepad[]) {
        for(const pad of pads){
            const previous = this._lastSnapshot[pad.index]
            const buttons = pad.buttons.map(button => button.value)
            const axes = Array.from(pad.axes)

            if(previous !== undefined){
                const buttonChanged = buttons.some((value, i) => Math.abs(value - (previous.buttons[i] ?? 0)) > 0.05)
                const axisMoved = axes.some((value, i) => Math.abs(value - (previous.axes[i] ?? 0)) > 0.1 || Math.abs(value) > 0.5)

                if(buttonChanged || axisMoved){
                    this._activeIndex = pad.index
                }
            }

            this._lastSnapshot[pad.index] = { buttons, axes }
        }

        // Forget pads that were unplugged
        for(const index of Object.keys(this._lastSnapshot)){
            if(!pads.some(pad => pad.index === Number(index))){
                delete this._lastSnapshot[Number(index)]
            }
        }

        if(this._activeIndex !== -1 && !pads.some(pad => pad.index === this._activeIndex)){
            this._activeIndex = -1
        }
    }

    /**
     * The console sends rumble for gamepad 0 and the player looks that up in navigator.getGamepads()[0].
     * Make index 0 point at the controller that was used last while the rumble message is processed.
     */
    _patchRumble() {
        const input = this._application?.getChannelProcessor?.('input')
        if(input === undefined || input.__greenlightRumblePatched === true || typeof input.onMessage !== 'function'){
            return
        }

        input.__greenlightRumblePatched = true
        const original = input.onMessage.bind(input)

        input.onMessage = (event: any) => {
            const real = navigator.getGamepads.bind(navigator)
            const pads = getUsablePads()
            const active = pads.find(pad => pad.index === this._activeIndex) ?? pads[0]

            if(active === undefined){
                return original(event)
            }

            try {
                (navigator as any).getGamepads = () => {
                    const list = Array.from(real())
                    list[0] = real()[active.index]
                    return list
                }
                return original(event)
            } finally {
                // Remove the override so the browser's own implementation is used again
                delete (navigator as any).getGamepads
            }
        }
    }
}
