// Small shared state between the gamepad navigation, the dialogs and the stream page.

export const gamepadState = {
    // True while the in-stream Greenlight menu (game bar) is controlled with the gamepad.
    streamMenuOpen: false,

    // True while a screen takes over the pad completely (for example placing the translation window with the sticks).
    captured: false,
}

// Handlers for the "back" (B) button. The most recently added handler runs first;
// a handler returns true when it handled the press.
const backHandlers: Array<() => boolean> = []

export function pushBackHandler(handler: () => boolean): () => void {
    backHandlers.push(handler)

    return () => {
        const index = backHandlers.lastIndexOf(handler)
        if(index !== -1){
            backHandlers.splice(index, 1)
        }
    }
}

export function runBackHandlers(): boolean {
    for(let i = backHandlers.length - 1; i >= 0; i--){
        if(backHandlers[i]() === true){
            return true
        }
    }
    return false
}
