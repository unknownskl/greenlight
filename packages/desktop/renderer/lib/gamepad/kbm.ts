import { PadFrame } from './pads'

/**
 * Keyboard and mouse acting as a gamepad (for playing on a docked Steam Deck or a desktop):
 *
 *   W A S D          left stick                 Space / Enter   A
 *   mouse            right stick (click the     Backspace       B
 *                    picture to lock the        R               X
 *                    mouse, Esc releases it)    F               Y
 *   I J K L          right stick (keys)         Q / E           LB / RB
 *   left mouse       RT                         Shift           L3 (press left stick)
 *   right mouse      LT                         C / middle      R3 (press right stick)
 *   arrow keys       d-pad                      Tab / M / N     View / Menu / Xbox button
 *
 * Keys are matched by their physical position (`event.code`), so this works with any keyboard layout.
 */

const BUTTON_KEYS: Record<string, keyof PadFrame> = {
    Space: 'A',
    Enter: 'A',
    Backspace: 'B',
    KeyR: 'X',
    KeyF: 'Y',
    KeyQ: 'LeftShoulder',
    KeyE: 'RightShoulder',
    Tab: 'View',
    KeyM: 'Menu',
    KeyN: 'Nexus',
    ShiftLeft: 'LeftThumb',
    ShiftRight: 'LeftThumb',
    KeyC: 'RightThumb',
    ArrowUp: 'DPadUp',
    ArrowDown: 'DPadDown',
    ArrowLeft: 'DPadLeft',
    ArrowRight: 'DPadRight',
}

const STICK_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyI', 'KeyJ', 'KeyK', 'KeyL']

// How far the right stick moves for one pixel of mouse movement (multiplied by the sensitivity setting)
const MOUSE_FACTOR = 0.06

function clamp(value: number): number {
    return Math.max(-1, Math.min(1, value))
}

function larger(a: number, b: number): number {
    return Math.abs(b) > Math.abs(a) ? b : a
}

export default class KeyboardMouseEmulation {

    _sensitivity: number
    _keys: Set<string> = new Set()
    _buttons: Set<number> = new Set()

    _mouseX = 0
    _mouseY = 0
    _smoothX = 0
    _smoothY = 0

    // Asked before the mouse is locked (it must not be while a Greenlight menu is open)
    canLock: () => boolean = () => true

    // The mouse could not be locked (the system refused): it is then used without a lock, while it is over the picture
    _free = false

    constructor(sensitivity: number) {
        this._sensitivity = Math.max(0.1, sensitivity)
    }

    start() {
        window.addEventListener('keydown', this._onKeyDown, true)
        window.addEventListener('keyup', this._onKeyUp, true)
        window.addEventListener('blur', this._onBlur)
        window.addEventListener('mousemove', this._onMouseMove, true)
        window.addEventListener('mousedown', this._onMouseDown, true)
        window.addEventListener('mouseup', this._onMouseUp, true)
        window.addEventListener('contextmenu', this._onContextMenu, true)
        document.addEventListener('pointerlockchange', this._onLockChange)
        document.addEventListener('pointerlockerror', this._onLockError)
        this._notify(this._isLocked() ? 'locked' : (this._free ? 'free' : 'unlocked'))
    }

    stop() {
        window.removeEventListener('keydown', this._onKeyDown, true)
        window.removeEventListener('keyup', this._onKeyUp, true)
        window.removeEventListener('blur', this._onBlur)
        window.removeEventListener('mousemove', this._onMouseMove, true)
        window.removeEventListener('mousedown', this._onMouseDown, true)
        window.removeEventListener('mouseup', this._onMouseUp, true)
        window.removeEventListener('contextmenu', this._onContextMenu, true)
        document.removeEventListener('pointerlockchange', this._onLockChange)
        document.removeEventListener('pointerlockerror', this._onLockError)
        this.release()
    }

    /** Tells the interface what the mouse is doing (it shows a hint). */
    _notify(state: 'unlocked' | 'locked' | 'free') {
        window.dispatchEvent(new CustomEvent('greenlight-kbm-state', { detail: state }))
    }

    _onLockChange = () => {
        this._notify(this._isLocked() ? 'locked' : (this._free ? 'free' : 'unlocked'))
    }

    _onLockError = () => {
        this._lockFailed()
    }

    _lockFailed() {
        if(!this._free){
            console.warn('Keyboard and mouse: the mouse could not be locked, using it without a lock')
            this._free = true
            this._notify('free')
        }
    }

    _inPicture(target: EventTarget | null): boolean {
        const element = target as HTMLElement | null
        return element !== null && element !== undefined && element.closest !== undefined && element.closest('#streamComponent') !== null
    }

    /** Gives the mouse back (used while a menu is open). */
    release() {
        this._keys.clear()
        this._buttons.clear()
        this._mouseX = this._mouseY = this._smoothX = this._smoothY = 0

        if(document.pointerLockElement !== null && document.pointerLockElement !== undefined){
            document.exitPointerLock()
        }
    }

    _isLocked(): boolean {
        return document.pointerLockElement !== null && document.pointerLockElement !== undefined
    }

    _isTyping(target: EventTarget | null): boolean {
        const element = target as HTMLElement | null
        return element !== null && element !== undefined && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT' || element.isContentEditable === true)
    }

    _onKeyDown = (event: KeyboardEvent) => {
        if(event.ctrlKey || event.altKey || event.metaKey || this._isTyping(event.target)){
            return
        }

        if(BUTTON_KEYS[event.code] !== undefined || STICK_KEYS.includes(event.code)){
            event.preventDefault()
            this._keys.add(event.code)
        }
    }

    _onKeyUp = (event: KeyboardEvent) => {
        this._keys.delete(event.code)
    }

    _onBlur = () => {
        this._keys.clear()
        this._buttons.clear()
    }

    _onMouseMove = (event: MouseEvent) => {
        if(this._isLocked() || (this._free && this._inPicture(event.target))){
            this._mouseX += event.movementX
            this._mouseY += event.movementY
        }
    }

    _onMouseDown = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null

        if(!this._isLocked() && !this._free){
            // Click on the picture: take the mouse (Esc gives it back)
            if(this.canLock() && this._inPicture(target)){
                try {
                    const holder = (document.getElementById('streamComponent') ?? target) as any
                    const request = holder.requestPointerLock?.()
                    if(request !== undefined && typeof request.catch === 'function'){
                        request.catch(() => this._lockFailed())
                    } else if(request === undefined && holder.requestPointerLock === undefined){
                        this._lockFailed()
                    }
                } catch(error) {
                    this._lockFailed()
                }
                event.preventDefault()
            }
            return
        }

        // Without a lock the buttons only count over the picture
        if(!this._isLocked() && (!this._inPicture(target) || !this.canLock())){
            return
        }

        this._buttons.add(event.button)
        event.preventDefault()
    }

    _onMouseUp = (event: MouseEvent) => {
        this._buttons.delete(event.button)
    }

    _onContextMenu = (event: Event) => {
        if(this._isLocked() || (this._free && this._inPicture(event.target))){
            event.preventDefault()
        }
    }

    /** Adds the state of the keyboard and the mouse to a gamepad frame. */
    apply(frame: PadFrame) {
        this._keys.forEach((code) => {
            const button = BUTTON_KEYS[code]
            if(button !== undefined){
                (frame as any)[button] = 1
            }
        })

        // Left stick: W A S D
        let lx = (this._keys.has('KeyD') ? 1 : 0) - (this._keys.has('KeyA') ? 1 : 0)
        let ly = (this._keys.has('KeyS') ? 1 : 0) - (this._keys.has('KeyW') ? 1 : 0)
        const leftLength = Math.hypot(lx, ly)
        if(leftLength > 1){
            lx /= leftLength
            ly /= leftLength
        }
        frame.LeftThumbXAxis = larger(frame.LeftThumbXAxis, lx)
        frame.LeftThumbYAxis = larger(frame.LeftThumbYAxis, ly)

        // Right stick: the mouse (while it is locked) and I J K L
        const rawX = clamp(this._mouseX * MOUSE_FACTOR * this._sensitivity)
        const rawY = clamp(this._mouseY * MOUSE_FACTOR * this._sensitivity)
        this._mouseX = 0
        this._mouseY = 0
        this._smoothX = rawX * 0.6 + this._smoothX * 0.4
        this._smoothY = rawY * 0.6 + this._smoothY * 0.4

        let rx = (this._keys.has('KeyL') ? 1 : 0) - (this._keys.has('KeyJ') ? 1 : 0)
        let ry = (this._keys.has('KeyK') ? 1 : 0) - (this._keys.has('KeyI') ? 1 : 0)
        const rightLength = Math.hypot(rx, ry)
        if(rightLength > 1){
            rx /= rightLength
            ry /= rightLength
        }
        frame.RightThumbXAxis = larger(frame.RightThumbXAxis, clamp(rx + this._smoothX))
        frame.RightThumbYAxis = larger(frame.RightThumbYAxis, clamp(ry + this._smoothY))

        // Mouse buttons (only while the mouse is locked, or over the picture when it cannot be locked): left = RT, right = LT, middle = R3
        if(this._buttons.has(0)){ frame.RightTrigger = 1 }
        if(this._buttons.has(2)){ frame.LeftTrigger = 1 }
        if(this._buttons.has(1)){ frame.RightThumb = 1 }
    }
}
