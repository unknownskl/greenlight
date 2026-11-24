// Software "unplug and replug" for USB game controllers on macOS, using the
// bundled gl-usb-reenumerate helper (native/macos/usb-reenumerate.c).

import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { listUsbDevices } from './gamepadholders'

export interface ReconnectResult {
    name: string;
    ok: boolean;
    error?: string;
}

function helperPath(): string | undefined {
    const candidates = [
        // Packaged app: copied via electron-builder extraResources
        path.join(process.resourcesPath || '', 'native', 'gl-usb-reenumerate'),
        // Development: packages/desktop/native-bin/mac
        path.join(app.getAppPath(), 'native-bin', 'mac', 'gl-usb-reenumerate'),
        path.join(app.getAppPath(), '..', 'native-bin', 'mac', 'gl-usb-reenumerate'),
    ]
    return candidates.find((p) => fs.existsSync(p))
}

export function isReconnectSupported(): boolean {
    return process.platform === 'darwin' && helperPath() !== undefined
}

function reenumerate(helper: string, location: number, vendor: number, product: number): Promise<void> {
    return new Promise((resolve, reject) => {
        execFile(helper, [String(location), String(vendor), String(product)], { timeout: 10000 }, (error, stdout) => {
            let parsed: any
            try {
                parsed = JSON.parse(String(stdout).trim().split('\n').pop() || '{}')
            } catch (e) {
                parsed = undefined
            }
            if (parsed && parsed.ok === true) return resolve()
            reject(parsed ? `${parsed.step} failed (${parsed.code})` : (error ? error.message : 'Unknown error'))
        })
    })
}

// Re-enumerates every connected USB game controller.
export async function reconnectGamepads(): Promise<ReconnectResult[]> {
    if (process.platform !== 'darwin') throw new Error('Reconnect is only supported on macOS')
    const helper = helperPath()
    if (!helper) throw new Error('Reconnect helper is missing from this build')

    const pads = listUsbDevices().filter((d) => d.location !== undefined && d.vendor !== undefined && d.product !== undefined)
    const results: ReconnectResult[] = []
    for (const pad of pads) {
        try {
            await reenumerate(helper, pad.location, pad.vendor, pad.product)
            results.push({ name: pad.name, ok: true })
        } catch (error) {
            results.push({ name: pad.name, ok: false, error: String(error) })
        }
    }
    return results
}
