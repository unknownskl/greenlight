import appMenu from '../../backend/appMenu'
import udp from 'dgram'

interface OpentrackPosition {
    [key: string]: number;
}

export class OpentrackPluginBackend {

    _isRunning = false
    _menu:appMenu

    _server:any
    _serverStatus = {
        port: -1
    }

    _syncInterval:any

    _position:OpentrackPosition = {
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        roll: 0,
    }

    constructor(menu:appMenu = undefined) {
        this._menu = menu
    }

    load() {
        this._menu._ipc.on('opentrack-sync', (event:any, variables:any) => {
            // console.log('IPCMain received:', variables)

            // Backend is always in the lead of settings.
            event.reply('opentrack-sync', {
                isRunning: this._isRunning,
                position: this._position
            })
        })

        this._menu._ipc.on('opentrack-position', (event:any, variables:any) => {
            event.reply('opentrack-position', {
                position: this._position
            })
        })
    }

    start() {
        this._isRunning = true
        console.log('start server')

        this.startServer()
        this._menu.setMenu('opentrack', this.getMenu())
    }

    stop() {
        this._isRunning = false

        this.stopServer()
        this._menu.setMenu('opentrack', this.getMenu())
    }

    startServer(port = 4242) {
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

        this._server.bind(port);
        this._serverStatus.port = port
        console.log('OpenTrack server started.')



        this._syncInterval = setInterval(() => {
            // console.log('updating menu')
            this._menu.setMenu('opentrack', this.getMenu())
        }, 1000)

        // setInterval(() => {
        //     console.log('OpenTrack - Set positions:', this._position)

        //     // if(this._position.yaw !== 0 && this._position.pitch !== 0) {
        //     this.convertToControllerInput(this._position)
        //     // }

        //     this.resetPosition()
        // }, 50)
    }

    stopServer() {
        console.log('Stopping OpenTrack server...')
        clearInterval(this._syncInterval)
        this._serverStatus.port = -1
        this._server.close();
        console.log('OpenTrack server stopped.')
    }

    onMessage(msg:Buffer) {
        // console.log('OpenTrack - Incoming message:', msg)
        const data = new DataView(this._toArrayBuffer(msg))

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

    _toArrayBuffer(buf:Buffer) {
        const ab = new ArrayBuffer(buf.length);
        const view = new Uint8Array(ab);
        for (let i = 0; i < buf.length; ++i) {
            view[i] = buf[i];
        }
        return ab;
    }

    getMenu() {
        return {
            label: 'OpenTrack',
            submenu: [
                {
                    label: (this._isRunning === true) ? 'Stop OpenTrack' : 'Start OpenTrack',
                    click: async () => {
                        if(this._isRunning === false){
                            this.start()
                        } else {
                            this.stop()
                        }
                    }
                },
                {
                    label: this.getStatusLabel(),
                    enabled: false,
                },
                ...this.getPositionsMenu(),
            ]
        }
    }

    getPositionsMenu():any {
        if(this._isRunning === true){
            const menu:Array<any> = [
                { type: 'separator' }
            ]

            Object.keys(this._position).forEach(key => {
                menu.push({
                    label: key+': '+this._position[key],
                    enabled: false
                })
            });

            return menu
        } else {
            return {}
        }
    }

    getStatusLabel(){
        if(this._isRunning === true){
            return 'Status: Running on port '+this._serverStatus.port
        } else {
            return 'Status: Not running'
        }
    }
}