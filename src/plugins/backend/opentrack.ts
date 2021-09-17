import appMenu from '../../backend/appMenu'
import udp from 'dgram'

export class OpentrackPluginBackend {

    _isRunning = false
    _menu:appMenu

    _server:any

    _syncInterval:any

    _position: {
        x:number,
        y:number,
        z:number,
        yaw:number,
        pitch:number,
        roll:number,
    }

    constructor(menu:appMenu = undefined) {
        this._menu = menu
    }

    load() {
        this._menu._ipc.on('opentrack-sync', (event:any, variables:any) => {
            // console.log('IPCMain received:', variables)

            // Backend is always in the lead of settings.
            event.reply('opentrack-sync', {
                isRunning: this._isRunning
            })
        })
    }

    start() {
        this._isRunning = true

        this._menu.setMenu('opentrack', this.getMenu())
        this.startServer()
    }

    stop() {
        this._isRunning = false

        this._menu.setMenu('opentrack', this.getMenu())
    }

    startServer() {
        console.log('Starting OpenTrack server...')

        this._server = udp.createSocket('udp4');
    }

    stopServer() {
        console.log('Stopping OpenTrack server...')
        this._server.close();
        console.log('OpenTrack server stopped.')
    }

    getMenu():any {
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
                { type: 'separator' },
                {
                    label: 'No submenu found',
                    enabled: false,
                },
            ]
        }
    }

    getStatusLabel(){
        if(this._isRunning === true){
            return 'Status: Running on port 0000'
        } else {
            return 'Status: Not running'
        }
    }
}