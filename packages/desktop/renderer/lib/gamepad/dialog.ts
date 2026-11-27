// In-app dialogs. Native alert()/confirm() windows cannot be controlled with a gamepad,
// so these are rendered by <GamepadNav /> and can be used with touch, mouse and gamepad.

export interface DialogButton {
    label: string;
    value: any;
    // Button that is selected first (use the safe option for destructive questions)
    default?: boolean;
}

export interface DialogRequest {
    message: string;
    buttons: DialogButton[];
    // Value returned when the dialog is dismissed with B / Escape
    cancelValue: any;
    resolve: (value: any) => void;
}

type Listener = (current: DialogRequest | null) => void

let listener: Listener | undefined
const queue: DialogRequest[] = []
let current: DialogRequest | null = null

function notify() {
    listener?.(current)
}

function next() {
    current = queue.shift() ?? null
    notify()
}

export function subscribeDialogs(callback: Listener): () => void {
    listener = callback
    callback(current)

    return () => {
        if(listener === callback){
            listener = undefined
        }
    }
}

export function hasDialogHost(): boolean {
    return listener !== undefined
}

export function showDialog(message: string, buttons: DialogButton[], cancelValue: any): Promise<any> {
    return new Promise((resolve) => {
        queue.push({ message, buttons, cancelValue, resolve })

        if(current === null){
            next()
        }
    })
}

export function closeCurrentDialog(value: any) {
    if(current === null){
        return
    }

    const request = current
    current = null
    request.resolve(value)
    next()
}

/** Yes/No question. Resolves to true when the first button is chosen. Falls back to window.confirm without a host. */
export function confirmDialog(message: string, yesLabel: string, noLabel: string): Promise<boolean> {
    if(!hasDialogHost()){
        return Promise.resolve(window.confirm(message))
    }

    // The "no" button is the default so a stray A press never ends something.
    return showDialog(message, [
        { label: yesLabel, value: true },
        { label: noLabel, value: false, default: true },
    ], false)
}

export function alertDialog(message: string, okLabel = 'OK'): Promise<void> {
    return showDialog(message, [{ label: okLabel, value: undefined, default: true }], undefined)
}
