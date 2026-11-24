// Detects other applications holding a USB game controller open on macOS.
//
// Chromium on macOS reads Xbox (X-input) controllers through its own USB driver.
// When another app (often another Chromium/Electron app) already holds the USB
// device, Greenlight can't open it and navigator.getGamepads() stays empty, even
// though macOS itself shows the controller as connected. Unplugging and
// replugging the controller releases the hold.
//
// We can't close another process's USB handle. We can only ask that app to
// quit, and only after the user confirms.

import { execFileSync } from 'child_process'
import fs from 'fs'

export interface GamepadHolder {
    pid: number;
    name: string;
    appPath?: string;
    devices: string[];
}

// Known gamepad USB vendor ids (decimal) plus HID game usage detection below
const GAMEPAD_VENDORS = new Set([
    1118, // Microsoft (Xbox / X-input mode, incl. GuliKit, 8BitDo X-input)
    1356, // Sony
    1406, // Nintendo
    11720, // 8BitDo
    3695, // PDP
    3853, // PowerA
    9414, // Hori
    1848, // Mad Catz
    7085, // Razer
    4152, // SteelSeries
])

// Processes we must never offer to quit
const PROTECTED_NAMES = /^(WindowServer|kernel_task|launchd|loginwindow|SystemUIServer|Dock|Finder|controlcenter|ControlCenter|bluetoothd|usbd|gamecontrollerd|gamecontrolleragentd|hidd|coreaudiod|UserEventAgent|IOUserBluetoothSerialDriver)$/i

function isProtectedPath(path: string | undefined): boolean {
    if (!path) return true // unknown -> don't touch
    return path.startsWith('/System/') || path.startsWith('/usr/') || path.startsWith('/sbin/') || path.startsWith('/bin/') || path.startsWith('/Library/Apple/')
}

function processPath(pid: number): string | undefined {
    try {
        return execFileSync('/bin/ps', ['-p', String(pid), '-o', 'comm='], { timeout: 2000, encoding: 'utf8' }).trim() || undefined
    } catch (e) {
        return undefined // not running
    }
}

function appBundle(path: string): string | undefined {
    const m = path.match(/^(.*?\.app)\//)
    return m ? m[1] : undefined
}

function appDisplayName(bundle: string | undefined, fallback: string): string {
    if (!bundle) return fallback
    try {
        const plist = fs.readFileSync(bundle + '/Contents/Info.plist', 'utf8')
        const m = plist.match(/<key>CFBundle(?:Display)?Name<\/key>\s*<string>([^<]+)<\/string>/)
        if (m) return m[1]
    } catch (e) {
        // binary plist or unreadable
    }
    return bundle.split('/').pop().replace(/\.app$/, '')
}

export interface UsbDevice {
    name: string;
    vendor?: number;
    product?: number;
    location?: number;
    creators: number[];
    isGamepad: boolean;
}

// Parse `ioreg -p IOUSB -l -w0` into top-level USB devices with their user-client creators.
export function listUsbDevices(): UsbDevice[] {
    let out = ''
    try {
        out = execFileSync('/usr/sbin/ioreg', ['-r', '-c', 'IOUSBHostDevice', '-l', '-w0'], { timeout: 5000, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    } catch (e) {
        return []
    }

    const devices: UsbDevice[] = []
    let current: UsbDevice | undefined

    for (const line of out.split('\n')) {
        // A new top-level device entry starts with "+-o Name  <class IOUSBHostDevice"
        const start = line.match(/^\+-o (.+?)\s+<class IOUSBHostDevice/)
        if (start) {
            current = { name: start[1].trim().replace(/@[0-9a-f]+$/i, ''), creators: [], isGamepad: false }
            devices.push(current)
            continue
        }
        if (!current) continue

        const vendor = line.match(/"idVendor" = (\d+)/)
        if (vendor && current.vendor === undefined) current.vendor = parseInt(vendor[1])
        const product = line.match(/"idProduct" = (\d+)/)
        if (product && current.product === undefined) current.product = parseInt(product[1])
        const location = line.match(/"locationID" = (\d+)/)
        if (location && current.location === undefined) current.location = parseInt(location[1])

        if (/"UsbExclusiveOwner" = "(Xbox\w*Gamepad|\w*Gamepad\w*)"/.test(line)) current.isGamepad = true
        if (/com\.apple\.gamecontroller\.driver/.test(line)) current.isGamepad = true
        // HID usage page 1 (Generic Desktop), usage 4 (Joystick) / 5 (Gamepad)
        if (/"PrimaryUsagePage" = 1\b/.test(line) && /"PrimaryUsage" = [45]\b/.test(line)) current.isGamepad = true

        const creator = line.match(/"IOUserClientCreator" = "pid (\d+),/)
        if (creator) current.creators.push(parseInt(creator[1]))
    }

    for (const d of devices) {
        if (d.vendor !== undefined && GAMEPAD_VENDORS.has(d.vendor) && /pad|controller|xbox|joy|gulikit|8bitdo|dualsense|dualshock|pro con/i.test(d.name)) {
            d.isGamepad = true
        }
    }

    return devices.filter((d) => d.isGamepad)
}

export function findGamepadHolders(): { gamepads: string[]; holders: GamepadHolder[] } {
    if (process.platform !== 'darwin') return { gamepads: [], holders: [] }

    const gamepads = listUsbDevices()
    const byPid = new Map<number, GamepadHolder>()

    for (const pad of gamepads) {
        for (const pid of pad.creators) {
            if (pid === process.pid || pid <= 1) continue

            const path = processPath(pid)
            if (!path) continue // stale entry, process no longer running

            const exe = path.split('/').pop()
            if (PROTECTED_NAMES.test(exe) || isProtectedPath(path)) continue

            // Skip our own app (main + helpers)
            const bundle = appBundle(path)
            if (bundle && process.execPath.startsWith(bundle + '/')) continue

            const existing = byPid.get(pid)
            if (existing) {
                if (!existing.devices.includes(pad.name)) existing.devices.push(pad.name)
            } else {
                byPid.set(pid, { pid, name: appDisplayName(bundle, exe), appPath: bundle, devices: [pad.name] })
            }
        }
    }

    return { gamepads: gamepads.map((g) => g.name), holders: Array.from(byPid.values()) }
}

// Ask a holder to quit gracefully (equivalent to Cmd+Q). Re-validates the pid first.
export function quitHolder(pid: number): { ok: boolean; error?: string } {
    const current = findGamepadHolders().holders.find((h) => h.pid === pid)
    if (!current) return { ok: false, error: 'Process is no longer holding a controller' }

    try {
        if (current.appPath) {
            // Graceful AppleScript quit lets the app save state / show its own prompts
            execFileSync('/usr/bin/osascript', ['-e', `tell application "${current.appPath.replace(/"/g, '')}" to quit`], { timeout: 10000 })
        } else {
            process.kill(pid, 'SIGTERM')
        }
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
}
