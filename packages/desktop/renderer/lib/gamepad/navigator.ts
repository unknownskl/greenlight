import { getUsablePads, mergeFrames, readPad, BUTTON_NAMES } from './pads'
import { runBackHandlers } from './state'

type Direction = 'up' | 'down' | 'left' | 'right'

export interface NavigatorOptions {
    // Part of the page that can be navigated (a dialog, the stream menu, or the whole document)
    getRoot: () => ParentNode | null;
    // Navigation is paused when this returns false (for example while a stream is controlled by the pad)
    isEnabled: () => boolean;
    // Called with true when a gamepad is being used and false after a while without input
    onActivity?: (active: boolean) => void;
}

const FOCUSABLE = 'a[href], button, input:not([type="hidden"]):not([type="file"]), select, textarea, [role="button"], [data-gp-focusable]'
const FOCUS_CLASS = 'gp-focus'

const REPEAT_DELAY = 380
const REPEAT_RATE = 110
const STICK_THRESHOLD = 0.6
const ACTIVITY_TIMEOUT = 8000

// LB / RB switch between the main sections, LT / RT between the sub sections (settings pages)
const PRIMARY_TABS = '#component_header ul.menu a'
const SECONDARY_TABS = '#component_settings_sidebar_menu a'

const TEXT_INPUT_TYPES = ['text', 'search', 'number', 'password', 'email', 'url', 'tel']

function normalizePath(path: string): string {
    return path.replace(/\.html$/, '').replace(/\/+$/, '')
}

function gap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
    if(aEnd < bStart){ return bStart - aEnd }
    if(bEnd < aStart){ return aStart - bEnd }
    return 0
}

export default class GamepadNavigator {

    _options: NavigatorOptions
    _interval: ReturnType<typeof setInterval> | undefined

    _current: HTMLElement | null = null
    _previous: Record<string, boolean> = {}
    _held: { direction: Direction | null; since: number; last: number } = { direction: null, since: 0, last: 0 }

    _active = false
    _lastActivity = 0

    constructor(options: NavigatorOptions) {
        this._options = options
    }

    start() {
        if(this._interval !== undefined){
            return
        }

        this._interval = setInterval(() => this.tick(), 16)
        window.addEventListener('pointerdown', this._onPointer, true)
        window.addEventListener('keydown', this._onKey, true)
    }

    stop() {
        if(this._interval !== undefined){
            clearInterval(this._interval)
            this._interval = undefined
        }

        window.removeEventListener('pointerdown', this._onPointer, true)
        window.removeEventListener('keydown', this._onKey, true)
        this.clearCurrent()
        this.setActive(false)
    }

    // Touch or mouse input: hide the focus ring until the gamepad is used again
    _onPointer = () => {
        this.clearCurrent()
        this.setActive(false)
    }

    // Keyboard fallback (for Steam Input layouts that send arrow keys / enter / escape)
    _onKey = (event: KeyboardEvent) => {
        if(!this._options.isEnabled() || event.ctrlKey || event.altKey || event.metaKey){
            return
        }

        if(this.isEditing() && event.key !== 'Escape'){
            return
        }

        const directions: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

        if(directions[event.key] !== undefined){
            event.preventDefault()
            this.move(directions[event.key])
        } else if(event.key === 'Enter' && document.activeElement === document.body){
            if(this._current !== null){
                event.preventDefault()
                this.activate(this._current)
            }
        } else if(event.key === 'Escape'){
            if(this.isEditing()){
                (document.activeElement as HTMLElement).blur()
            } else {
                this.back()
            }
        }
    }

    tick() {
        const pads = getUsablePads()
        const now = performance.now()

        const frame = mergeFrames(pads.map(pad => readPad(pad)))

        // Edge detection for every button, also while disabled so a held button does not fire when enabled again
        const pressed: Record<string, boolean> = {}
        for(const name of BUTTON_NAMES){
            const down = frame[name] > 0.5
            pressed[name] = down && this._previous[name] !== true
            this._previous[name] = down
        }

        if(pads.length === 0){
            this.setActive(false)
            return
        }

        if(!this._options.isEnabled()){
            this._held = { direction: null, since: 0, last: 0 }
            return
        }

        const anyInput = BUTTON_NAMES.some(name => frame[name] > 0.5)
            || Math.abs(frame.LeftThumbXAxis) > STICK_THRESHOLD || Math.abs(frame.LeftThumbYAxis) > STICK_THRESHOLD
            || Math.abs(frame.RightThumbYAxis) > 0.3

        if(anyInput){
            this._lastActivity = now
            this.setActive(true)
        } else if(this._active && now - this._lastActivity > ACTIVITY_TIMEOUT){
            this.setActive(false)
        }

        // Direction (d-pad or left stick) with key repeat
        let direction: Direction | null = null
        if(frame.DPadUp > 0.5){ direction = 'up' }
        else if(frame.DPadDown > 0.5){ direction = 'down' }
        else if(frame.DPadLeft > 0.5){ direction = 'left' }
        else if(frame.DPadRight > 0.5){ direction = 'right' }
        else if(Math.abs(frame.LeftThumbXAxis) > STICK_THRESHOLD || Math.abs(frame.LeftThumbYAxis) > STICK_THRESHOLD){
            if(Math.abs(frame.LeftThumbXAxis) > Math.abs(frame.LeftThumbYAxis)){
                direction = frame.LeftThumbXAxis > 0 ? 'right' : 'left'
            } else {
                direction = frame.LeftThumbYAxis > 0 ? 'down' : 'up'
            }
        }

        if(direction === null){
            this._held = { direction: null, since: 0, last: 0 }
        } else if(this._held.direction !== direction){
            this._held = { direction, since: now, last: now }
            this.move(direction)
        } else if(now - this._held.since > REPEAT_DELAY && now - this._held.last > REPEAT_RATE){
            this._held.last = now
            this.move(direction)
        }

        // Right stick scrolls
        if(Math.abs(frame.RightThumbYAxis) > 0.3){
            this.scroll(frame.RightThumbYAxis * 22)
        }

        if(pressed.A){
            if(this.isEditing()){
                (document.activeElement as HTMLElement).blur()
            } else {
                this.ensureCurrent((el) => this.activate(el))
            }
        }

        if(pressed.B){
            if(this.isEditing()){
                (document.activeElement as HTMLElement).blur()
            } else {
                this.back()
            }
        }

        if(pressed.LeftShoulder){ this.cycleTabs(PRIMARY_TABS, -1, 'section') }
        if(pressed.RightShoulder){ this.cycleTabs(PRIMARY_TABS, 1, 'section') }
        if(pressed.LeftTrigger){ this.cycleTabs(SECONDARY_TABS, -1, 'exact') }
        if(pressed.RightTrigger){ this.cycleTabs(SECONDARY_TABS, 1, 'exact') }
    }

    setActive(active: boolean) {
        if(this._active !== active){
            this._active = active
            this._options.onActivity?.(active)
        }
    }

    isEditing(): boolean {
        const el = document.activeElement as HTMLElement | null
        if(el === null){ return false }

        if(el.tagName === 'TEXTAREA'){ return true }
        return el.tagName === 'INPUT' && TEXT_INPUT_TYPES.includes((el as HTMLInputElement).type)
    }

    back() {
        if(runBackHandlers()){
            return
        }

        window.history.back()
    }

    // --- Focus handling -----------------------------------------------------

    setCurrent(el: HTMLElement | null) {
        if(this._current !== null){
            this._current.classList.remove(FOCUS_CLASS)
        }

        this._current = el

        if(el !== null){
            el.classList.add(FOCUS_CLASS)
            el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        }
    }

    clearCurrent() {
        this.setCurrent(null)
    }

    _isUsable(el: HTMLElement, root: ParentNode): boolean {
        if((el as any).disabled === true){ return false }
        if(el.closest('[data-gp-ignore], [aria-hidden="true"], [hidden], .hidden') !== null){ return false }

        const rect = el.getBoundingClientRect()
        if(rect.width <= 0 || rect.height <= 0){ return false }

        const checkVisibility = (el as any).checkVisibility
        if(typeof checkVisibility === 'function' && checkVisibility.call(el, { visibilityProperty: true }) === false){
            return false
        }

        // Keep the previous element if it is still part of the navigable root only
        return (root as Node).contains(el)
    }

    _getCandidates(root: ParentNode): HTMLElement[] {
        const found = (Array.from(root.querySelectorAll(FOCUSABLE)) as HTMLElement[]).filter(el => this._isUsable(el, root))

        // When a focusable element contains another one (<a><button/></a>) only keep the inner one
        const set = new Set(found)
        const hasChild = new Set<HTMLElement>()
        for(const el of found){
            let parent = el.parentElement
            while(parent !== null){
                if(set.has(parent)){ hasChild.add(parent) }
                parent = parent.parentElement
            }
        }

        return found.filter(el => !hasChild.has(el))
    }

    _pickInitial(root: ParentNode): HTMLElement | null {
        const preferred = (root as Element).querySelector?.('[data-gp-default]') as HTMLElement | null
        if(preferred !== null && preferred !== undefined && this._isUsable(preferred, root)){
            return preferred
        }

        let candidates = this._getCandidates(root)

        // On a normal page prefer the page content over the header and the sidebar
        const content = root === document ? document.getElementById('app_body_container') : null
        if(content !== null){
            const inContent = candidates.filter(el => content.contains(el))
            if(inContent.length > 0){
                candidates = inContent
            }
        }

        const visible = candidates.filter((el) => {
            const rect = el.getBoundingClientRect()
            return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
        })
        const list = visible.length > 0 ? visible : candidates

        let best: HTMLElement | null = null
        let bestScore = Infinity
        for(const el of list){
            const rect = el.getBoundingClientRect()
            const score = Math.max(rect.top, 0) * 2 + rect.left
            if(score < bestScore){
                best = el
                bestScore = score
            }
        }

        return best
    }

    // Makes sure there is a focused element. Calls `callback` when it was already focused before this press;
    // otherwise the first press only shows the focus ring.
    ensureCurrent(callback?: (el: HTMLElement) => void): HTMLElement | null {
        const root = this._options.getRoot()
        if(root === null){ return null }

        if(this._current !== null && this._current.isConnected && this._isUsable(this._current, root)){
            if(callback !== undefined){ callback(this._current) }
            return this._current
        }

        const initial = this._pickInitial(root)
        this.setCurrent(initial)

        return initial
    }

    // --- Movement ----------------------------------------------------------

    move(direction: Direction) {
        if(this.isEditing()){
            if(direction === 'up' || direction === 'down'){
                (document.activeElement as HTMLElement).blur()
            } else {
                return
            }
        }

        const root = this._options.getRoot()
        if(root === null){ return }

        const hadFocus = this._current !== null && this._current.isConnected && this._isUsable(this._current, root)
        const current = this.ensureCurrent()
        if(current === null || hadFocus === false){
            return
        }

        if((direction === 'left' || direction === 'right') && this.adjust(current, direction)){
            return
        }

        const next = this.findNext(root, current, direction)
        if(next !== null){
            this.setCurrent(next)
        } else if(direction === 'up' || direction === 'down'){
            this.scroll(direction === 'down' ? 160 : -160)
        }
    }

    findNext(root: ParentNode, current: HTMLElement, direction: Direction): HTMLElement | null {
        const cr = current.getBoundingClientRect()
        const cx = cr.left + cr.width / 2
        const cy = cr.top + cr.height / 2

        let best: HTMLElement | null = null
        let bestScore = Infinity

        for(const el of this._getCandidates(root)){
            if(el === current){ continue }

            const r = el.getBoundingClientRect()
            const rx = r.left + r.width / 2
            const ry = r.top + r.height / 2

            let primary = 0
            let secondary = 0
            let perpendicular = 0
            let ok = false

            switch(direction){
                case 'right':
                    ok = rx > cx + 1 && r.right > cr.right - 1
                    primary = Math.max(0, r.left - cr.right)
                    secondary = gap(r.top, r.bottom, cr.top, cr.bottom)
                    perpendicular = Math.abs(ry - cy)
                    break
                case 'left':
                    ok = rx < cx - 1 && r.left < cr.left + 1
                    primary = Math.max(0, cr.left - r.right)
                    secondary = gap(r.top, r.bottom, cr.top, cr.bottom)
                    perpendicular = Math.abs(ry - cy)
                    break
                case 'down':
                    ok = ry > cy + 1 && r.bottom > cr.bottom - 1
                    primary = Math.max(0, r.top - cr.bottom)
                    secondary = gap(r.left, r.right, cr.left, cr.right)
                    perpendicular = Math.abs(rx - cx)
                    break
                case 'up':
                    ok = ry < cy - 1 && r.top < cr.top + 1
                    primary = Math.max(0, cr.top - r.bottom)
                    secondary = gap(r.left, r.right, cr.left, cr.right)
                    perpendicular = Math.abs(rx - cx)
                    break
            }

            if(!ok){ continue }

            const score = primary + secondary * 3 + perpendicular * 0.3
            if(score < bestScore){
                best = el
                bestScore = score
            }
        }

        return best
    }

    // --- Scrolling ---------------------------------------------------------

    _findScroller(): Element {
        let el: Element | null = this._current?.parentElement ?? null
        while(el !== null && el !== document.body){
            const style = getComputedStyle(el)
            if((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight){
                return el
            }
            el = el.parentElement
        }

        return document.getElementById('app_body') ?? document.scrollingElement ?? document.documentElement
    }

    scroll(amount: number) {
        this._findScroller().scrollBy({ top: amount })
    }

    // --- Actions -----------------------------------------------------------

    // Left / right on sliders and selects changes the value. Returns true when handled.
    adjust(el: HTMLElement, direction: 'left' | 'right'): boolean {
        const delta = direction === 'right' ? 1 : -1

        if(el instanceof HTMLInputElement && el.type === 'range'){
            const min = el.min !== '' ? parseFloat(el.min) : 0
            const max = el.max !== '' ? parseFloat(el.max) : 100
            const step = el.step !== '' && el.step !== 'any' ? parseFloat(el.step) : 1
            const value = Math.min(max, Math.max(min, parseFloat(el.value) + delta * step))

            this.setNativeValue(el, String(value))
            return true
        }

        if(el instanceof HTMLSelectElement){
            const index = Math.min(el.options.length - 1, Math.max(0, el.selectedIndex + delta))
            if(index !== el.selectedIndex){
                el.selectedIndex = index
                el.dispatchEvent(new Event('change', { bubbles: true }))
            }
            return true
        }

        return false
    }

    // React only notices value changes that go through the native setter
    setNativeValue(el: HTMLInputElement, value: string) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        setter?.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
    }

    activate(el: HTMLElement) {
        if(el instanceof HTMLInputElement){
            if(el.type === 'checkbox' || el.type === 'radio' || el.type === 'button' || el.type === 'submit'){
                el.click()
            } else if(el.type === 'range'){
                // handled with left / right
            } else {
                el.focus()
            }
            return
        }

        if(el instanceof HTMLTextAreaElement){
            el.focus()
            return
        }

        if(el instanceof HTMLSelectElement){
            // Cycle through the options (wraps around)
            el.selectedIndex = (el.selectedIndex + 1) % el.options.length
            el.dispatchEvent(new Event('change', { bubbles: true }))
            return
        }

        el.click()
    }

    _isActiveTab(link: HTMLAnchorElement, mode: 'section' | 'exact'): boolean {
        const current = normalizePath(window.location.pathname)
        const target = normalizePath(link.pathname)

        if(mode === 'exact'){
            if(target === current){ return true }
        } else {
            const section = (path: string) => path.split('/').filter(Boolean)[0]
            if(section(target) !== undefined && section(target) === section(current)){ return true }
        }

        return link.classList.contains('active') || link.parentElement?.classList.contains('active') === true
    }

    cycleTabs(selector: string, delta: number, mode: 'section' | 'exact') {
        if(this.isEditing()){ return }

        const links = (Array.from(document.querySelectorAll(selector)) as HTMLAnchorElement[]).filter(link => link.getBoundingClientRect().width > 0)
        if(links.length < 2){ return }

        const index = links.findIndex(link => this._isActiveTab(link, mode))
        const target = index === -1 ? (delta > 0 ? 0 : links.length - 1) : (index + delta + links.length) % links.length

        this.clearCurrent()
        links[target].click()
    }
}
