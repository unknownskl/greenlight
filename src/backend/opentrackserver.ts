import udp from 'dgram'
import { BrowserWindow } from 'electron'

export default class OpenTrackServer {

    _server:any

    _position: {
        x:number,
        y:number,
        z:number,
        yaw:number,
        pitch:number,
        roll:number,
    }

    constructor() {
        this.resetPosition()
    }

    resetPosition() {
        this._position = {
            x: 0,
            y: 0,
            z: 0,
            yaw: 0,
            pitch: 0,
            roll: 0
        }
    }

    start() {
        console.log('Starting OpenTrack server...')
        this._server = udp.createSocket('udp4');

        this._server.on('error', (error:any) => {
            alert('Error: ' + error);
            this._server.close();
        });

        this._server.on('listening', () =>{
            const address = this._server.address();
            const port = address.port;
            const family = address.family;
            const ipaddr = address.address;

            console.log('OpenTrack - Server is listening at port:', port);
            console.log('OpenTrack - Server ip:', ipaddr);
            console.log('OpenTrack - Server is IP4/IP6:', family);
        });

        this._server.on('message', (msg:Buffer) => this.onMessage(msg))

        this._server.bind(4242);
        console.log('OpenTrack server started.')

        setInterval(() => {
            console.log('OpenTrack - Set positions:', this._position)

            // if(this._position.yaw !== 0 && this._position.pitch !== 0) {
            this.convertToControllerInput(this._position)
            // }

            this.resetPosition()
        }, 50)
    }

    close() {
        console.log('Stopping OpenTrack server...')
        this._server.close();
        console.log('OpenTrack server stopped.')
    }

    onMessage(msg:Buffer) {
        // console.log('OpenTrack - Incoming message:', msg)
        const data = new DataView(this.toArrayBuffer(msg))

        const position = {
            x: data.getFloat64(0, true),
            y: data.getFloat64(8, true),
            z: data.getFloat64(16, true),
            yaw: data.getFloat64(24, true),
            pitch: data.getFloat64(32, true),
            roll: data.getFloat64(40, true)
        }

        this._position = position
        // console.log('Incoming:', position)
    }

    convertToControllerInput(position:any) {
        // Run js func...
        const state = {
            RightThumbXAxis: (position.yaw/20),
            RightThumbYAxis: -(position.pitch/20)
        }

        const window = BrowserWindow.fromId(1) // 1 = main window
        window.webContents.executeJavaScript("xApplication.overwriteGamepadState("+JSON.stringify(state)+")");
    }

    toArrayBuffer(buf:Buffer) {
        const ab = new ArrayBuffer(buf.length);
        const view = new Uint8Array(ab);
        for (let i = 0; i < buf.length; ++i) {
            view[i] = buf[i];
        }
        return ab;
    }

}