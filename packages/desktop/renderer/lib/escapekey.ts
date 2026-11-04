import InputChannel from 'xbox-xcloud-player/dist/Channel/Input'

// With Mouse & Keyboard the mouse is locked in the video and the keys are sent to the console as they are. Two changes:
// - Esc does not reach the game: alone it holds the Home button of the console (the Xbox button of a controller) while
//   it is pressed, together with Cmd it releases the mouse (the system does that). Together with Shift it is sent as an
//   Esc key, for the games that need it (menu, pause).
// - Cmd is a key of the system, not of the game: the console takes it for the Windows key and opens its guide.
//   Neither Cmd nor the keys pressed together with it are sent.
const proto = InputChannel.prototype as any
const HOME_MAX_MS = 1500
const HOME_CLICK_MS = 150
let installed = false

function isActive(channel: any): boolean {
    return channel._mouseActive === true && channel._mouseLocked === true
}

// The keys whose press was not sent, so that their release is not sent either (and a key sent is always released).
const skipped = new Set<string>()
const sentAsKey = new Set<string>()

// The player sends the state of the controller 60 times a second and keeps the Home button pressed while this is set.
function setHome(channel: any, pressed: boolean) {
    const driver = channel._client?._inputDriver
    if (driver) {
        driver._nexusOverrideN = pressed
    }
}

// Press and release the Home button (the Xbox button of a controller), like the button of the bar does. The press of the
// player lasts a few milliseconds and the next state of the controller replaces it, so it is held for a moment.
export function pressHomeButton(channel: any) {
    if (channel._client?._config?.input_legacykeyboard === true) {
        channel.pressButton(0, 'Nexus')
        return
    }

    setHome(channel, true)
    setTimeout(() => setHome(channel, false), HOME_CLICK_MS)
}

export function applyEscapeAsHome() {
    if (installed) {
        return
    }
    installed = true

    const { onKeyDown, onKeyUp } = proto

    proto.onKeyDown = function (event: KeyboardEvent) {
        if (event.key === 'Meta' || event.metaKey) {
            skipped.add(event.code)
            return
        }

        if (event.key !== 'Escape') {
            return onKeyDown.call(this, event)
        }

        if (event.shiftKey) {
            sentAsKey.add(event.code)
            return onKeyDown.call(this, event)
        }

        skipped.add(event.code)

        if (!event.repeat && isActive(this)) {
            setHome(this, true)
            setTimeout(() => setHome(this, false), HOME_MAX_MS)
        }
    }

    proto.onKeyUp = function (event: KeyboardEvent) {
        if (sentAsKey.delete(event.code)) {
            return onKeyUp.call(this, event)
        }

        if (event.key === 'Escape') {
            setHome(this, false)
        }

        if (skipped.delete(event.code)) {
            return
        }

        return onKeyUp.call(this, event)
    }
}
