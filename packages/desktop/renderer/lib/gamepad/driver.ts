import { BUTTON_NAMES, PadFrame, emptyFrame, getUsablePads, mergeFrames, readPad } from './pads'
import KeyboardMouseEmulation from './kbm'

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
// How long one vibration effect may last (ms): the game renews it all the time while it is running
const MAX_RUMBLE_MS = 250

export default class GreenlightGamepadDriver {

    _application: any = null

    // Opens the Greenlight menu (LB + RB + View + Menu, held)
    onChord?: () => void
    chordHoldMs = 1000

    // Screen translator shortcuts: LB + RB + Y turns it on / off, LB + RB + X moves its window (held a moment)
    onTranslatorToggle?: () => void
    onTranslatorArea?: () => void
    shortcutHoldMs = 600

    _suspended = false
    _running = false
    _nexusOverrideN = false

    _chords: Record<string, { since: number; fired: boolean; held: boolean }> = {}

    // Keyboard and mouse acting as a gamepad (see kbm.ts)
    _kbm: KeyboardMouseEmulation | null = null

    // How strong the vibration is (1 = as the game asks for it)
    _rumbleStrength = 1

    constructor(options: { keyboardMouse?: boolean; sensitivity?: number; rumbleStrength?: number } = {}) {
        if(typeof options.rumbleStrength === 'number' && Number.isFinite(options.rumbleStrength)){
            this._rumbleStrength = Math.max(0, Math.min(1, options.rumbleStrength))
        }

        if(options.keyboardMouse === true){
            this._kbm = new KeyboardMouseEmulation(options.sensitivity ?? 1)
            this._kbm.canLock = () => !this._suspended
        }
    }

    // Buttons pressed by the UI (pressButton) for a short time
    _shadow: Partial<Record<typeof BUTTON_NAMES[number], number>> = {}

    // Last controller the user touched (used for rumble)
    _activeIndex = -1
    _lastSnapshot: Record<number, { buttons: number[]; axes: number[] }> = {}

    setApplication(application: any) {
        this._application = application
    }

    start() {
        this._kbm?.start()
        this._running = true
        window.removeEventListener('keydown', this._downFunc)
        window.removeEventListener('keyup', this._upFunc)
        window.addEventListener('keydown', this._downFunc)
        window.addEventListener('keyup', this._upFunc)
    }

    stop() {
        this._kbm?.stop()
        this._running = false
        window.removeEventListener('keydown', this._downFunc)
        window.removeEventListener('keyup', this._upFunc)
    }

    setSuspended(suspended: boolean) {
        this._suspended = suspended
        if(suspended){
            // A menu needs the mouse
            this._kbm?.release()
        }
        // If a chord is still held, wait until it is released before it can fire again
        for(const name of Object.keys(this._chords)){
            this._chords[name].since = 0
            this._chords[name].fired = this._chords[name].held
        }
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

        // Keyboard and mouse (when they act as a gamepad) are added to the controllers
        if(this._kbm !== null){
            this._kbm.apply(merged)
        }

        // Shortcuts. While one is held (or the menu is open) the console gets neutral input.
        const bumpers = merged.LeftShoulder > 0.5 && merged.RightShoulder > 0.5
        const menuChord = bumpers && merged.View > 0.5 && merged.Menu > 0.5
        const toggleChord = bumpers && merged.Y > 0.5 && !menuChord
        const areaChord = bumpers && merged.X > 0.5 && !menuChord
        const now = Date.now()

        this._trackChord('menu', menuChord, now, this.chordHoldMs, this.onChord)
        this._trackChord('translator-toggle', toggleChord, now, this.shortcutHoldMs, this.onTranslatorToggle)
        this._trackChord('translator-area', areaChord, now, this.shortcutHoldMs, this.onTranslatorArea)

        if(menuChord || toggleChord || areaChord || this._suspended){
            return [emptyFrame()]
        }

        // View + Menu together (or the N key) opens the Xbox guide, like the original driver
        if(this._nexusOverrideN || (merged.View > 0.5 && merged.Menu > 0.5)){
            merged.Nexus = 1
        }

        return [merged]
    }

    _trackChord(name: string, down: boolean, now: number, holdMs: number, callback?: () => void) {
        if(this._chords[name] === undefined){
            this._chords[name] = { since: 0, fired: false, held: false }
        }

        const chord = this._chords[name]
        chord.held = down

        if(down){
            if(chord.since === 0){
                chord.since = now
            } else if(chord.fired === false && now - chord.since >= holdMs){
                chord.fired = true
                callback?.()
            }
        } else {
            chord.since = 0
            chord.fired = false
        }
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

    /** The controller as the player sees it when it makes it vibrate: with the vibration scaled to the setting. */
    _weakenRumble(pad: Gamepad | null): Gamepad | null {
        const actuator: any = pad === null ? undefined : (pad as any).vibrationActuator
        if(pad === null || actuator === undefined || actuator === null){
            return pad
        }

        const factor = this._rumbleStrength
        const scaled = {
            type: actuator.type,
            playEffect: (type: string, params: any) => actuator.playEffect(type, {
                ...params,
                // The console asks for the longest time (2.55 s) every time and sends a new state many times a second while the game
                // runs; when the game is paused nothing more comes, and the last effect would go on for seconds. A short effect that
                // the stream keeps renewing stops almost at once then.
                duration: Math.min(typeof params.duration === 'number' ? params.duration : MAX_RUMBLE_MS, MAX_RUMBLE_MS),
                weakMagnitude: (params.weakMagnitude ?? 0) * factor,
                strongMagnitude: (params.strongMagnitude ?? 0) * factor,
                leftTrigger: (params.leftTrigger ?? 0) * factor,
                rightTrigger: (params.rightTrigger ?? 0) * factor,
            }),
            reset: () => actuator.reset?.(),
        }

        return new Proxy(pad, {
            get(target: any, name: string | symbol) {
                if(name === 'vibrationActuator'){
                    return scaled
                }
                const value = target[name]
                return typeof value === 'function' ? value.bind(target) : value
            },
        })
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
            const canRumble = (pad: Gamepad | null | undefined) => pad !== null && pad !== undefined && pad.connected && (pad as any).vibrationActuator !== null && (pad as any).vibrationActuator !== undefined

            // The controller that was used last, if it can vibrate; else any controller that can (the Steam Deck's own
            // controls may not be able to while a controller that is connected to it can); else the one used last
            const active = pads.find(pad => pad.index === this._activeIndex && canRumble(pad))
                ?? pads.find(pad => canRumble(pad))
                ?? (Array.from(real()) as Array<Gamepad | null>).find(pad => canRumble(pad))
                ?? pads.find(pad => pad.index === this._activeIndex)
                ?? pads[0]

            if(active === undefined || active === null){
                return original(event)
            }

            try {
                (navigator as any).getGamepads = () => {
                    const list = Array.from(real())
                    list[0] = this._weakenRumble(real()[active.index])
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
