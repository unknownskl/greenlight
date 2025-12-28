import * as DiscordRPC from 'discord-rpc'
import Application from '../application'

export default class DiscordManager {
    private _application: Application
    private _rpc: DiscordRPC.Client | null = null
    private _clientId: string = '1322567936162598973' // Replace with your Discord Client ID
    private _isConnected: boolean = false

    constructor(application: Application) {
        this._application = application
    }

    public connect() {
        if (this._rpc) return

        this._rpc = new DiscordRPC.Client({ transport: 'ipc' })

        this._rpc.on('ready', () => {
            this._application.log('DiscordRPC', 'Connected to Discord')
            this._isConnected = true
            this.setIdlePresence()
        })

        this._rpc.login({ clientId: this._clientId }).catch((err) => {
            this._application.log('DiscordRPC', 'Failed to connect to Discord:', err.message)
            this._rpc = null
            this._isConnected = false
        })
    }

    public setIdlePresence() {
        if (!this._rpc || !this._isConnected) return

        this._rpc.setActivity({
            details: 'In Menus',
            state: 'Ready to Play',
            startTimestamp: new Date(),
            largeImageKey: 'logo',
            largeImageText: 'Greenlight',
            instance: false,
        }).catch((err) => {
            this._application.log('DiscordRPC', 'Failed to set activity:', err.message)
        })
    }

    public setStreamingPresence(type: string, target: string) {
        if (!this._rpc || !this._isConnected) return

        const details = type === 'home' ? 'Streaming from Console' : 'Streaming from xCloud'
        const titleName = this.getTitleName(type, target)

        this._rpc.setActivity({
            details: details,
            state: `Playing ${titleName}`,
            startTimestamp: new Date(),
            largeImageKey: 'logo',
            largeImageText: 'Greenlight',
            instance: true,
        }).catch((err) => {
            this._application.log('DiscordRPC', 'Failed to set streaming activity:', err.message)
        })
    }

    private getTitleName(type: string, target: string): string {
        if (type === 'home') {
            const console = this._application._ipc._channels.consoles._consoles.find(c => c.serverId === target)
            return console ? console.deviceName : target
        } else {
            const title = this._application._ipc._channels.xCloud._titleManager.findTitle(target)
            return title && title.catalogDetails ? title.catalogDetails.ProductTitle : target
        }
    }

    public clearPresence() {
        if (!this._rpc || !this._isConnected) return
        this._rpc.clearActivity().catch((err) => {
            this._application.log('DiscordRPC', 'Failed to clear activity:', err.message)
        })
    }
}
